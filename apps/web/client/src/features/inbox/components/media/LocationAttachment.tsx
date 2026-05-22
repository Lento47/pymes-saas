import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

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
    <div className={cn("flex min-w-[230px] max-w-[340px] flex-col gap-2 rounded-xl border border-border/55 bg-card/80 px-3 py-2.5 shadow-sm", className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">Ubicación compartida</span>
      </div>
      {label && (
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/80">
          <SensitiveText text={label} />
        </p>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-primary hover:text-primary/80"
        >
          Ver en Google Maps
        </a>
      )}
    </div>
  );
}
