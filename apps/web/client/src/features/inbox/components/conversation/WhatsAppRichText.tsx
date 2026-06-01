import { useMemo } from "react";

interface WhatsAppRichTextProps {
  text: string;
  isOutbound?: boolean;
}

/**
 * Converts WhatsApp markdown (*bold*, _italic_, ~strike~, `code`, ```blocks```)
 * into safe HTML for rendering.
 * This is a lightweight converter (no external deps).
 */
function whatsappMarkdownToHtml(text: string): string {
  if (!text) return "";

  let result = text;

  // Protect code blocks first
  const codeBlocks: string[] = [];
  result = result.replace(/```([\s\S]*?)```/g, (_, content) => {
    const escaped = content.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    codeBlocks.push(escaped);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Protect inline code
  const inlineCodes: string[] = [];
  result = result.replace(/`([^`]+)`/g, (_, content) => {
    const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    inlineCodes.push(escaped);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  // Strikethrough ~text~
  result = result.replace(/~(?!\s)([^~\n]+?)(?<!\s)~/g, "<s>$1</s>");

  // Bold *text* (handle ** too for safety)
  result = result
    .replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, "<b>$1</b>")
    .replace(/(?<!\*)\*(?!\*)(?!\s)((?:[^*\n]|\*(?!\*))+?)(?<!\s)\*(?!\*)/g, "<b>$1</b>");

  // Italic _text_
  result = result.replace(/_(?!\s)([^_\n]+?)(?<!\s)_/g, "<i>$1</i>");

  // Restore code blocks
  result = result.replace(/\x00CB(\d+)\x00/g, (_, i) => {
    const content = codeBlocks[Number(i)];
    return `<pre><code>${content}</code></pre>`;
  });

  // Restore inline code
  result = result.replace(/\x00IC(\d+)\x00/g, (_, i) => {
    const content = inlineCodes[Number(i)];
    return `<code>${content}</code>`;
  });

  // Escape remaining special chars for safety
  result = result
    .replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Re-apply our tags (they were escaped above)
  result = result
    .replace(/&lt;(\/?(b|i|s|code|pre))&gt;/g, "<$1>")
    .replace(/&lt;code&gt;/g, "<code>")
    .replace(/&lt;\/code&gt;/g, "</code>")
    .replace(/&lt;pre&gt;/g, "<pre>")
    .replace(/&lt;\/pre&gt;/g, "</pre>");

  return result;
}

export function WhatsAppRichText({ text, isOutbound }: WhatsAppRichTextProps) {
  const html = useMemo(() => whatsappMarkdownToHtml(text), [text]);

  const linkClass = isOutbound
    ? "text-white/90 underline decoration-white/40 hover:decoration-white"
    : "text-primary underline decoration-primary/40 hover:decoration-primary";

  const codeClass = isOutbound
    ? "bg-white/15 px-1 py-0.5 rounded font-mono text-[12.5px]"
    : "bg-muted/70 px-1 py-0.5 rounded font-mono text-[12.5px]";

  const preClass = isOutbound
    ? "bg-white/10 p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1"
    : "bg-muted/70 p-2 rounded-md font-mono text-[12px] overflow-x-auto my-1";

  // Add nice styling to the converted HTML
  const styledHtml = html
    .replace(/<b>/g, '<span class="font-semibold">')
    .replace(/<\/b>/g, "</span>")
    .replace(/<i>/g, '<span class="italic">')
    .replace(/<\/i>/g, "</span>")
    .replace(/<s>/g, '<span class="line-through">')
    .replace(/<\/s>/g, "</span>")
    .replace(/<code>/g, `<code class="${codeClass}">`)
    .replace(/<\/code>/g, "</code>")
    .replace(/<pre><code>/g, `<pre class="${preClass}"><code>`)
    .replace(/<\/code><\/pre>/g, "</code></pre>")
    // Links are rare in raw WA text, but handle if present
    .replace(/<a\s+href="([^"]+)"([^>]*)>/gi, (_m, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass}">`);

  return (
    <span
      className="whitespace-pre-wrap break-words text-[13.5px] sm:text-[14px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: styledHtml }}
    />
  );
}
