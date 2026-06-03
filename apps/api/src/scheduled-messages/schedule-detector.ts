/**
 * Detects scheduling / reminder requests from customer messages.
 * Regex-first, no AI call needed for common patterns.
 */

export interface ScheduleRequest {
  scheduledAt: Date;
  delayMs: number;
  /** Human-readable label, e.g. "15 minutos" */
  label: string;
}

const UNIT_MS: Record<string, number> = {
  min: 60_000, minuto: 60_000, minutos: 60_000, mins: 60_000,
  minute: 60_000, minutes: 60_000,
  hora: 3_600_000, horas: 3_600_000, hr: 3_600_000, hrs: 3_600_000,
  hour: 3_600_000, hours: 3_600_000,
  dia: 86_400_000, dias: 86_400_000,
  day: 86_400_000, days: 86_400_000,
  semana: 604_800_000, semanas: 604_800_000,
  week: 604_800_000, weeks: 604_800_000,
  mes: 2_592_000_000, meses: 2_592_000_000,
  month: 2_592_000_000, months: 2_592_000_000,
  año: 31_536_000_000, años: 31_536_000_000,
  year: 31_536_000_000, years: 31_536_000_000,
};

const UNIT_LABELS: Record<string, string> = {
  min: "minuto", minuto: "minuto", minutos: "minutos", mins: "minutos",
  minute: "minuto", minutes: "minutos",
  hora: "hora", horas: "horas", hr: "hora", hrs: "horas",
  hour: "hora", hours: "horas",
  dia: "día", dias: "días",
  day: "día", days: "días",
  semana: "semana", semanas: "semanas",
  week: "semana", weeks: "semanas",
  mes: "mes", meses: "meses",
  month: "mes", months: "meses",
  año: "año", años: "años",
  year: "año", years: "años",
};

/** Normalize a string: lowercase + strip diacritics */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Returns a ScheduleRequest if the message contains a recognizable scheduling
 * intent with an explicit time offset, or null otherwise.
 *
 * Matches patterns like:
 *   "Avísame en 15 min"
 *   "Recuérdame en 2 horas"
 *   "Contáctame en 1 día"
 *   "Notifícame en 30 minutos si el pedido llegó"
 *   "remind me in 15 minutes"
 *   "follow up in 2 days"
 */
export function detectScheduleRequest(text: string): ScheduleRequest | null {
  const n = norm(text);

  // 1. Must have a scheduling trigger verb/phrase
  const TRIGGER = /\b(avisame|avisanos|avisa\s*me|avisa\s*nos|recuerdame|recuerda\s*me|notificame|notifica\s*me|escribeme|escribe\s*me|mandame|manda\s*me|contactame|contacta\s*me|llamame|llama\s*me|remind\s*me|let\s*me\s*know|follow\s*up|check\s*in|ping\s*me)\b/;

  const hasIntent = TRIGGER.test(n);

  // Also match bare "en X min" if combined with conditional phrasing ("si…", "cuando…")
  const hasConditional = /\b(si|cuando|if|when)\b/.test(n) && /\ben\s+\d+/.test(n);

  if (!hasIntent && !hasConditional) return null;

  // 2. Extract time amount + unit
  const TIME_RE = /\b(?:en|in|dentro\s+de)\s+(\d+)\s+(min(?:utos?|s)?|hora?s?|dias?|semanas?|mes(?:es)?|a[nñ]os?|hours?|days?|weeks?|months?|years?|minutes?)\b/i;
  const m = n.match(TIME_RE);
  if (!m) return null;

  const amount = parseInt(m[1], 10);
  const rawUnit = m[2];

  // Find the best key match (the regex captures the full form, e.g. "minutos")
  const unitKey = Object.keys(UNIT_MS).find((k) => norm(rawUnit).startsWith(k) || k.startsWith(norm(rawUnit)));
  if (!unitKey) return null;

  const ms = UNIT_MS[unitKey];
  if (!ms || amount <= 0 || amount > 365 * 24 * 60) return null; // cap at 1 year

  const delayMs = amount * ms;
  const unitLabel = UNIT_LABELS[unitKey] ?? rawUnit;
  const label = amount === 1 ? `1 ${unitLabel}` : `${amount} ${unitLabel}`;

  return {
    scheduledAt: new Date(Date.now() + delayMs),
    delayMs,
    label,
  };
}
