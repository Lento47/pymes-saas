import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

interface LocationAttachmentProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  legacyText?: string | null;
  className?: string;
}

function parseLegacyText(text: string | null | undefined): { label?: string; lat?: number; lng?: number } {
  if (!text || !text.startsWith("📍 ")) return {};

  const lines = text.replace("📍 ", "").split("\n").map((l) => l.trim()).filter(Boolean);
  const label = lines[0] ?? undefined;

  for (const line of lines) {
    if (line.includes(",")) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { label, lat, lng };
        }
      }
    }
  }

  return { label };
}

export function LocationAttachment({
  latitude,
  longitude,
  address,
  legacyText,
  className,
}: LocationAttachmentProps) {
  const parsed = legacyText ? parseLegacyText(legacyText) : {};
  const lat = latitude ?? parsed.lat ?? null;
  const lng = longitude ?? parsed.lng ?? null;
  const label = address ?? parsed.label ?? null;

  const mapsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : null;

  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5", className)}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">Ubicación compartida</span>
      </div>
      {label && (
        <p className="text-[11px] text-muted-foreground/80">{label}</p>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-400 hover:text-blue-300"
        >
          Ver en Google Maps
        </a>
      )}
    </div>
  );
}
