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
    }
  }
}

export function ChatBubble() {
  return (
    <>
      <chat-bubble-snippet
        api-url="https://70b18965-6ccb-40df-902d-313de9c5c89e.search.ai.cloudflare.com/"
        placeholder="Hello! How can I help you?"
        hide-branding="true"
      />
      <style>{`
        chat-bubble-snippet {
          --search-snippet-primary-color: #4441fb;
          --search-snippet-primary-hover: #77bba4;
          --search-snippet-focus-ring: #e5acf1;
        }
      `}</style>
    </>
  );
}
