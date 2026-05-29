/**
 * Converts standard markdown to WhatsApp's limited markdown dialect.
 *
 * WhatsApp rules:
 *   *bold*   _italic_   ~strikethrough~   `mono`   ```block```   > quote
 *   No spaces between markers and text: `* bad *` won't render.
 *
 * Standard → WhatsApp mappings:
 *   **text** / __text__  → *text*
 *   *text* (single)      → _text_
 *   ~~text~~             → ~text~
 *   # / ## / ### Heading → *Heading*
 *   [text](url)          → text (url)
 *   Code blocks and inline code preserved as-is.
 */
export function toWhatsAppMarkdown(text: string): string {
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let result = text
    .replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `\x00CB${codeBlocks.length - 1}\x00`;
    })
    .replace(/`[^`\n]+`/g, (match) => {
      inlineCodes.push(match);
      return `\x00IC${inlineCodes.length - 1}\x00`;
    });

  // Italic first (single *) so double ** doesn't get partially consumed
  result = result.replace(/(?<!\*)\*(?!\*)(?!\s)((?:[^*\n]|\*(?!\*))+?)(?<!\s)\*(?!\*)/g, "_$1_");
  // Bold
  result = result
    .replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, "*$1*")
    .replace(/__(?!\s)([^_\n]+?)(?<!\s)__/g, "*$1*");
  // Strikethrough
  result = result.replace(/~~(?!\s)([^~\n]+?)(?<!\s)~~/g, "~$1~");
  // Headings → bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  // Links → text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  return result
    .replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[Number(i)])
    .replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);
}

// ── Telegram HTML ─────────────────────────────────────────────────────────────

/**
 * Converts standard markdown to Telegram's HTML parse_mode format.
 *
 * Telegram HTML tags: <b>, <i>, <s>, <u>, <code>, <pre>, <blockquote>, <a href>
 * Plain text must have &, <, > escaped as HTML entities.
 *
 * Standard → Telegram HTML mappings:
 *   **text** / __text__  → <b>text</b>
 *   *text* (single)      → <i>text</i>
 *   ~~text~~             → <s>text</s>
 *   `code`               → <code>code</code>
 *   ```lang\nblock```    → <pre><code class="language-lang">block</code></pre>
 *   # / ## Heading       → <b>Heading</b>
 *   > quote              → <blockquote>quote</blockquote>
 *   [text](url)          → <a href="url">text</a>
 */
export function toTelegramHtml(text: string): string {
  const parts: string[] = [];

  function protect(html: string): string {
    parts.push(html);
    return `\x00P${parts.length - 1}\x00`;
  }

  let result = text;

  // Code blocks first
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, content) => {
    const escaped = htmlEscape(content.trim());
    const cls = lang ? ` class="language-${lang}"` : "";
    return protect(`<pre><code${cls}>${escaped}</code></pre>`);
  });

  // Inline code
  result = result.replace(/`([^`\n]+)`/g, (_, content) =>
    protect(`<code>${htmlEscape(content)}</code>`),
  );

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) =>
    protect(`<a href="${url}">${htmlEscape(linkText)}</a>`),
  );

  // Blockquotes (lines starting with >)
  result = result.replace(/^>\s*(.+)$/gm, (_, content) =>
    protect(`<blockquote>${htmlEscape(content.trim())}</blockquote>`),
  );

  // Italic *text* — before bold so ** doesn't interfere
  result = result.replace(
    /(?<!\*)\*(?!\*)(?!\s)((?:[^*\n]|\*(?!\*))+?)(?<!\s)\*(?!\*)/g,
    (_, content) => protect(`<i>${htmlEscape(content)}</i>`),
  );

  // Bold **text** / __text__
  result = result
    .replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, (_, content) =>
      protect(`<b>${htmlEscape(content)}</b>`),
    )
    .replace(/__(?!\s)([^_\n]+?)(?<!\s)__/g, (_, content) =>
      protect(`<b>${htmlEscape(content)}</b>`),
    );

  // Strikethrough ~~text~~
  result = result.replace(/~~(?!\s)([^~\n]+?)(?<!\s)~~/g, (_, content) =>
    protect(`<s>${htmlEscape(content)}</s>`),
  );

  // Headings → bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, (_, content) =>
    protect(`<b>${htmlEscape(content.trim())}</b>`),
  );

  // HTML-escape remaining plain text
  result = result.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );

  // Restore protected HTML segments
  return result.replace(/\x00P(\d+)\x00/g, (_, i) => parts[Number(i)]);
}

function htmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
