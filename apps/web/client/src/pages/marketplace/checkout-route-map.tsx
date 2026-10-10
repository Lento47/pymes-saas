import type { CartTotals } from "@pymeshub/shared";
import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker } from "maplibre-gl";

import { configureMapLibre, MAP_STYLE_URL } from "@/lib/maplibre-setup";

type Point = { lat: number; lng: number };
type Geometry = NonNullable<CartTotals["roadQuote"]>["geometry"];

function stopMarker(color: string, label: string): HTMLDivElement {
  const element = document.createElement("div");
  element.title = label;
  element.style.width = "16px";
  element.style.height = "16px";
  element.style.borderRadius = "50%";
  element.style.background = color;
  element.style.border = "3px solid white";
  element.style.boxShadow = "0 2px 6px rgba(0,0,0,.35)";
  return element;
}

/** The line comes only from the server's road geometry; two pins alone never imply a route. */
export default function CheckoutRouteMap({
  pickup,
  destination,
  geometry,
}: {
  pickup: Point;
  destination: Point;
  geometry: Geometry;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    let loaded = false;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: MAP_STYLE_URL,
        center: [pickup.lng, pickup.lat],
        zoom: 12,
        interactive: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    let removed = false;
    const dispose = () => {
      if (removed) return;
      removed = true;
      map.remove();
    };
    map.once("load", () => {
      loaded = true;
      map.addSource("delivery-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry },
      });
      map.addLayer({
        id: "delivery-route-outline",
        type: "line",
        source: "delivery-route",
        paint: { "line-color": "#fff", "line-width": 8 },
      });
      map.addLayer({
        id: "delivery-route-line",
        type: "line",
        source: "delivery-route",
        paint: { "line-color": "#d97706", "line-width": 4 },
      });
      new Marker({ element: stopMarker("#16a34a", "Local de retiro") })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map);
      new Marker({ element: stopMarker("#dc2626", "Dirección de entrega") })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);
      const bounds = new LngLatBounds();
      bounds.extend([pickup.lng, pickup.lat]);
      bounds.extend([destination.lng, destination.lat]);
      for (const coordinate of geometry.coordinates) bounds.extend(coordinate);
      map.fitBounds(bounds, { padding: 28, maxZoom: 15, duration: 0 });
    });
    map.on("error", () => {
      if (!loaded) {
        setFailed(true);
        dispose();
      }
    });
    return dispose;
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, geometry]);

  if (failed)
    return (
      <p className="text-xs text-muted-foreground">
        El mapa no está disponible. La distancia y el precio siguen en el
        resumen.
      </p>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <div
        ref={container}
        className="h-56 w-full"
        role="img"
        aria-label="Ruta vial estimada desde el local hasta tu dirección"
      />
      <div className="flex items-center justify-between gap-3 bg-card px-3 py-2 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 text-green-600">●</span>Local{" "}
          <span className="ml-3 mr-1 text-red-600">●</span>Entrega
        </span>
        <span>
          ©{" "}
          <a
            className="underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>
          {" · "}
          <a
            className="underline"
            href="https://openfreemap.org"
            target="_blank"
            rel="noreferrer"
          >
            OpenFreeMap
          </a>
        </span>
      </div>
    </div>
  );
}
