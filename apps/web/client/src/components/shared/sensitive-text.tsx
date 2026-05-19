import { useState, memo } from "react";
import { Eye, EyeOff } from "lucide-react";

type Segment =
  | { kind: "plain"; text: string }
  | { kind: "secret"; label: string; sep: string; value: string };

// Matches: LABEL=value or LABEL: value where LABEL contains a sensitive keyword
const LABEL_VALUE_RE =
  /\b([\w-]*(?:PRIVATE[_-]?KEY|API[_-]?KEY|API[_-]?SECRET|ACCESS[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?SECRET|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|JWT|AUTH[_-]?KEY|CREDENTIAL|APIKEY|AUTHKEY|SECRETKEY)[\w-]*)\s*([=:])\s*(\S+)/gi;

// Bare JWT tokens (three base64-url segments separated by dots)
const JWT_RE =
  /(eyJ[A-Za-z0-9+/=_-]{8,}\.[A-Za-z0-9+/=_-]{8,}\.[A-Za-z0-9+/=_-]{8,})/g;

// Long hex strings (40+ hex chars — typical for private keys, hashes)
const HEX_RE = /\b([0-9a-fA-F]{40,})\b/g;

type Hit = { start: number; end: number; seg: Segment };

function findHits(text: string): Hit[] {
  const hits: Hit[] = [];

  let m: RegExpExecArray | null;

  const lv = new RegExp(LABEL_VALUE_RE.source, "gi");
  while ((m = lv.exec(text)) !== null) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { kind: "secret", label: m[1], sep: m[2], value: m[3] },
    });
  }

  const jt = new RegExp(JWT_RE.source, "g");
  while ((m = jt.exec(text)) !== null) {
    if (!hits.some((h) => h.start <= m!.index && m!.index < h.end)) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { kind: "secret", label: "token", sep: ":", value: m[0] },
      });
    }
  }

  const hx = new RegExp(HEX_RE.source, "g");
  while ((m = hx.exec(text)) !== null) {
    if (!hits.some((h) => h.start <= m!.index && m!.index < h.end)) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { kind: "secret", label: "valor", sep: "", value: m[0] },
      });
    }
  }

  return hits.sort((a, b) => a.start - b.start);
}

function buildSegments(text: string, hits: Hit[]): Segment[] {
  if (hits.length === 0) return [{ kind: "plain", text }];
  const segs: Segment[] = [];
  let pos = 0;
  for (const { start, end, seg } of hits) {
    if (start > pos) segs.push({ kind: "plain", text: text.slice(pos, start) });
    segs.push(seg);
    pos = end;
  }
  if (pos < text.length) segs.push({ kind: "plain", text: text.slice(pos) });
  return segs;
}

/** Returns true if the text contains patterns that look like secrets. */
export function hasSensitiveContent(text: string): boolean {
  return findHits(text).length > 0;
}

/**
 * Renders text with sensitive patterns (API keys, tokens, passwords, etc.)
 * automatically redacted behind ••••••••. Each segment has its own
 * "Mostrar temporalmente" toggle so agents can reveal values one at a time.
 */
export const SensitiveText = memo(function SensitiveText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const hits = findHits(text);
  const segments = buildSegments(text, hits);

  if (hits.length === 0) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === "plain") return <span key={i}>{seg.text}</span>;
        const isOn = revealed.has(i);
        return (
          <span key={i} className="inline-flex items-baseline gap-0.5">
            <span className="font-medium text-amber-400/80 text-[0.9em]">
              {seg.label}
              {seg.sep}
            </span>
            {isOn ? (
              <span className="font-mono text-[0.82em] break-all text-foreground/80">
                {seg.value}
              </span>
            ) : (
              <span className="font-mono text-[0.82em] text-muted-foreground/60 tracking-widest select-none">
                ••••••••
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRevealed((prev) => {
                  const next = new Set(prev);
                  isOn ? next.delete(i) : next.add(i);
                  return next;
                });
              }}
              className="ml-0.5 inline-flex items-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              title={isOn ? "Ocultar" : "Mostrar temporalmente"}
            >
              {isOn ? (
                <EyeOff className="w-2.5 h-2.5" />
              ) : (
                <Eye className="w-2.5 h-2.5" />
              )}
            </button>
          </span>
        );
      })}
    </span>
  );
});
