import { addProtocol, setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// The self-hosted style still points at an absent PMTiles archive. Production uses
// the existing R2 style; other origins use its CORS-enabled tile provider directly.
const productionOrigin =
  typeof window !== "undefined" &&
  ["https://pymeshub.lat", "https://www.pymeshub.lat"].includes(
    window.location.origin,
  );
export const MAP_STYLE_URL = productionOrigin
  ? "https://maps.pymeshub.lat/styles/pymeshub/style.json"
  : "https://tiles.openfreemap.org/styles/liberty";

let configured = false;

/** PMTiles and the MapLibre worker are shared by every web map in this app. */
export function configureMapLibre(): void {
  if (configured) return;
  setWorkerUrl(mapLibreWorkerUrl);
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  configured = true;
}
