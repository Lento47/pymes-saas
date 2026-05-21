import { Injectable } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";

/**
 * Security utility for sanitizing HTML and rich-text input.
 *
 * Used to prevent XSS in message bodies, conversation subjects, and any
 * user-controlled content that will be rendered in the frontend.
 */

// Allow basic formatting tags — no scripts, no event handlers, no iframes
const DEFAULT_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "b", "i", "u", "s", "strong", "em", "p", "br",
    "ul", "ol", "li", "a", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Strip all non-whitelisted tags (don't escape — keep the text)
  disallowedTagsMode: "discard",
};

@Injectable()
export class SanitizeService {
  /**
   * Sanitize HTML content, stripping dangerous tags and attributes.
   * If the input is falsy, returns empty string.
   */
  html(input: string | null | undefined): string {
    if (!input) return "";
    return sanitizeHtml(input, DEFAULT_HTML_OPTIONS);
  }

  /**
   * Sanitize plain text — strip all HTML tags, return text only.
   */
  plainText(input: string | null | undefined): string {
    if (!input) return "";
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: "discard",
    });
  }

  /**
   * Sanitize a short text field (subject, name, etc.).
   * Strips ALL tags — no HTML allowed in these fields.
   */
  title(input: string | null | undefined): string {
    if (!input) return "";
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: "discard",
    }).trim();
  }
}
