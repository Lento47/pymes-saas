import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/arc/button/button";

export function AccountAvatar({
  className,
  showError = false,
  onPick,
  pickLabel,
}: {
  className?: string;
  showError?: boolean;
  /** When set, avatar becomes an upload control (not a link). */
  onPick?: () => void;
  pickLabel?: string;
}) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const storedUrl = user?.avatar_url;
  const protectedImage = !!storedUrl?.startsWith("/api/users/");
  const photo = useQuery({
    queryKey: ["account-avatar", user?.id, user?.workspace.id, storedUrl],
    queryFn: () => api.getUserAvatar(user!.id),
    enabled: !!user && protectedImage,
    gcTime: 0,
    retry: false,
  });
  const [object, setObject] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [failedSrc, setFailedSrc] = useState<string>();
  useEffect(() => {
    if (!photo.data || !protectedImage) return;
    const url = URL.createObjectURL(photo.data);
    setObject({ blob: photo.data, url });
    return () => URL.revokeObjectURL(url);
  }, [photo.data, protectedImage]);

  // OAuth photos remain external, with no token or referrer attached. Uploaded
  // photos are fetched through the API client with auth and workspace headers.
  const src = protectedImage
    ? object?.blob === photo.data
      ? object?.url
      : undefined
    : storedUrl?.startsWith("https://")
      ? storedUrl
      : undefined;
  const failed = photo.isError || (!!src && failedSrc === src);
  const avatar = (
    <Avatar
      className={className}
      aria-busy={protectedImage && photo.isFetching}
    >
      {src && (
        <AvatarImage
          src={src}
          className="object-cover"
          alt={es ? "Tu foto de perfil" : "Your profile photo"}
          referrerPolicy="no-referrer"
          onLoadingStatusChange={(state) => {
            if (state === "error") setFailedSrc(src);
          }}
        />
      )}
      <AvatarFallback className="bg-foreground font-semibold text-background">
        {user?.name?.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
  return (
    <div className="shrink-0">
      {onPick ? (
        <button
          type="button"
          onClick={onPick}
          aria-label={pickLabel || (es ? "Cambiar foto de perfil" : "Change profile photo")}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      {showError && failed && (
        <div className="mt-2 max-w-52 text-sm">
          <p role="status">
            {es
              ? "No se pudo cargar tu foto."
              : "Your photo could not be loaded."}
          </p>
          {protectedImage && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={photo.isFetching}
              onClick={() => {
                setFailedSrc(undefined);
                void photo.refetch();
              }}
            >
              {es ? "Reintentar" : "Try again"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
