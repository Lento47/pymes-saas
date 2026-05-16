import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";

/** Compact notification bell icon with unread badge + dropdown panel */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: api.getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => api.getNotifications(),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.markRead({ ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markRead({ all: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.data ?? notifData ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded hover:bg-white/5 transition-colors"
        title="Notificaciones"
        style={{ color: "hsl(var(--fg-2))" }}
      >
        <Bell style={{ width: 16, height: 16 }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "hsl(var(--accent))",
              color: "white",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              transform: "translate(2px, -2px)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown panel */}
          <div
            className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md shadow-lg"
            style={{
              width: 340,
              maxHeight: 400,
              background: "hsl(var(--bg-card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: "1px solid hsl(var(--border))" }}
            >
              <span className="text-xs font-semibold text-white">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "hsl(var(--accent))" }}
                >
                  <CheckCheck style={{ width: 12, height: 12 }} />
                  Marcar todas leídas
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[340px]">
              {notifications.length === 0 ? (
                <div
                  className="text-xs text-center py-8 px-3"
                  style={{ color: "hsl(var(--fg-3))" }}
                >
                  Sin notificaciones
                </div>
              ) : (
                notifications.map((n: any) => (
                  <NotifItem
                    key={n.id}
                    notification={n}
                    onMarkRead={() => markRead.mutate([n.id])}
                  />
                ))
              )}
            </div>

            {/* Footer link */}
            {notifications.length > 0 && (
              <div
                className="px-3 py-2"
                style={{ borderTop: "1px solid hsl(var(--border))" }}
              >
                <Link
                  href="/notifications"
                  className="text-xs flex items-center gap-1 hover:underline"
                  style={{ color: "hsl(var(--fg-2))" }}
                  onClick={() => setOpen(false)}
                >
                  Ver todas <ExternalLink style={{ width: 10, height: 10 }} />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Single notification item ── */

function NotifItem({
  notification: n,
  onMarkRead,
}: {
  notification: any;
  onMarkRead: () => void;
}) {
  const [hovering, setHovering] = useState(false);

  const timeAgo = n.created_at
    ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })
    : "";

  const isUnread = !n.read_at;
  const body = n.body ?? n.title ?? "";
  const title = n.title ?? n.type ?? "";

  return (
    <div
      className="px-3 py-2.5 transition-colors"
      style={{
        borderBottom: "1px solid hsl(var(--border))",
        background: isUnread ? "hsl(var(--bg-active) / 0.4)" : "transparent",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-start gap-2">
        <div
          className="shrink-0 mt-1"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isUnread ? "hsl(var(--accent))" : "transparent",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-white truncate">
              {title}
            </span>
            {hovering && isUnread && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                className="shrink-0 p-0.5 rounded hover:bg-white/10"
                style={{ color: "hsl(var(--fg-3))" }}
                title="Marcar como leída"
              >
                <X style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
          {body && (
            <p
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: "hsl(var(--fg-2))" }}
            >
              {body}
            </p>
          )}
          {timeAgo && (
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "hsl(var(--fg-3))" }}
            >
              {timeAgo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
