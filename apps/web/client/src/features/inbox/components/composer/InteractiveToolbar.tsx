import { useState } from "react";
import { MessageSquare, List, MapPin, FileText, X, Plus, Trash2 } from "lucide-react";

export type InteractiveType = "buttons" | "list" | "location_request" | "template" | null;

export interface InteractiveState {
  type: InteractiveType;
  // Buttons
  body?: string;
  footer?: string;
  buttons?: Array<{ id: string; title: string }>;
  // List
  listButtonText?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  // Location request
  locationBody?: string;
}

interface InteractiveToolbarProps {
  value: InteractiveState;
  onChange: (value: InteractiveState) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function InteractiveToolbar({
  value,
  onChange,
  onClose,
  disabled,
}: InteractiveToolbarProps) {
  const activeType = value.type;

  if (!activeType) return null;

  return (
    <div className="border-t border-border/60 bg-card/50 px-3 py-2.5 space-y-3 animate-in slide-in-from-bottom-1 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {activeType === "buttons" && "Botones de respuesta"}
          {activeType === "list" && "Mensaje de lista"}
          {activeType === "location_request" && "Solicitar ubicación"}
          {activeType === "template" && "Plantilla"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Cerrar editor interactivo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Button builder */}
      {activeType === "buttons" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Texto del mensaje"
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/40"
            disabled={disabled}
          />
          <input
            type="text"
            placeholder="Footer (opcional)"
            value={value.footer ?? ""}
            onChange={(e) => onChange({ ...value, footer: e.target.value || undefined })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/40"
            disabled={disabled}
          />
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground/60">Botones (máx 3)</span>
            {(value.buttons ?? []).map((btn, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="ID"
                  value={btn.id}
                  onChange={(e) => {
                    const btns = [...(value.buttons ?? [])];
                    btns[i] = { ...btns[i], id: e.target.value };
                    onChange({ ...value, buttons: btns });
                  }}
                  className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary/40"
                  disabled={disabled}
                />
                <input
                  type="text"
                  placeholder="Título"
                  value={btn.title}
                  onChange={(e) => {
                    const btns = [...(value.buttons ?? [])];
                    btns[i] = { ...btns[i], title: e.target.value };
                    onChange({ ...value, buttons: btns });
                  }}
                  className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary/40"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...value,
                      buttons: (value.buttons ?? []).filter((_, j) => j !== i),
                    });
                  }}
                  className="p-1 text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0"
                  disabled={disabled}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(value.buttons?.length ?? 0) < 3 && (
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    buttons: [...(value.buttons ?? []), { id: `btn_${Date.now()}`, title: "" }],
                  });
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors py-0.5"
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                Agregar botón
              </button>
            )}
          </div>
        </div>
      )}

      {/* List builder */}
      {activeType === "list" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Texto del mensaje"
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/40"
            disabled={disabled}
          />
          <input
            type="text"
            placeholder="Texto del botón (ej: 'Ver opciones')"
            value={value.listButtonText ?? ""}
            onChange={(e) => onChange({ ...value, listButtonText: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/40"
            disabled={disabled}
          />
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground/60">
              Secciones y filas (máx 10 secciones, 10 filas total)
            </span>
            {(value.sections ?? []).map((section, si) => (
              <div key={si} className="border border-border/40 rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Título de sección (opcional)"
                    value={section.title ?? ""}
                    onChange={(e) => {
                      const secs = [...(value.sections ?? [])];
                      secs[si] = { ...secs[si], title: e.target.value || undefined };
                      onChange({ ...value, sections: secs });
                    }}
                    className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/40"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        ...value,
                        sections: (value.sections ?? []).filter((_, j) => j !== si),
                      });
                    }}
                    className="p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors"
                    disabled={disabled}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {section.rows.map((row, ri) => (
                  <div key={ri} className="flex gap-1 ml-3">
                    <input
                      type="text"
                      placeholder="ID"
                      value={row.id}
                      onChange={(e) => {
                        const secs = [...(value.sections ?? [])];
                        const rows = [...secs[si].rows];
                        rows[ri] = { ...rows[ri], id: e.target.value };
                        secs[si] = { ...secs[si], rows };
                        onChange({ ...value, sections: secs });
                      }}
                      className="w-20 bg-background border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary/40"
                      disabled={disabled}
                    />
                    <input
                      type="text"
                      placeholder="Título"
                      value={row.title}
                      onChange={(e) => {
                        const secs = [...(value.sections ?? [])];
                        const rows = [...secs[si].rows];
                        rows[ri] = { ...rows[ri], title: e.target.value };
                        secs[si] = { ...secs[si], rows };
                        onChange({ ...value, sections: secs });
                      }}
                      className="flex-1 bg-background border border-border rounded px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary/40"
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const secs = [...(value.sections ?? [])];
                        secs[si] = { ...secs[si], rows: secs[si].rows.filter((_, j) => j !== ri) };
                        onChange({ ...value, sections: secs.filter(s => s.rows.length > 0) });
                      }}
                      className="p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors"
                      disabled={disabled}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const secs = [...(value.sections ?? [])];
                    secs[si] = {
                      ...secs[si],
                      rows: [...secs[si].rows, { id: `row_${Date.now()}`, title: "" }],
                    };
                    onChange({ ...value, sections: secs });
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors ml-3 py-0.5"
                  disabled={disabled}
                >
                  <Plus className="w-2.5 h-2.5" />
                  Agregar fila
                </button>
              </div>
            ))}
            {(value.sections?.length ?? 0) < 10 && (
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    sections: [
                      ...(value.sections ?? []),
                      { rows: [{ id: `row_${Date.now()}`, title: "" }] },
                    ],
                  });
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors py-0.5"
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                Agregar sección
              </button>
            )}
          </div>
        </div>
      )}

      {/* Location request */}
      {activeType === "location_request" && (
        <input
          type="text"
          placeholder="Mensaje (ej: 'Comparte tu ubicación para continuar')"
          value={value.locationBody ?? value.body ?? ""}
          onChange={(e) => onChange({ ...value, locationBody: e.target.value, body: e.target.value })}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/40"
          disabled={disabled}
        />
      )}
    </div>
  );
}
