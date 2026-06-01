import { useMemo } from "react";

interface TelegramRichTextProps {
  html: string;
  isOutbound?: boolean;
}

function sanitizeTelegramHtml(html: string): string {
  // Only allow safe Telegram tags. Everything else is stripped.
  // This is a lightweight allow-list sanitizer (no external deps).
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "")
    .replace(/ on\w+=\S+/gi, "");
}

export function TelegramRichText({ html, isOutbound }: TelegramRichTextProps) {
  const safeHtml = useMemo(() => sanitizeTelegramHtml(html), [html]);

  const linkClass = isOutbound
    ? "text-white/90 underline decoration-white/40 hover:decoration-white"
    : "text-primary underline decoration-primary/40 hover:decoration-primary";

  const codeClass = isOutbound
    ? "bg-white/15 px-1 py-0.5 rounded font-mono text-[12.5px]"
    : "bg-muted/70 px-1 py-0.5 rounded font-mono text-[12.5px]";

  const preClass = isOutbound
    ? "bg-white/10 p-2 rounded-md font-mono text-[12px] overflow-x-auto"
    : "bg-muted/70 p-2 rounded-md font-mono text-[12px] overflow-x-auto";

  // Inject minimal styles for the rendered HTML
  const styledHtml = safeHtml
    .replace(/<b>/gi, '<span class="font-semibold">')
    .replace(/<\/b>/gi, '</span>')
    .replace(/<strong>/gi, '<span class="font-semibold">')
    .replace(/<\/strong>/gi, '</span>')
    .replace(/<i>/gi, '<span class="italic">')
    .replace(/<\/i>/gi, '</span>')
    .replace(/<em>/gi, '<span class="italic">')
    .replace(/<\/em>/gi, '</span>')
    .replace(/<u>/gi, '<span class="underline">')
    .replace(/<\/u>/gi, '</span>')
    .replace(/<s>/gi, '<span class="line-through">')
    .replace(/<\/s>/gi, '</span>')
    .replace(/<strike>/gi, '<span class="line-through">')
    .replace(/<\/strike>/gi, '</span>')
    .replace(/<del>/gi, '<span class="line-through">')
    .replace(/<\/del>/gi, '</span>')
    .replace(/<code>/gi, `<code class="${codeClass}">`)
    .replace(/<\/code>/gi, '</code>')
    .replace(/<pre>/gi, `<pre class="${preClass}">`)
    .replace(/<\/pre>/gi, '</pre>')
    .replace(/<a\s+href="([^"]+)"([^>]*)>/gi, (_m, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass}">`)
    .replace(/<a\s+href='([^']+)'([^>]*)>/gi, (_m, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass}">`);

  return (
    <span
      className="whitespace-pre-wrap break-words text-[13.5px] sm:text-[14px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: styledHtml }}
    />
  );
}
