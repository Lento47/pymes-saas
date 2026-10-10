import { addProtocol, setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

export const MAP_STYLE_URL = "https://pymeshub.lat/api/map/style.json";

let configured = false;

/** PMTiles and the MapLibre worker are shared by every web map in this app. */
export function configureMapLibre(): void {
  if (configured) return;
  setWorkerUrl(mapLibreWorkerUrl);
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  configured = true;
}
