import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Search, Inbox, Users, CheckSquare, FileText, Settings, Zap, KanbanSquare, Receipt, CircleHelp, MessageCircle, Mail } from "lucide-react";

type ApiConversation = { id: string; subject?: string; contact?: { full_name?: string; name?: string } };
type ApiContact = { id: string; full_name?: string; name?: string; email?: string; phone?: string };

type SearchResult = {
  type: "conversation" | "contact" | "page";
  label: string;
  description?: string;
  href: string;
};

const PAGE_RESULTS: SearchResult[] = [
  { type: "page", label: "Dashboard", href: "/" },
  { type: "page", label: "Bandeja de entrada", href: "/inbox", description: "Todas las conversaciones" },
  { type: "page", label: "Contactos", href: "/contacts" },
  { type: "page", label: "Tareas", href: "/tasks" },
  { type: "page", label: "Archivos", href: "/documents" },
  { type: "page", label: "Facturas", href: "/invoices" },
  { type: "page", label: "Pipeline", href: "/pipeline" },
  { type: "page", label: "Automatizaciones", href: "/automations" },
  { type: "page", label: "Configuración", href: "/settings" },
  { type: "page", label: "Ayuda", href: "/help" },
];

function getTypeIcon(type: string) {
  switch (type) {
    case "conversation": return <MessageCircle style={{ width: 14, height: 14 }} />;
    case "contact":     return <Users style={{ width: 14, height: 14 }} />;
    case "page":
    default:            return <FileText style={{ width: 14, height: 14 }} />;
  }
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(PAGE_RESULTS.slice(0, 6));
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGE_RESULTS);
      setSelectedIdx(0);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase();
        const pageHits = PAGE_RESULTS.filter(
          (r) => r.label.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q),
        );

        const [convRes, contactRes] = await Promise.all([
          api.getConversations({ q }).catch(() => ({ data: [], total: 0 })),
          api.getContacts().catch(() => []),
        ]);

        const convHits: SearchResult[] = (Array.isArray(convRes) ? convRes : convRes.data ?? [])
          .slice(0, 5)
          .map((c: ApiConversation) => ({
            type: "conversation" as const,
            label: c.subject || "Sin asunto",
            description: c.contact?.full_name || c.contact?.name || "Contacto desconocido",
            href: `/inbox/${c.id}`,
          }));

        const contacts: ApiContact[] = Array.isArray(contactRes) ? contactRes : contactRes.data ?? [];
        const contactHits: SearchResult[] = contacts
          .filter((c) =>
            c.full_name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q),
          )
          .slice(0, 3)
          .map((c) => ({
            type: "contact" as const,
            label: c.full_name || c.name || "Sin nombre",
            description: c.email || c.phone || "",
            href: `/contacts/${c.id}`,
          }));

        setResults([...pageHits, ...convHits, ...contactHits]);
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [query]);

  const navigateTo = useCallback(
    (href: string) => {
      onClose();
      navigate(href);
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      navigateTo(results[selectedIdx].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 rounded-lg shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))" }}
      >
        {/* Input */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <Search style={{ width: 16, height: 16, color: "hsl(var(--fg-3))", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, conversaciones, contactos..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[hsl(var(--fg-3))]"
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: "hsl(var(--fg-3))", background: "hsl(var(--elevated))", border: "1px solid hsl(var(--border))" }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="animate-spin rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid hsl(var(--border))",
                  borderTopColor: "hsl(var(--accent))",
                }}
              />
            </div>
          ) : results.length === 0 ? (
            <div
              className="text-xs text-center py-8"
              style={{ color: "hsl(var(--fg-3))" }}
            >
              Sin resultados para "{query}"
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.href}`}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  background: i === selectedIdx ? "hsl(var(--bg-active))" : "transparent",
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => navigateTo(r.href)}
              >
                <span style={{ color: "hsl(var(--fg-3))", flexShrink: 0 }}>
                  {getTypeIcon(r.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{r.label}</div>
                  {r.description && (
                    <div
                      className="text-[11px] truncate"
                      style={{ color: "hsl(var(--fg-3))" }}
                    >
                      {r.description}
                    </div>
                  )}
                </div>
                <span
                  className="text-[10px] uppercase shrink-0"
                  style={{ color: "hsl(var(--fg-3))", opacity: 0.6 }}
                >
                  {r.type === "conversation" ? "Chat" : r.type === "contact" ? "Contacto" : "Página"}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div
          className="flex items-center gap-4 px-4 py-2"
          style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--elevated))" }}
        >
          <span className="text-[10px]" style={{ color: "hsl(var(--fg-3))" }}>
            ↑↓ Navegar · Enter abrir · Esc cerrar
          </span>
        </div>
      </div>
    </>
  );
}
