import { useEffect } from "react";
import { getSocket } from "@/hooks/use-socket";
import type { CallInfo } from "./use-call";

interface UseCallSocketOptions {
  onIncomingCall?: (call: CallInfo) => void;
  onCallAnswered?: (call: CallInfo) => void;
  onCallRejected?: (call: CallInfo) => void;
  onCallEnded?: (call: CallInfo) => void;
  onCallOffer?: (payload: { call_id: string; sdp: string }) => void;
  onCallAnswer?: (payload: { call_id: string; sdp: string }) => void;
  onCallIce?: (payload: { call_id: string; candidate: string; sdp_mid: string; sdp_m_line_index: number }) => void;
}

export function useCallSocket(options: UseCallSocketOptions) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRinging = (call: CallInfo) => {
      options.onIncomingCall?.(call);
    };

    const handleAnswered = (call: CallInfo) => {
      options.onCallAnswered?.(call);
    };

    const handleRejected = (call: CallInfo) => {
      options.onCallRejected?.(call);
    };

    const handleEnded = (call: CallInfo) => {
      options.onCallEnded?.(call);
    };

    const handleOffer = (payload: { call_id: string; sdp: string }) => {
      options.onCallOffer?.(payload);
    };

    const handleAnswer = (payload: { call_id: string; sdp: string }) => {
      options.onCallAnswer?.(payload);
    };

    const handleIce = (payload: { call_id: string; candidate: string; sdp_mid: string; sdp_m_line_index: number }) => {
      options.onCallIce?.(payload);
    };

    socket.on("call:ringing", handleRinging);
    socket.on("call:answered", handleAnswered);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);

    return () => {
      socket.off("call:ringing", handleRinging);
      socket.off("call:answered", handleAnswered);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
    };
  }, [options.onIncomingCall, options.onCallAnswered, options.onCallRejected, options.onCallEnded, options.onCallOffer, options.onCallAnswer, options.onCallIce]);
}
