import { useState, useEffect } from "react";
import { getAvatarUrl, type DiceBearStyle } from "@/lib/avatar";

/**
 * React hook for loading a privacy-safe DiceBear avatar URL.
 *
 * The identity is SHA-256 hashed before the URL is constructed,
 * so no personal data is ever sent to DiceBear's servers.
 *
 * @example
 *   const avatarUrl = useAvatarUrl(user.id);
 *   // → "https://api.dicebear.com/9.x/fun-emoji/svg?seed=ba7816bf..."
 *
 *   const contactAvatar = useAvatarUrl(contact.email, "initials");
 */
export function useAvatarUrl(
  identity: string | null | undefined,
  style?: DiceBearStyle,
) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    getAvatarUrl(identity, style).then((computedUrl) => {
      if (!cancelled) setUrl(computedUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [identity, style]);

  return url;
}
