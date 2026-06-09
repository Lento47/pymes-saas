import { useCallback, useEffect, useRef, useState } from "react";
import { api, getAuthToken } from "@/lib/api";
import { ICE_SERVERS, checkWebRtcSupport } from "../lib/webrtc-config";
import { getMediaWithConstraints, getDevices, type MediaDevice } from "../lib/device-utils";

export type CallState =
  | "idle"
  | "outgoing_ringing"
  | "incoming_ringing"
  | "connecting"
  | "active"
  | "ended"
  | "rejected"
  | "missed"
  | "error";

export interface CallInfo {
  id: string;
  type: "audio" | "video";
  caller_id: string;
  callee_id: string;
  conversation_id?: string | null;
}

interface UseCallOptions {
  onCallEnded?: () => void;
  ringTimeoutMs?: number;
}

export function useCall(options: UseCallOptions = {}) {
  const { onCallEnded, ringTimeoutMs = 30_000 } = options;

  const [state, setState] = useState<CallState>("idle");
  const [call, setCall] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [devices, setDevices] = useState<{ cameras: MediaDevice[]; mics: MediaDevice[] }>({ cameras: [], mics: [] });
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callRef = useRef<CallInfo | null>(null);
  const stateRef = useRef<CallState>("idle");
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { callRef.current = call; }, [call]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    iceRestartCountRef.current = 0;
  }

  function resetState() {
    cleanup();
    setState("idle");
    setCall(null);
    setError(null);
    setDuration(0);
  }

  async function loadDevices() {
    const d = await getDevices();
    setDevices(d);
    if (d.cameras.length > 0 && !selectedCamera) setSelectedCamera(d.cameras[0].deviceId);
    if (d.mics.length > 0 && !selectedMic) setSelectedMic(d.mics[0].deviceId);
  }

  function createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && callRef.current) {
        api.addIceCandidate(callRef.current.id, {
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate.sdpMid ?? "",
          sdp_m_line_index: event.candidate.sdpMLineIndex ?? 0,
        }).catch(() => {});
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;

      if (iceState === "failed") {
        // ICE restart
        if (iceRestartCountRef.current < 3) {
          iceRestartCountRef.current++;
          pc.restartIce();
          pc.createOffer({ iceRestart: true }).then((offer) => pc.setLocalDescription(offer)).catch(() => {});
        } else {
          endCallInternal();
        }
      } else if (iceState === "disconnected") {
        // Wait 10s, then check again
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            endCallInternal();
          }
        }, 10_000);
      } else if (iceState === "connected" || iceState === "completed") {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        iceRestartCountRef.current = 0;
      }
    };

    pcRef.current = pc;
    return pc;
  }

  function startDurationTimer() {
    setDuration(0);
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
  }

  async function endCallInternal(qualityStats?: Record<string, unknown>) {
    const currentCall = callRef.current;
    const currentState = stateRef.current;
    if (!currentCall || currentState === "idle" || currentState === "ended") return;

    stopDurationTimer();
    try {
      await api.endCall(currentCall.id);
    } catch {
      // Best effort
    }
    setState("ended");
    onCallEnded?.();
    setTimeout(resetState, 2000);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async function startCall(toUserId: string, type: "audio" | "video", conversationId?: string) {
    if (!checkWebRtcSupport()) {
      setError("Tu navegador no soporta llamadas. Actualiza tu navegador.");
      setState("error");
      return;
    }

    try {
      setError(null);
      await loadDevices();
      const stream = await getMediaWithConstraints(type, selectedCamera, selectedMic);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const callData = await api.ringCall({
        to_user_id: toUserId,
        type,
        conversation_id: conversationId,
      });

      const callInfo: CallInfo = {
        id: callData.id,
        type,
        caller_id: callData.caller_id,
        callee_id: callData.callee_id,
        conversation_id: callData.conversation_id,
      };
      setCall(callInfo);
      setState("outgoing_ringing");

      // Create offer
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via Socket.IO (ephemeral, not REST)
      const { io } = await import("socket.io-client");
      // Use existing socket connection — emit via the global socket
      window.dispatchEvent(
        new CustomEvent("call:send-offer", { detail: { call_id: callInfo.id, sdp: JSON.stringify(offer) } }),
      );

      // Ring timeout
      ringTimerRef.current = setTimeout(() => {
        if (stateRef.current === "outgoing_ringing") {
          endCallInternal();
          setState("missed");
        }
      }, ringTimeoutMs);
    } catch (err: any) {
      if (err?.error_code === "user_busy") {
        setError("Esta persona está en otra llamada.");
        setState("error");
      } else if (err?.name === "NotAllowedError") {
        setError("Permitir cámara/micrófono para hacer llamadas.");
        setState("error");
      } else if (err?.name === "NotFoundError") {
        setError("No se detectó cámara/micrófono.");
        setState("error");
      } else {
        setError("Error al iniciar llamada.");
        setState("error");
      }
      resetState();
    }
  }

  async function acceptCall(incomingCall: CallInfo) {
    if (!checkWebRtcSupport()) {
      setError("Tu navegador no soporta llamadas.");
      setState("error");
      return;
    }

    try {
      setError(null);
      await loadDevices();
      const stream = await getMediaWithConstraints(incomingCall.type, selectedCamera, selectedMic);
      localStreamRef.current = stream;
      setLocalStream(stream);

      await api.answerCall(incomingCall.id);

      setCall(incomingCall);
      setState("connecting");

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Wait for the offer from the caller (comes via Socket.IO)
      // The use-call-socket hook will set the remote description
    } catch {
      setError("Error al aceptar llamada.");
      setState("error");
      resetState();
    }
  }

  async function rejectCall(callId: string) {
    try {
      await api.rejectCall(callId);
    } catch {
      // Best effort
    }
    setState("rejected");
    setTimeout(resetState, 1500);
  }

  async function endCall() {
    await endCallInternal();
  }

  function setRemoteDescriptionFromOffer(sdp: string) {
    const pc = pcRef.current;
    if (!pc) return;
    const offer = new RTCSessionDescription(JSON.parse(sdp));
    pc.setRemoteDescription(offer).then(async () => {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // Send answer via Socket.IO
      window.dispatchEvent(
        new CustomEvent("call:send-answer", { detail: { call_id: callRef.current?.id, sdp: JSON.stringify(answer) } }),
      );
      setState("active");
      startDurationTimer();
    }).catch(() => {});
  }

  function setRemoteDescriptionFromAnswer(sdp: string) {
    const pc = pcRef.current;
    if (!pc) return;
    const answer = new RTCSessionDescription(JSON.parse(sdp));
    pc.setRemoteDescription(answer).then(() => {
      setState("active");
      startDurationTimer();
    }).catch(() => {});
  }

  function handleRemoteIceCandidate(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (!pc) return;
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }

  function toggleMute() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
    }
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = !videoTrack.enabled;
    }
  }

  function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    // TODO: replace track on active connection
  }

  function switchMic(deviceId: string) {
    setSelectedMic(deviceId);
    // TODO: replace track on active connection
  }

  return {
    state,
    call,
    localStream,
    remoteStream,
    error,
    duration,
    devices,
    selectedCamera,
    selectedMic,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    switchMic,
    setRemoteDescriptionFromOffer,
    setRemoteDescriptionFromAnswer,
    handleRemoteIceCandidate,
  };
}
