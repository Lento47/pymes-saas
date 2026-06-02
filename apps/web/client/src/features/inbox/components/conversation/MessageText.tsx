/**
 * MessageText — unified rich-text renderer for WhatsApp and Telegram messages.
 *
 * WhatsApp: parses *bold*, _italic_, ~strike~, `code`, ```block``` to React nodes.
 * Telegram: uses DOMParser allowlist (no dangerouslySetInnerHTML) to build React nodes.
 * Plain: URL-split with SensitiveText for leaf text.
 *
 * Security: no dangerouslySetInnerHTML. Telegram HTML is allowlisted via DOMParser;
 * only <b><i><u><s><code><pre><br><a href> pass through. All text nodes are wrapped
 * in SensitiveText for automatic secret redaction.
 */
import { useMemo } from "react";
import type React from "react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface MessageTextProps {
  text?: string | null;
  bodyHtml?: string | null;
  provider?: string | null;
  isOutbound: boolean;
  isShort: boolean;
  textCls: string;
  linkCls: string;
  codeCls: string;
  preCls: string;
}

// ── URL detection ──────────────────────────────────────────────────────────────
const URL_SPLIT_RE = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;

function segmentByUrls(text: string, linkCls: string, baseKey: number): React.ReactNode[] {
  const parts = text.split(URL_SPLIT_RE);
  const nodes: React.ReactNode[] = [];
  let k = baseKey;
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("http://") || part.startsWith("https://")) {
      nodes.push(
        <a key={k++} href={part} target="_blank" rel="noopener noreferrer" className={`break-all ${linkCls}`}>
          {part}
        </a>,
      );
    } else {
      nodes.push(<SensitiveText key={k++} text={part} />);
    }
  }
  return nodes;
}

// ── WhatsApp Markdown → React nodes ───────────────────────────────────────────

// Matches (in order of precedence):
//   1. ```block```
//   2. `inline`
//   3. **bold** (double asterisk, standard Markdown / AI output)
//   4. *bold*   (single asterisk, WhatsApp style)
//   5. _italic_
//   6. ~strike~
//   7. URL
//   8. \n
const WA_TOKEN_RE =
  /(```[\s\S]*?```|`[^`\n]+`|\*\*(?!\s)[^*\n]+?(?<!\s)\*\*|\*(?!\s)[^*\n]+?(?<!\s)\*|_(?!\s)[^_\n]+?(?<!\s)_|~(?!\s)[^~\n]+?(?<!\s)~|https?:\/\/[^\s<>"{}|\\^`[\]]+|\n)/g;

interface TextClasses { linkCls: string; codeCls: string; preCls: string }

function renderWAMarkdown(text: string, cls: TextClasses): React.ReactNode[] {
  if (!text) return [];
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  WA_TOKEN_RE.lastIndex = 0;

  while ((m = WA_TOKEN_RE.exec(text)) !== null) {
    // Plain text before this match
    if (m.index > lastIndex) {
      const plain = text.slice(lastIndex, m.index);
      nodes.push(...segmentByUrls(plain, cls.linkCls, key));
      key += 100;
    }

    const match = m[1];

    if (match.startsWith("```") && match.endsWith("```")) {
      const code = match.slice(3, -3).trim();
      nodes.push(<pre key={key++} className={cls.preCls}><code>{code}</code></pre>);
    } else if (match.startsWith("`") && match.endsWith("`")) {
      nodes.push(<code key={key++} className={cls.codeCls}>{match.slice(1, -1)}</code>);
    } else if (match.startsWith("**") && match.endsWith("**")) {
      nodes.push(<span key={key++} className="font-semibold">{match.slice(2, -2)}</span>);
    } else if (match.startsWith("*") && match.endsWith("*")) {
      nodes.push(<span key={key++} className="font-semibold">{match.slice(1, -1)}</span>);
    } else if (match.startsWith("_") && match.endsWith("_")) {
      nodes.push(<span key={key++} className="italic">{match.slice(1, -1)}</span>);
    } else if (match.startsWith("~") && match.endsWith("~")) {
      nodes.push(<span key={key++} className="line-through">{match.slice(1, -1)}</span>);
    } else if (match.startsWith("http")) {
      nodes.push(
        <a key={key++} href={match} target="_blank" rel="noopener noreferrer" className={`break-all ${cls.linkCls}`}>
          {match}
        </a>,
      );
    } else if (match === "\n") {
      nodes.push(<br key={key++} />);
    } else {
      nodes.push(<SensitiveText key={key++} text={match} />);
    }

    lastIndex = m.index + match.length;
  }

  if (lastIndex < text.length) {
    nodes.push(...segmentByUrls(text.slice(lastIndex), cls.linkCls, key));
  }

  return nodes;
}

// ── Telegram HTML → React nodes (DOMParser allowlist) ─────────────────────────

const SAFE_HREF_RE = /^https?:\/\/|^tg:\/\/|^mailto:/;

function domNodesToReact(nodes: NodeList, cls: TextClasses, depth: number): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let key = 0;

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) result.push(<SensitiveText key={key++} text={t} />);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = domNodesToReact(el.childNodes, cls, depth + 1);

    switch (tag) {
      case "b":
      case "strong":
        result.push(<span key={key++} className="font-semibold">{children}</span>);
        break;
      case "i":
      case "em":
        result.push(<span key={key++} className="italic">{children}</span>);
        break;
      case "u":
        result.push(<span key={key++} className="underline">{children}</span>);
        break;
      case "s":
      case "del":
      case "strike":
        result.push(<span key={key++} className="line-through">{children}</span>);
        break;
      case "code":
        result.push(<code key={key++} className={cls.codeCls}>{children}</code>);
        break;
      case "pre":
        result.push(<pre key={key++} className={cls.preCls}>{children}</pre>);
        break;
      case "br":
        result.push(<br key={key++} />);
        break;
      case "a": {
        const href = el.getAttribute("href") ?? "";
        if (SAFE_HREF_RE.test(href)) {
          result.push(
            <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={cls.linkCls}>
              {children}
            </a>,
          );
        } else {
          result.push(<span key={key++}>{children}</span>);
        }
        break;
      }
      default:
        // Unknown tags: render children only (strip the tag)
        if (children.length) result.push(<span key={key++}>{children}</span>);
    }
  });

  return result;
}

function parseTelegramHtml(html: string, cls: TextClasses): React.ReactNode[] {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    return domNodesToReact(doc.body.childNodes, cls, 0);
  } catch {
    // Fallback: strip tags and show plain text
    return [<SensitiveText key="fb" text={html.replace(/<[^>]*>/g, "")} />];
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MessageText({
  text,
  bodyHtml,
  provider,
  isShort,
  textCls,
  linkCls,
  codeCls,
  preCls,
}: MessageTextProps) {
  const isWhatsApp = provider === "WHATSAPP";
  const isTelegram = provider === "TELEGRAM";
  const cls: TextClasses = { linkCls, codeCls, preCls };

  const content = useMemo<React.ReactNode[]>(() => {
    if (isTelegram && bodyHtml) return parseTelegramHtml(bodyHtml, cls);
    if (bodyHtml && !isWhatsApp) return parseTelegramHtml(bodyHtml, cls);
    if (text) return renderWAMarkdown(text, cls);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, bodyHtml, isWhatsApp, isTelegram, linkCls, codeCls, preCls]);

  return (
    <div
      className={`whitespace-pre-wrap break-words text-[13.5px] sm:text-[14px] overflow-hidden ${isShort ? "leading-snug" : "leading-relaxed"} ${textCls}`}
    >
      {content}
    </div>
  );
}
