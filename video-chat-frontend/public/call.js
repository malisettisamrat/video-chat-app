const localVid = document.getElementById('my-video');
const remoteVid = document.getElementById('peer-video');
const videoBtn = document.getElementById('video-ctl');
const endCallBtn = document.getElementById('endcall');
const audioBtn = document.getElementById('audio-ctl');

const env = {};

if (location.hostname == 'localhost') {
	env.ws = 'ws://localhost:8787';
	env.servers = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
} else {
	//TODO
	env.ws = 'wss://video-chat-backend.samratmalisetti.workers.dev';
	try {
		env.servers = await fetch('./turn.json').then((res) => res.json());
	} catch (error) {
		console.log(error);
	}
}

// connecting to the durable objects
let ws;
let localStream;
let remoteStream;
let peerConnection;

videoBtn.addEventListener('click', () => toggleTrack('video'));
audioBtn.addEventListener('click', () => toggleTrack('audio'));
endCallBtn.addEventListener('click', () => (location.href = '/'));

function toggleTrack(kind) {
	const track = localStream.getTracks().find((t) => t.kind === kind);
	track.enabled = !track.enabled;
	document.querySelector(`#${kind}-ctl img`).src = `images/${kind}${!track.enabled ? '_off' : ''}.svg`;
}

const wsSend = (data) => {
	ws.send(JSON.stringify(data));
};

async function handleMessages(event) {
	const msg = JSON.parse(event.data);

	switch (msg.type) {
		case 'joined':
			await makeCall();
			break;
		case 'candidate':
			await acceptCandidate(msg.data);
			break;
		case 'offer':
			await answerCall(msg.data);
			break;
		case 'answer':
			await startCall(msg.data);
			break;
		case 'left':
			await endCall();
			break;
		default:
			break;
	}
}

async function connectToPeer() {
	peerConnection = new RTCPeerConnection(env.servers);
	remoteStream = new MediaStream();

	localVid.classList.add('video-player-secondary');
	remoteVid.srcObject = remoteStream;
	remoteVid.classList.remove('hide');

	if (!localStream) await startLocalPlayback();

	// Sending the local stream to the peer connection
	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	// Collect the peer's video and audiostream
	peerConnection.ontrack = (e) => {
		e.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
		});
	};

	// Connecting to the peer's connection in a good path/connection
	peerConnection.onicecandidate = (e) => {
		if (e.candidate) {
			wsSend({ type: 'candidate', data: e.candidate });
		}
	};
}

async function makeCall() {
	await connectToPeer();
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	wsSend({ type: 'offer', data: offer });
}

async function acceptCandidate(candidate) {
	try {
		await peerConnection.addIceCandidate(candidate);
	} catch (error) {
		console.log('Error adding ice candidate', error);
	}
}

async function answerCall(offer) {
	await connectToPeer();
	await peerConnection.setRemoteDescription(offer);
	const answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);
	wsSend({ type: 'answer', data: answer });
}

async function startCall(answer) {
	await peerConnection.setRemoteDescription(answer);
}

async function endCall() {
	peerConnection.close();
	remoteVid.classList.add('hide');
	localVid.classList.remove('video-player-secondary');
}

(async function () {
	const id = new URLSearchParams(location.search).get('i');
	if (!id) {
		alert('No ID provided');
		return;
	}
	ws = new WebSocket(`${env.ws}/${id}`);
	ws.onmessage = handleMessages;
	ws.onopen = () => wsSend({ type: 'joined' });
	await startLocalPlayback();
})();

async function startLocalPlayback() {
	const config = {
		video: {
			width: { min: 1280, ideal: 1920, max: 1920 },
			height: { min: 720, ideal: 1080, max: 1080 },
		},
		audio: true,
	};
	localStream = await navigator.mediaDevices.getUserMedia(config);
	localVid.srcObject = localStream;
}
