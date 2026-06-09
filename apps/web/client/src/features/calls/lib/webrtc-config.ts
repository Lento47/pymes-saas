export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Production: add TURN server when available
// { urls: "turn:your-turn-server.com", username: "...", credential: "..." }

export function checkWebRtcSupport(): boolean {
  return !!(
    typeof window !== "undefined" &&
    window.RTCPeerConnection &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}
