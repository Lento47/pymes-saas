import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

export interface MediaItem {
  url: string;
  type: "image" | "video" | "audio" | "document";
  caption?: string;
  filename?: string;
  mimeType?: string;
}

interface MediaViewerProps {
  items: MediaItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function MediaViewer({ items, initialIndex = 0, open, onClose }: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentItem = items[currentIndex];
  const hasMultiple = items.length > 1;

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
    }
  }, [open, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (hasMultiple) setCurrentIndex(i => Math.max(0, i - 1));
          break;
        case "ArrowRight":
          if (hasMultiple) setCurrentIndex(i => Math.min(items.length - 1, i + 1));
          break;
        case "+":
        case "=":
          setZoom(z => Math.min(5, z + 0.25));
          break;
        case "-":
          setZoom(z => Math.max(0.25, z - 0.25));
          break;
        case "r":
          setRotation(r => r + 90);
          break;
        case "0":
          setZoom(1);
          setRotation(0);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, hasMultiple, items.length, onClose]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
    setZoom(1);
    setRotation(0);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(i => Math.min(items.length - 1, i + 1));
    setZoom(1);
    setRotation(0);
  }, [items.length]);

  const handleDownload = useCallback(async () => {
    if (!currentItem?.url) return;
    try {
      const resp = await fetch(currentItem.url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = currentItem.filename || `media-${Date.now()}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(currentItem.url, "_blank");
    }
  }, [currentItem]);

  if (!open || !currentItem) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
        aria-label="Cerrar visor"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-16 z-10 flex items-center gap-1.5">
        {hasMultiple && (
          <span className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded-md">
            {currentIndex + 1} / {items.length}
          </span>
        )}
        <button
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          onClick={() => setZoom(z => Math.min(5, z + 0.25))}
          title="Acercar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          title="Alejar"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          onClick={() => setRotation(r => r + 90)}
          title="Rotar"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        {zoom !== 1 && (
          <button
            className="p-1.5 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors"
            onClick={() => { setZoom(1); setRotation(0); }}
            title="Restablecer"
          >
            1:1
          </button>
        )}
        <button
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          onClick={handleDownload}
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation arrows */}
      {hasMultiple && currentIndex > 0 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={handlePrev}
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasMultiple && currentIndex < items.length - 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={handleNext}
          aria-label="Siguiente"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Content */}
      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh] gap-3">
        {/* Image */}
        {currentItem.type === "image" && (
          <img
            src={currentItem.url}
            alt={currentItem.caption || "Imagen"}
            className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease",
              cursor: zoom > 1 ? "grab" : "default",
            }}
            draggable={false}
          />
        )}

        {/* Video */}
        {currentItem.type === "video" && (
          <video
            src={currentItem.url}
            controls
            autoPlay
            className="max-w-[85vw] max-h-[75vh] rounded-lg"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            Tu navegador no soporta video HTML.
          </video>
        )}

        {/* Audio */}
        {currentItem.type === "audio" && (
          <div className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-xl min-w-[320px]">
            <div className="text-white/60 text-sm">
              {currentItem.filename || "Mensaje de voz"}
            </div>
            <audio
              src={currentItem.url}
              controls
              autoPlay
              className="w-full max-w-[400px]"
            >
              Tu navegador no soporta audio HTML.
            </audio>
          </div>
        )}

        {/* Document */}
        {currentItem.type === "document" && (
          <div className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-xl min-w-[280px]">
            <div className="text-white/80 text-lg font-medium">
              {currentItem.filename || "Documento"}
            </div>
            {currentItem.mimeType && (
              <div className="text-white/40 text-sm">{currentItem.mimeType}</div>
            )}
            <button
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
          </div>
        )}

        {/* Caption */}
        {currentItem.caption && (
          <p className="text-white/60 text-sm max-w-lg text-center px-4">
            {currentItem.caption}
          </p>
        )}
      </div>

      {/* Thumbnail strip for multi-item */}
      {hasMultiple && items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto px-4">
          {items.map((item, i) => (
            <button
              key={i}
              className={`flex-shrink-0 w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${
                i === currentIndex
                  ? "border-white scale-110"
                  : "border-white/20 opacity-60 hover:opacity-100"
              }`}
              onClick={() => { setCurrentIndex(i); setZoom(1); setRotation(0); }}
            >
              {item.type === "image" && (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
              {item.type === "video" && (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-[8px]">
                  ▶
                </div>
              )}
              {item.type === "audio" && (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-[8px]">
                  ♪
                </div>
              )}
              {item.type === "document" && (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-[8px]">
                  DOC
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
