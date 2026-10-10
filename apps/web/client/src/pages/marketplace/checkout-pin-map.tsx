import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";

import { configureMapLibre, MAP_STYLE_URL } from "@/lib/maplibre-setup";

type Point = { lat: number; lng: number };

/** The merchant and courier need a precise drop-off pin, even if the address is textual. */
export default function CheckoutPinMap({
  center,
  point,
  onPick,
}: {
  center: Point | null;
  point: Point | null;
  onPick: (point: Point) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const centerLat = center?.lat;
  const centerLng = center?.lng;

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: MAP_STYLE_URL,
        center: [centerLng ?? -84.0907, centerLat ?? 9.9281],
        zoom: centerLat != null && centerLng != null ? 13 : 7,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    let removed = false;
    const dispose = () => {
      if (removed) return;
      removed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (event) =>
      onPickRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng }),
    );
    let loaded = false;
    map.once("load", () => {
      loaded = true;
    });
    map.on("error", () => {
      if (!loaded) {
        setFailed(true);
        dispose();
      }
    });
    return dispose;
  }, [centerLat, centerLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!point) return;
    const dot = document.createElement("div");
    dot.title = "Punto de entrega";
    dot.style.cssText =
      "width:20px;height:20px;border-radius:50%;background:#d97706;border:3px solid white;box-shadow:0 2px 7px #0008";
    markerRef.current = new Marker({ element: dot })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
  }, [point, centerLat, centerLng]);

  const useDevice = () => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        onPick(next);
        mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 16 });
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  if (failed)
    return (
      <p className="text-xs text-muted-foreground">
        El mapa no está disponible. Podés guardar la dirección escrita; una
        tarifa por carretera requiere un pin.
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <div
          ref={container}
          className="h-64 w-full"
          role="region"
          aria-label="Mapa para marcar el punto de entrega"
        />
        <p className="bg-card px-3 py-2 text-xs text-muted-foreground">
          Hacé clic o tocá el mapa para marcar la entrada donde debe llegar el
          repartidor. ©{" "}
          <a
            className="underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{" "}
          ·{" "}
          <a
            className="underline"
            href="https://protomaps.com"
            target="_blank"
            rel="noreferrer"
          >
            Protomaps
          </a>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useDevice}
          className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:border-primary/50"
        >
          Usar mi ubicación
        </button>
        <button
          type="button"
          onClick={() => {
            const center = mapRef.current?.getCenter();
            if (center) onPick({ lat: center.lat, lng: center.lng });
          }}
          className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:border-primary/50"
        >
          Fijar centro del mapa
        </button>
      </div>
      {point ? (
        <p role="status" className="text-xs text-muted-foreground">
          Punto de entrega marcado.
        </p>
      ) : null}
      {geoError ? (
        <p role="alert" className="text-xs text-muted-foreground">
          No pudimos obtener tu ubicación. Marcá el punto en el mapa.
        </p>
      ) : null}
    </div>
  );
}
