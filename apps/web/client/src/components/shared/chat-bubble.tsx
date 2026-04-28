import React, { useEffect } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "chat-bubble-snippet": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "api-url"?: string;
        placeholder?: string;
        "hide-branding"?: string;
      };
      "chat-page-snippet": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "api-url"?: string;
      };
    }
  }
}

const API_URL = 'https://1578dd23-e8cb-47b3-98bb-9edb625ef282.search.ai.cloudflare.com/';

const STYLE_CSS = `
  chat-bubble-snippet, chat-page-snippet {
    --search-snippet-primary-color: #4441fb;
    --search-snippet-primary-hover: #77bba4;
    --search-snippet-focus-ring: #e5acf1;
  }
  @media (prefers-color-scheme: dark) {
    chat-bubble-snippet, chat-page-snippet {
      --search-snippet-primary-color: #4441fb;
      --search-snippet-primary-hover: #77bba4;
      --search-snippet-focus-ring: #e5acf1;
    }
  }
`;

export function ChatBubble() {
  return (
    <>
      <chat-bubble-snippet api-url={API_URL} placeholder="Hello! How can I help you?" hide-branding="true" />
      <style dangerouslySetInnerHTML={{ __html: STYLE_CSS }} />
    </>
  );
}

export function ChatPage() {
  useEffect(() => {
    if (document.querySelector('script[src*="search-snippet"]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://1578dd23-e8cb-47b3-98bb-9edb625ef282.search.ai.cloudflare.com/assets/v0.0.38/search-snippet.es.js';
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);

  return (
    <>
      <chat-page-snippet api-url={API_URL} />
      <style dangerouslySetInnerHTML={{ __html: STYLE_CSS }} />
    </>
  );
}
