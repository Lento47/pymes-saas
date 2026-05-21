import { useAvatarUrl } from "@/hooks/use-avatar-url";

export function AvatarFallback({
  name,
  identity,
  avatarUrl,
  size,
}: {
  name: string;
  /** Stable identity for hash-based avatar generation (e.g., email, userId). NEVER pass raw names to DiceBear. */
  identity?: string | null;
  /** Pre-computed avatar URL (takes precedence over identity-based generation) */
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";
  const hashUrl = useAvatarUrl(identity ?? null);

  const resolvedUrl = avatarUrl ?? hashUrl;

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div
      className={`${dims} shrink-0 rounded-full bg-gradient-to-br from-brand-indigo to-brand-violet flex items-center justify-center font-semibold text-white overflow-hidden`}
    >
      {resolvedUrl ? (
        <img src={resolvedUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
