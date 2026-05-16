import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Caras",
    emojis: ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","😮","😯","😲","😳","🥺","😢","😭","😤","😠","😡","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  },
  {
    label: "Gestos",
    emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞","🤟","🤘","👌","🤌","🤏","👉","👈","👆","👇","☝️","✋","🤚","🖐","🖖","👋","🤙","💪","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","👀","👁","👅","👄"],
  },
  {
    label: "Corazones",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🫶","✨","🌟","⭐","🔥","💯"],
  },
  {
    label: "Objetos",
    emojis: ["🎉","🎊","🎈","🎁","🎀","🪄","🕯️","💡","🔦","🏆","🥇","🥈","🥉","⚽","🏀","🏈","⚾","🎾","🎮","🎯","🎲","🧩","📱","💻","⌨️","🖥️","🖨️","📷","📹","📸","📺","📡","🔔","📢","📣","🔒","🔓","🔑","🗝️","🔧","🔨","🪛","🔩","⚙️","🧰","🧲","🪜"],
  },
  {
    label: "Símbolos",
    emojis: ["✅","❌","❓","❗","❗️","‼️","⁉️","➕","➖","➗","✖️","♻️","📛","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🔝","🔜","🔛","🔚","🔙","🆗","🆕","🆓","🆒","🆙","🆗","🆔","🈁","🈵","🈶","🈷️","🈸","🈹","🈺","🉐","🉑"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmojiPicker({ onSelect, open, onOpenChange }: EmojiPickerProps) {
  const [category, setCategory] = useState(0);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
      <div
        className="absolute bottom-full left-0 mb-2 z-50 w-[320px] rounded-xl border border-border bg-card shadow-xl overflow-hidden"
      >
        {/* Category tabs */}
        <div className="flex gap-1 px-2 pt-2 pb-1 overflow-x-auto border-b border-border" style={{ scrollbarWidth: "none" }}>
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              className={cn(
                "px-2 py-1 text-[10px] rounded-md whitespace-nowrap transition-all shrink-0",
                i === category
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={() => setCategory(i)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="p-2 max-h-[200px] overflow-y-auto">
          <div className="flex flex-wrap gap-0.5">
            {EMOJI_CATEGORIES[category].emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                className="w-8 h-8 flex items-center justify-center text-base hover:bg-muted rounded-lg transition-colors"
                onClick={() => {
                  onSelect(emoji);
                  onOpenChange(false);
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
