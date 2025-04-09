import { DurableObject } from 'cloudflare:workers';

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/**
 * Env provides a mechanism to reference bindings declared in wrangler.jsonc within JavaScript
 *
 * @typedef {Object} Env
 * @property {DurableObjectNamespace} MY_DURABLE_OBJECT - The Durable Object namespace binding
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class VideoChatApp extends DurableObject {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param {DurableObjectState} ctx - The interface for interacting with Durable Object state
	 * @param {Env} env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx, env) {
		super(ctx, env);
		this.sessions = new Map();
		this.ctx.getWebSockets().forEach((ws) => {
			this.sessions.set(ws, { ...ws.deserializeAttachment() });
		});
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param {string} name - The name provided to a Durable Object instance from a Worker
	 * @returns {Promise<string>} The greeting to be sent back to the Worker
	 */
	async fetch(_req) {
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		this.sessions.set(pair[1], {});
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	webSocketMessage(ws, message) {
		const session = this.sessions.get(ws);
		// if this session doesn't have an id, it's a new connection
		if (!session.id) {
			session.id = crypto.randomUUID();
			ws.serializeAttachment({ ...ws.deserializeAttachment(), id: session.id });
			ws.send(JSON.stringify({ ready: true, id: session.id }));
		}
		this.broadcast(ws, message);
	}

	broadcast(sender, message) {
		const id = this.sessions.get(sender).id;
		for (let [ws] of this.sessions) {
			if (ws == sender) continue;
			switch (typeof message) {
				case 'string':
					ws.send(JSON.stringify({ ...JSON.parse(message), id }));
					break;
				default:
					ws.send(JSON.stringify({ ...message, id }));
					break;
			}
		}
	}

	webSocketClose(ws) {
		this.close(ws);
	}
	webSocketError(ws) {
		this.close(ws);
	}

	close(ws) {
		const session = this.sessions.get(ws);
		if (!session?.id) return;
		this.broadcast(ws, { type: 'left' });
		this.sessions.delete(ws);
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param {Request} request - The request submitted to the Worker from the client
	 * @param {Env} env - The interface to reference bindings declared in wrangler.jsonc
	 * @param {ExecutionContext} ctx - The execution context of the Worker
	 * @returns {Promise<Response>} The response to be sent back to the client
	 */
	async fetch(request, env, ctx) {
		// We will create a `DurableObjectId` using the pathname from the Worker request
		// This id refers to a unique instance of our 'MyDurableObject' class above
		// Let client know that it is a websocket connection
		const upgrade = request.headers.get('Upgrade');
		if (!upgrade || upgrade != 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}
		const id = env.VIDEO_CHAT_APP.idFromName(new URL(request.url).pathname);
		const videoChatApp = env.VIDEO_CHAT_APP.get(id);
		return videoChatApp.fetch(request);

		// This stub creates a communication channel with the Durable Object instance
		// The Durable Object constructor will be invoked upon the first call for a given id
		// let stub = env.VIDEO_CHAT_APP.get(id);

		// We call the `sayHello()` RPC method on the stub to invoke the method on the remote
		// Durable Object instance
		// let greeting = await stub.sayHello('world');

		// return new Response(greeting);
	},
};
