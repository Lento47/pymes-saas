import { useCallback, useRef, useState } from "react";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://maps.pymeshub.lat/styles/pymeshub/style.json";

type MapStatus = "loading" | "ready" | "error";

export default function MapPage() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  const attachMap = useCallback((container: HTMLDivElement | null) => {
    if (!container) {
      mapRef.current?.remove();
      mapRef.current = null;
      return;
    }

    if (mapRef.current) return;

    let loaded = false;
    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: [-84.0907, 9.9281],
      zoom: 7,
    });

    map.addControl(new NavigationControl(), "top-right");
    map.once("load", () => {
      loaded = true;
      setStatus("ready");
    });
    map.on("error", () => {
      if (!loaded) setStatus("error");
    });

    mapRef.current = map;
  }, []);

  return (
    <main className="min-h-screen bg-[#05091d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <a className="text-lg font-semibold tracking-tight text-white" href="/">
            PymesHub
          </a>
          <a
            className="text-sm text-amber-300 underline-offset-4 hover:underline"
            href={STYLE_URL}
            rel="noreferrer"
            target="_blank"
          >
            Ver estilo JSON
          </a>
        </header>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            MapLibre
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Mapa PymesHub</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Vista web del mapa que usa la aplicación móvil.
          </p>
        </section>

        <section
          aria-label="Mapa interactivo de PymesHub"
          className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/30"
        >
          {status === "loading" && (
            <p className="absolute left-4 top-4 z-10 rounded-full bg-[#05091d]/90 px-3 py-1.5 text-xs text-slate-200">
              Cargando mapa…
            </p>
          )}
          {status === "error" && (
            <p className="absolute inset-x-4 top-4 z-10 rounded-xl bg-red-950/95 px-4 py-3 text-sm text-red-100">
              No se pudo cargar el mapa. Intenta de nuevo en unos minutos.
            </p>
          )}
          <div ref={attachMap} className="h-[72vh] min-h-[420px] w-full" />
        </section>

        <p className="text-xs text-slate-400">© OpenMapTiles © OpenStreetMap contributors</p>
      </div>
    </main>
  );
}
