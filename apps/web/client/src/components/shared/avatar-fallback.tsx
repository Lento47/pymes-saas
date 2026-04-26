export function AvatarFallback({ name, size }: { name: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className={`${dims} shrink-0 rounded-full bg-gradient-to-br from-brand-indigo to-brand-violet flex items-center justify-center font-semibold text-white`}>
      {initials}
    </div>
  );
}
