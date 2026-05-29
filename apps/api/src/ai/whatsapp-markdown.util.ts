/**
 * Converts standard markdown to WhatsApp's limited markdown dialect.
 *
 * WhatsApp rules:
 *   *bold*   _italic_   ~strikethrough~   `mono`   ```block```   > quote
 *   No spaces between markers and text: `* bad *` won't render.
 *
 * Standard → WhatsApp mappings applied:
 *   **text** / __text__  → *text*
 *   *text* (single)      → _text_
 *   ~~text~~             → ~text~
 *   # / ## / ### Heading → *Heading*
 *   [text](url)          → text (url)
 *   Code blocks and inline code are preserved as-is.
 */
export function toWhatsAppMarkdown(text: string): string {
  // Protect code blocks and inline code from other transformations
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let result = text
    // Protect fenced code blocks first
    .replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `\x00CB${codeBlocks.length - 1}\x00`;
    })
    // Protect inline code
    .replace(/`[^`\n]+`/g, (match) => {
      inlineCodes.push(match);
      return `\x00IC${inlineCodes.length - 1}\x00`;
    });

  // Italic: single *text* — must not be preceded or followed by another *
  // Do this BEFORE bold so **bold** double-asterisks don't interfere
  result = result.replace(/(?<!\*)\*(?!\*)(?!\s)((?:[^*\n]|\*(?!\*))+?)(?<!\s)\*(?!\*)/g, "_$1_");

  // Bold: **text** or __text__
  result = result
    .replace(/\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/g, "*$1*")
    .replace(/__(?!\s)([^_\n]+?)(?<!\s)__/g, "*$1*");

  // Strikethrough: ~~text~~
  result = result.replace(/~~(?!\s)([^~\n]+?)(?<!\s)~~/g, "~$1~");

  // Headings: # / ## / ### at start of line → *text*
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Links: [text](url) → text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Restore placeholders
  result = result
    .replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[Number(i)])
    .replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);

  return result;
}
