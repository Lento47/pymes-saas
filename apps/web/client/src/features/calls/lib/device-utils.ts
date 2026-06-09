export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput";
  groupId: string;
}

export async function getDevices(): Promise<{
  cameras: MediaDevice[];
  mics: MediaDevice[];
}> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Cámara ${d.deviceId.slice(0, 4)}`,
          kind: d.kind as "videoinput",
          groupId: d.groupId,
        })),
      mics: devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Micrófono ${d.deviceId.slice(0, 4)}`,
          kind: d.kind as "audioinput",
          groupId: d.groupId,
        })),
    };
  } catch {
    return { cameras: [], mics: [] };
  }
}

export async function getMediaWithConstraints(
  type: "audio" | "video",
  cameraDeviceId?: string,
  micDeviceId?: string,
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
    video: type === "video" ? (cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true) : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}
