# Video Chat App
- A peer-to-peer video chat application built using the WebRTC and Cloudflare.
- Used Cloudflare durable object for persistent data to manage the session storage.
- Used STUN/TURN servers for establishing the peer connections.

**Application Flow**
1. User Interface
- Landing Page: Users can create or join a meeting using a unique link.
- Video Call Page: Displays local and remote video streams.
2. Establishing a Connection
- User A opens the app and starts a new meeting.
- User B joins using the meeting link.
3. WebRTC Setup
- Local Media Access: Both users grant access to their cameras and microphones using getUserMedia().
- Peer Connection: Each user creates an RTCPeerConnection to manage the connection.
4. Signaling Process
- Offer/Answer Exchange:
  - User A creates an offer and sends it to User B via the signaling server.
  - User B receives the offer, creates an answer, and sends it back.
- ICE Candidate Exchange:
  - Both users exchange ICE candidates to establish the best path for the connection.
5. Cloudflare Workers and Durable Objects
- WebSocket Connection:
  - The frontend connects to the backend using WebSockets.
  - Cloudflare Workers handle the initial WebSocket connection and upgrade requests.
- Durable Objects:
  - Manage persistent sessions and store connection data.
  - Handle signaling messages (offer, answer, candidates) and broadcast them to peers.
6. Real-Time Communication
- Direct P2P Connection:
  - Once signaling is complete, a direct peer-to-peer connection is established.
  - Video and audio streams flow directly between users.
7. Session Management
- Persistent Data:
  - Durable Objects maintain session state, ensuring users can reconnect if needed.
  - Sessions are stored in memory, allowing for real-time updates and management.
