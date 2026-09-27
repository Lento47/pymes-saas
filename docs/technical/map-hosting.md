# Alojamiento del mapa self-hosted — runbook

| Campo | Valor |
| --- | --- |
| Owner | Ingeniería |
| Estado | Pendiente de pasos de cuenta |
| Versión | 1.0 |
| Última revisión | 2026-09-25 |
| Próxima revisión | 2026-12-25 |

## Propósito

Cómo publicar un mapa **self-hosted** en Cloudflare para que la aplicación móvil y la web
carguen el mismo estilo, sin depender de un tercero para los mosaicos.

Documento operativo. La topología y el estado de la cuenta están en
[`architecture/cloudflare-and-maps.md`](./architecture/cloudflare-and-maps.md).

## Decisión de host

**`https://pymeshub.lat/api/map/*`** — mismo Worker que sirve la SPA (`pymeshubsaas`).

| Candidato | Veredicto | Por qué |
| --- | --- | --- |
| `app.pymeshub.lat/api/map/*` | **Descartado** | No existe. Sin registro DNS. Una URL ahí es carta muerta en cualquier build. |
| `maps.pymeshub.lat` | **Descartado por ahora** | Sí existe y sí sirve el estilo actual, pero es un **dominio personalizado de R2** (`pymeshub-maps`), no un Worker. Apuntarlo al Worker exige re-apuntar DNS y rompe el estilo vivo hasta que la ruta nueva responda. |
| `pymeshub.lat/api/map/*` | **Elegido** | Resuelve. Ya es el Worker `pymeshubsaas`. El router `/api/map/*` ya está escrito para este prefijo. Cero trabajo de DNS. |

`architecture/cloudflare-and-maps.md` listaba `maps.pymeshub.lat` como destino final. Se
mantiene como alternativa documentada: un segundo hostname sobre el mismo Worker, en un
cambio separado y con el estilo ya validado.

## Qué hay hoy (comprobado 2026-09-25)

```text
maps.pymeshub.lat  →  R2 pymeshub-maps (dominio personalizado)
   styles/pymeshub/style.json          →  200, 43.160 bytes, actualizado 2026-09-25
   sources.openmaptiles.url            →  https://tiles.openfreemap.org/planet   (zxy)
   glyphs                              →  https://tiles.openfreemap.org/fonts/…
   sprite                              →  https://tiles.openfreemap.org/sprites/ofm_f384/ofm
   atribución                          →  © OpenMapTiles © OpenStreetMap contributors
```

Funciona. **Pero los mosaicos vienen de OpenFreeMap**, un tercero. Eso es lo que este
runbook reemplaza: la decisión es mosaicos propios, sin proveedor externo.

Si la app móvil se veía el mapa en negro con esta URL, el estilo **no** es la causa — el
estilo responde `200`. La causa está en el alcance del mosaico (fuente zxy de un tercero),
en el componente nativo, o en que se probó bajo Expo Go, que no carga el módulo nativo.

## Los tres defectos de upstream que condicionan el diseño

Ninguno es teórico. Cada paso de este runbook existe por uno de ellos.

### 1. Un `Range` respondido con `200` mata al cliente
[maplibre-native#4374](https://github.com/maplibre/maplibre-native/issues/4374) —
`HTTPFileSource` amortigua **todo** el cuerpo de la respuesta *antes* de mirar el código de
estado. Un `Range: bytes=0-126` contestado con `200` y el archivo completo reserva el
archivo entero en RAM. Reportado en producción tras el CDN de Cloudflare, con un PMTiles de
~83 GB: OOM, cliente caído, mapa en negro.

De aquí sale la regla binaria del Worker (`apps/web/cloudflare-worker.js`):

```text
sin cabecera Range  →  200
con cabecera Range  →  206 o 416, NUNCA 200
```

Y por eso el archivo **no se cachea en el borde**: se sirve con
`Cache-Control: private, max-age=86400` y nunca se escribe en `caches.default`. Un `200`
*cacheado* es exactamente como vuelve el bug aunque el handler esté bien.

### 2. `internal_compression = gzip` → mapa vacío y silencioso
[maplibre-native#4462](https://github.com/maplibre/maplibre-native/issues/4462) — cada
mosaico falla con `incorrect header check`, la fuente y las capas se crean igual, **no se
lanza ninguna excepción**, y el mapa no dibuja nada.

Único fallo que no lo detecta ni el build ni un test. Se filtra con el paso de verificación
del encabezado antes de subir nada.

### 3. Evicción del caché de directorio en archivos grandes
[maplibre-native#4421](https://github.com/maplibre/maplibre-native/issues/4421) /
[#4629](https://github.com/maplibre/maplibre-native/pull/4629) — `invalid map<K, T> key`
cuando el caché de directorio expulsa una entrada que sigue en uso.

Por eso el extract se mantiene acotado: Costa Rica y `--maxzoom=14` (la banda del mapa en
móvil usa `STREET_ZOOM = 14`).

## Requisitos previos (pasos de cuenta, no de código)

1. **Crear el bucket R2 `pymeshub-map-assets`.**
   El binding ya está en `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "MAP_ASSETS"
   bucket_name = "pymeshub-map-assets"
   ```
2. **Añadir permiso de objeto R2 al token de `CLOUDFLARE_API_TOKEN`** usado por
   `.github/workflows/deploy-cloudflare.yml`.
   **Bloqueante.** `packages/trpc-api/wrangler.toml` registra que ese token hoy **no tiene
   alcance R2**. Sin esto el deploy falla.

Hasta que los dos pasos caigan, `/api/map/*` devuelve `404` y la app conserva el
comportamiento de "capacidad ausente" que ya tiene: sin mapa, sin error.

## 1. Conseguir y recortar el archivo

Canal v4 diario: `https://maps.protomaps.com/builds` (o el espejo `beta.source.coop`).

```bash
pmtiles extract INPUT.pmtiles basemap.pmtiles --bbox=-85.9,8.0,-82.5,11.3 --maxzoom=14
```

El nombre de salida es un argumento **posicional** — no existe `--output`.

Límites deliberados: Costa Rica, `--maxzoom=14`. Ampliar cobertura o zoom duplica tamaño y
es el caso que invita al defecto 3.

## 2. Puerta de compresión — **obligatoria**

```bash
pmtiles show basemap.pmtiles
```

`internal_compression` debe ser **distinto de `2` (gzip)**. Si es `2`, **no subir**: el mapa
quedará vacío y sin error (defecto 2).

## 3. Subir

```bash
# Archivo
wrangler r2 object put pymeshub-map-assets/map/basemap.pmtiles --file=basemap.pmtiles

# Tipografías — las 4 que referencia el estilo
#   Noto Sans Regular, Noto Sans Medium, Noto Sans Italic, Noto Sans Devanagari Regular v1
# Rango por tipografía: 0-255, 256-511, …, 65280-65535  (256 ficheros)
wrangler r2 object put \
  "pymeshub-map-assets/map/glyphs/Noto Sans Regular/0-255.pbf" --file=0-255.pbf

# Sprites (los 4)
wrangler r2 object put pymeshub-map-assets/map/sprite.json  --file=sprite.json
wrangler r2 object put pymeshub-map-assets/map/sprite.png   --file=sprite.png
wrangler r2 object put pymeshub-map-assets/map/sprite@2x.json --file=sprite@2x.json
wrangler r2 object put pymeshub-map-assets/map/sprite@2x.png  --file=sprite@2x.png
```

Fuente de tipografías y sprites:
[`protomaps/basemaps-assets`](https://github.com/protomaps/basemaps-assets) —
`https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf` y
`…/sprites/v4/light`. Es un espejo, no un trabajo desde cero.

Los nombres de tipografía llevan **espacios**. El Worker hace `decodeURIComponent` del
segmento y monta la clave R2 con el nombre decodificado; las claves llevan espacios.

Esquema de claves:

```text
map/basemap.pmtiles
map/glyphs/{fontstack}/{range}.pbf
map/sprite.json   map/sprite.png
map/sprite@2x.json   map/sprite@2x.png
```

## 4. Verificar el comportamiento de rangos — **obligatoria**

```bash
curl -sD- -o /dev/null -H 'Range: bytes=0-99' https://pymeshub.lat/api/map/basemap.pmtiles
```

Debe imprimir `HTTP/2 206` y `content-range: bytes 0-99/<tamaño>`.

**`200` aquí es el bug que mata al cliente** (defecto 1). Arreglar antes de apuntar
cualquier dispositivo. Repetir con un rango abierto y con uno invertido:

```bash
curl -sD- -o /dev/null -H 'Range: bytes=0-'     https://pymeshub.lat/api/map/basemap.pmtiles  # 206
curl -sD- -o /dev/null -H 'Range: bytes=99999999999-' https://pymeshub.lat/api/map/basemap.pmtiles  # 416
curl -sI https://pymeshub.lat/api/map/basemap.pmtiles  # sin Range → 200, Accept-Ranges: bytes
```

## 5. Resto de la superficie

```bash
curl -sI https://pymeshub.lat/api/map/style.json
#   Cache-Control: public, max-age=300
#   sources.protomaps.url = pmtiles://https://pymeshub.lat/api/map/basemap.pmtiles
curl -sI https://pymeshub.lat/            # sigue siendo la SPA, index.html
curl -s  https://pymeshub.lat/api/map/nope  # 404 en texto plano, NO index.html
```

Ese último es deliberado: `not_found_handling = "single-page-application"` devolvería
`index.html` y MapLibre intentaría leerlo como PBF.

## Estilo

`apps/web/map/style.json` se genera y **se versiona**. El Worker lo importa en tiempo de
bundle y sustituye `{BASE}` por el origen de la petición, así un solo fichero sirve
`pymeshub.lat`, `workers.dev` y `wrangler dev` sin regenerar nada.

```bash
node scripts/generate-map-style.mjs
```

Ejecutar cuando cambie el esquema del archivo o la versión de `@protomaps/basemaps`, no en
cada deploy. Capas de Protomaps (`earth`, `water`, `landuse`, `roads`, `buildings`,
`places`, `pois`), `lang: "es"`, sabor `light`, `center: [-84.0907, 9.9281]`, `zoom: 14`.

## Atribución

ODbL §4.3 liga el crédito a la **obra derivada**. Autoalojar no lo descarga.

- **Estilo** (`sources.protomaps.attribution`): crédito completo con enlaces — es lo que
  alimenta el diálogo ⓘ del SDK.
- **Pantalla** (`apps/web/client/src/pages/map.tsx` y `packages/i18n` →
  `discovery.map.attribution`): `"© OpenStreetMap contributors · ODbL"`, siempre visible,
  **sin meter en el estilo**. `packages/i18n/src/messages/es/discovery.ts` explica por qué
  y esa cadena no debe cambiar.

El estilo anterior atribuía `© OpenMapTiles © OpenStreetMap contributors`, que era correcto
*para ese estilo* (esquema OpenMapTiles vía OpenFreeMap). Con Protomaps es otro esquema y
otro crédito.

## Verificación nativa (móvil)

Necesita **dev build**. Expo Go no carga el módulo nativo — `apps/mobile/components/map.tsx`
documenta ese fallo exacto.

1. Mantener el valor estable `https://maps.pymeshub.lat/styles/pymeshub/style.json` durante
   la preparación. Cambiar `EXPO_PUBLIC_MAP_STYLE_URL` a
   `https://pymeshub.lat/api/map/style.json` solo después de que el estilo responda JSON y
   las pruebas `Range` del paso 4 pasen en producción.
2. `pnpm --filter mobile android` en un emulador con ubicación concedida.
3. Hero de descubrimiento: banda en z14, crédito `© OpenStreetMap contributors · ODbL`
   abajo-izquierda, ⓘ del SDK abajo-derecha.
4. Seguimiento de pedido: pin del repartidor sobre el basemap.
5. `logcat` limpio de `incorrect header check` (defecto 2) y de `std::bad_alloc` (defecto 1).

### Capacidad ausente

Limpiar `EXPO_PUBLIC_MAP_STYLE_URL` → el hero mantiene altura y espaciado, sin frame y sin
hueco. Es el contrato de `map.tsx` y `lib/env.ts`. Se rompe con cualquier URL inválida, no
solo con la ausente.

## Rollback

El estilo es el punto de cambio. Si un PMTiles nuevo falla, se restaura el estilo anterior:
la URL no cambia y **no hace falta recompilar** la app.

Para volver al mapa de OpenFreeMap:

```text
EXPO_PUBLIC_MAP_STYLE_URL="https://maps.pymeshub.lat/styles/pymeshub/style.json"
```

…y revertir la atribución de `map.tsx` al crédito OpenMapTiles. Esa URL sigue viva.

## Pruebas del Worker

`apps/web/cloudflare-worker.test.js` — 25 casos. Lo que protegen:

- `parseRange` puro: cerrado, abierto, sufijo, clamp, insatisfiable, basura.
- **`Range` nunca produce `200`** — el defecto 1 hecho mecánico.
- El archivo nunca se cachea en el borde (`private`).
- `/api/map/*` no reconocido responde `404` y **no** cae a la SPA.
- Ninguna petición pide al bucket una clave fuera de `map/` (incluye `%2e%2e%2f` y `%2f`,
  que `new URL()` **no** normaliza).

```bash
pnpm --filter web exec vitest run ../cloudflare-worker.test.js
```

## Referencias

- [Cloudflare R2: API de Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Cloudflare Workers: límites de plataforma](https://developers.cloudflare.com/workers/platform/limits/) — 25 MiB por fichero de assets, la razón de vivir en R2
- [maplibre-native#4374](https://github.com/maplibre/maplibre-native/issues/4374) · [#4462](https://github.com/maplibre/maplibre-native/issues/4462) · [#4421](https://github.com/maplibre/maplibre-native/issues/4421)
- [Protomaps: descargas](https://docs.protomaps.com/basemaps/downloads) · [guía MapLibre](https://docs.protomaps.com/basemaps/maplibre)
- [ODbL §4.3](https://opendatacommons.org/licenses/odbl/1-0/) — la obligación de crédito
