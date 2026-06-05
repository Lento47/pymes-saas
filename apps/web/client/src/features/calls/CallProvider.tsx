import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useCall, type CallInfo, type CallState } from "./hooks/use-call";
import { useCallSocket } from "./hooks/use-call-socket";

interface CallContextValue {
  state: CallState;
  call: CallInfo | null;
  incomingCall: CallInfo | null;
  error: string | null;
  duration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (userId: string, type: "audio" | "video", conversationId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  dismissIncoming: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const incomingCallRef = useRef<CallInfo | null>(null);

  const handleIncomingCall = useCallback((call: CallInfo) => {
    incomingCallRef.current = call;
    setIncomingCall(call);
  }, []);

  const handleCallEnded = useCallback(() => {
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, []);

  const callHook = useCall({
    onCallEnded: handleCallEnded,
    ringTimeoutMs: 30_000,
  });

  const handleCallOffer = useCallback(
    (payload: { call_id: string; sdp: string }) => {
      if (callHook.state === "idle" && incomingCallRef.current?.id === payload.call_id) {
        callHook.setRemoteDescriptionFromOffer(payload.sdp);
      }
    },
    [callHook],
  );

  const handleCallAnswer = useCallback(
    (payload: { call_id: string; sdp: string }) => {
      if (callHook.call?.id === payload.call_id) {
        callHook.setRemoteDescriptionFromAnswer(payload.sdp);
      }
    },
    [callHook],
  );

  const handleCallIce = useCallback(
    (payload: { call_id: string; candidate: string; sdp_mid: string; sdp_m_line_index: number }) => {
      if (callHook.call?.id === payload.call_id || incomingCallRef.current?.id === payload.call_id) {
        callHook.handleRemoteIceCandidate({
          candidate: payload.candidate,
          sdpMid: payload.sdp_mid,
          sdpMLineIndex: payload.sdp_m_line_index,
        });
      }
    },
    [callHook],
  );

  const handleSocketCallEnded = useCallback(
    (call: CallInfo) => {
      callHook.endCall();
      setIncomingCall(null);
      incomingCallRef.current = null;
    },
    [callHook],
  );

  useCallSocket({
    onIncomingCall: handleIncomingCall,
    onCallAnswered: useCallback(() => {}, []),
    onCallRejected: useCallback(() => {}, []),
    onCallEnded: handleSocketCallEnded,
    onCallOffer: handleCallOffer,
    onCallAnswer: handleCallAnswer,
    onCallIce: handleCallIce,
  });

  const acceptCall = useCallback(async () => {
    if (!incomingCallRef.current) return;
    await callHook.acceptCall(incomingCallRef.current);
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, [callHook]);

  const rejectCall = useCallback(async () => {
    if (!incomingCallRef.current) return;
    await callHook.rejectCall(incomingCallRef.current.id);
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, [callHook]);

  const dismissIncoming = useCallback(() => {
    setIncomingCall(null);
    incomingCallRef.current = null;
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      state: callHook.state,
      call: callHook.call,
      incomingCall,
      error: callHook.error,
      duration: callHook.duration,
      localStream: callHook.localStream,
      remoteStream: callHook.remoteStream,
      startCall: callHook.startCall,
      acceptCall,
      rejectCall,
      endCall: callHook.endCall,
      toggleMute: callHook.toggleMute,
      toggleVideo: callHook.toggleVideo,
      dismissIncoming,
    }),
    [callHook.state, callHook.call, incomingCall, callHook.error, callHook.duration, callHook.localStream, callHook.remoteStream, callHook.startCall, acceptCall, rejectCall, callHook.endCall, callHook.toggleMute, callHook.toggleVideo, dismissIncoming],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
