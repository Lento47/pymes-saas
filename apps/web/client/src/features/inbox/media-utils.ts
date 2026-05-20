import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { MediaType } from "./message-types";

export function getMediaProxyUrl(messageId: string): string {
  return `/api/conversations/messages/${messageId}/media`;
}

export function classifyMediaType(mimeType?: string | null, filename?: string | null, messageType?: string | null): MediaType {
  if (messageType === "sticker" || messageType === "location" || messageType === "contact") {
    return messageType;
  }

  if (mimeType) {
    if (mimeType.startsWith("image/")) {
      return mimeType.includes("webp") ? "sticker" : "image";
    }
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf" || mimeType.startsWith("application/")) return "document";
    if (mimeType.startsWith("text/")) return "document";
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "webp") return "sticker";
    if (["jpg", "jpeg", "png", "gif", "svg", "bmp", "ico", "tiff", "webp"].includes(ext ?? "")) return "image";
    if (["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"].includes(ext ?? "")) return "video";
    if (["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(ext ?? "")) return "audio";
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar"].includes(ext ?? "")) return "document";
  }

  return "document";
}

export function isStickerType(mimeType?: string | null, filename?: string | null, messageType?: string | null): boolean {
  if (messageType === "sticker") return true;
  if (mimeType === "image/webp") return true;
  if (filename?.endsWith(".webp")) return true;
  return false;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMessageTime(date: Date | null): string {
  if (!date) return "";
  return format(date, "HH:mm");
}

export function formatMessageDate(date: Date): string {
  return format(date, "d MMM yyyy", { locale: es });
}

export function safeFileName(filename?: string | null): string {
  if (!filename) return "Archivo";
  const sanitized = filename.replace(/[<>:"/\\|?*\x00]/g, "").replace(/\.\./g, "").trim();
  return sanitized || "Archivo";
}
