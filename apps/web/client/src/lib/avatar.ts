/**
 * Privacy-safe avatar URL generation using DiceBear.
 *
 * NEVER pass raw usernames, emails, or names directly to an external service.
 * Under GDPR, usernames and account identifiers are personal data — disclosing
 * them in a URL query string to a third party would require disclosure in your
 * privacy policy. Instead, we SHA-256 hash the identity first to produce a
 * deterministic, collision-resistant seed that cannot be reversed.
 */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export type DiceBearStyle =
  | "fun-emoji"
  | "bottts-neutral"
  | "initials"
  | "identicon"
  | "thumbs"
  | "avataaars"
  | "big-smile"
  | "lorelei"
  | "notionists"
  | "open-peeps"
  | "personas"
  | "pixel-art";

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a privacy-safe DiceBear avatar URL.
 * The identity is SHA-256 hashed before being used as the seed, so no personal
 * data is ever sent to the DiceBear API.
 *
 * @example
 *   getAvatarUrl("user-abc123")  // https://api.dicebear.com/9.x/fun-emoji/svg?seed=ba7816bf8f01cfea...
 *   getAvatarUrl("contact@example.com", "initials")
 */
export async function getAvatarUrl(
  identity: string,
  style: DiceBearStyle = "fun-emoji",
): Promise<string> {
  const hash = await sha256(identity.trim().toLowerCase());
  return `${DICEBEAR_BASE}/${style}/svg?seed=${hash}`;
}

/**
 * Synchronous fallback for places where async isn't practical.
 * Returns a placeholder data URI SVG with initials.
 * Prefer getAvatarUrl() for actual avatar rendering.
 */
export function getInitialsAvatarDataUri(name: string, size = 40): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const hue = name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 55%, 45%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}" rx="${size / 4}" />
    <text x="50%" y="55%" dominant-baseline="central" text-anchor="middle"
          font-family="system-ui, sans-serif" font-size="${size * 0.4}px"
          font-weight="600" fill="white">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
