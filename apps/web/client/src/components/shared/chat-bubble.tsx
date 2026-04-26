import React from 'react';

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
      "style": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLStyleElement>,
        HTMLStyleElement
      >;
    }
  }
}

export function ChatBubble() {
  return (
    <>
      <chat-bubble-snippet
        api-url="https://1578dd23-e8cb-47b3-98bb-9edb625ef282.search.ai.cloudflare.com/"
        placeholder="Hello! How can I help you?"
        hide-branding="true"
      />
      <style dangerouslySetInnerHTML={{
        __html: `
        @media (prefers-color-scheme: dark) {
          chat-bubble-snippet {
            --search-snippet-primary-color: #4441fb;
            --search-snippet-primary-hover: #77bba4;
            --search-snippet-focus-ring: #e5acf1;
          }
        }
        chat-bubble-snippet {
          --search-snippet-primary-color: #4441fb;
          --search-snippet-primary-hover: #77bba4;
          --search-snippet-focus-ring: #e5acf1;
        }
      `}} />
    </>
  );
}
