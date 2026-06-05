import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallContext } from "./CallProvider";
import { getDevices, type MediaDevice } from "./lib/device-utils";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallPage() {
  const { state, call, localStream, remoteStream, duration, endCall, toggleMute, toggleVideo } = useCallContext();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<{ cameras: MediaDevice[]; mics: MediaDevice[] }>({ cameras: [], mics: [] });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (showSettings) {
      getDevices().then(setDevices);
    }
  }, [showSettings]);

  if (state === "idle" || state === "ended" || state === "rejected" || state === "missed" || state === "error") {
    return null;
  }

  const handleToggleMute = () => {
    toggleMute();
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="sm" onClick={endCall}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {state === "connecting" ? "Conectando..." : formatDuration(duration)}
          </p>
          <p className="text-xs text-muted-foreground">
            {call?.type === "video" ? "Videollamada" : "Llamada de voz"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {call?.type === "video" ? (
          <>
            {/* Remote video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Local video (PiP) */}
            <div className="absolute bottom-20 right-4 w-32 h-44 rounded-lg overflow-hidden border border-border shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </>
        ) : (
          /* Audio call — avatar */
          <div className="flex items-center justify-center h-full">
            <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center ring-4 ring-accent/20">
              <span className="text-4xl font-bold text-muted-foreground">
                {call?.callee_id?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            </div>
          </div>
        )}

        {/* Reconnecting overlay */}
        {state === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <p className="text-lg text-white animate-pulse">Conectando...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 border-t border-border">
        <Button
          variant="outline"
          size="lg"
          className={`h-12 w-12 rounded-full p-0 ${isMuted ? "bg-destructive/10 border-destructive/30 text-destructive" : ""}`}
          onClick={handleToggleMute}
          aria-label={isMuted ? "Activar micrófono" : "Silenciar"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        {call?.type === "video" && (
          <Button
            variant="outline"
            size="lg"
            className={`h-12 w-12 rounded-full p-0 ${isVideoOff ? "bg-destructive/10 border-destructive/30 text-destructive" : ""}`}
            onClick={handleToggleVideo}
            aria-label={isVideoOff ? "Activar cámara" : "Apagar cámara"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="h-12 w-12 rounded-full p-0"
          onClick={endCall}
          aria-label="Terminar llamada"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-72 rounded-xl bg-card border border-border p-4 shadow-panel z-50">
          <h3 className="text-sm font-semibold text-foreground mb-3">Dispositivos</h3>
          {devices.cameras.length > 1 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Cámara</p>
              <select className="w-full rounded-md border border-border bg-background text-sm p-1.5">
                {devices.cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {devices.mics.length > 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Micrófono</p>
              <select className="w-full rounded-md border border-border bg-background text-sm p-1.5">
                {devices.mics.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {devices.cameras.length <= 1 && devices.mics.length <= 1 && (
            <p className="text-xs text-muted-foreground">No se detectaron dispositivos adicionales.</p>
          )}
        </div>
      )}
    </div>
  );
}
