# Topología de Cloudflare y mapas

| Campo | Valor |
| --- | --- |
| Owner | Ingeniería |
| Estado | Vigente |
| Versión | 1.0 |
| Última revisión | 2026-09-25 |
| Próxima revisión | 2026-12-25 |

## Propósito

Este documento define qué recurso de Cloudflare cumple cada función de PymesHub y cómo
se publica el mapa que usa la aplicación móvil. También separa el motor MapLibre de los
archivos cartográficos que consume.

La cuenta de Cloudflare contiene servicios de otros productos. No se deben renombrar,
reasignar ni eliminar durante cambios de PymesHub.

## Regla principal

MapLibre Native es una dependencia compilada dentro de las aplicaciones Android e iOS.
No se aloja en un Worker. Cloudflare aloja los recursos que MapLibre descarga:

- el documento de estilo;
- los mosaicos vectoriales o ráster;
- las tipografías;
- los sprites.

Un cambio en esos archivos puede publicarse sin recompilar la aplicación siempre que la
URL del estilo no cambie. Un cambio de versión de MapLibre o de su configuración nativa sí
requiere una nueva compilación Android/iOS.

## Estado comprobado

Estado observado el 2026-09-25:

| Recurso | Función actual | Estado |
| --- | --- | --- |
| Worker `pymeshubsaas` | Aplicación web principal | Activo en `pymeshub.lat` |
| R2 `pymeshub-maps` | Recursos del mapa | Activo en `maps.pymeshub.lat` |
| `styles/pymeshub/style.json` | Estilo que consume MapLibre | Responde `200` con TLS activo |
| R2 `pymeshub-media` | Archivos de producción | Sin dominio público directo |
| R2 `pymeshub-media-staging` | Archivos de staging | Sin dominio público directo |
| Worker `pymeshub-api` | API nueva en Cloudflare | Desplegado; sin dominio de producción conectado |
| Worker `pymeshub-api-staging` | API de staging | Activo en `api-staging.pymeshub.lat` |
| Pages `pymes-saas-admin` | Aplicación administrativa | Activo en `admin.pymeshub.lat` |
| Worker `outage-worker` | Página de contingencia | Aún tiene rutas antiguas para raíz y `www` |

Hallazgos que requieren una decisión separada:

- `www.pymeshub.lat` llega a `outage-worker` y responde `503`.
- `app.pymeshub.lat` no tiene DNS ni Worker asignado.
- `api.pymeshub.lat` todavía llega al fallback de Railway y responde `404` en `/health`.
- Existen Workers antiguos de PymesHub sin un dominio de producción. No se deben borrar
  hasta revisar tráfico, bindings, secretos y dependencias.

## Mapa actual

```text
Aplicación móvil
    │
    ├── MapLibre Native 11.4.0, compilado dentro de Android/iOS
    │
    └── https://maps.pymeshub.lat/styles/pymeshub/style.json
            │
            ├── estilo: Cloudflare R2
            └── tiles, fonts y sprites: OpenFreeMap
```

Este estado funciona y no necesita una llave pública. Todavía no es un mapa alojado por
completo en Cloudflare: solo el estilo está en R2.

## Topología objetivo

| Hostname | Recurso | Responsabilidad |
| --- | --- | --- |
| `pymeshub.lat` | Worker `pymeshubsaas` | Sitio y aplicación web principal |
| `www.pymeshub.lat` | Worker `pymeshubsaas` | Mismo contenido o redirección canónica |
| `app.pymeshub.lat` | Por definir | Página de instalación/deep links o PWA; no es el binario nativo |
| `api.pymeshub.lat` | Worker `pymeshub-api` | API de producción, después de validar la migración |
| `api-staging.pymeshub.lat` | Worker `pymeshub-api-staging` | API de staging |
| `admin.pymeshub.lat` | Pages `pymes-saas-admin` | Administración |
| `maps.pymeshub.lat` | R2 `pymeshub-maps` | Estilos, PMTiles, fuentes y sprites |
| `downloads.pymeshub.lat` | Worker `r2-guard` | Descargas protegidas |

Los buckets de medios permanecen privados. La API entrega URLs autorizadas cuando una
operación necesita leer o escribir un archivo.

## Mapa completamente alojado en Cloudflare

La estructura objetivo del bucket es:

```text
pymeshub-maps/
├── styles/pymeshub/style.json
├── styles/pymeshub/style-v1.json
├── tiles/costa-rica-YYYYMMDD.pmtiles
├── fonts/{fontstack}/{range}.pbf
└── sprites/pymeshub.{json,png}
```

La fuente principal del estilo debe apuntar a un archivo versionado:

```json
{
  "sources": {
    "pymeshub": {
      "type": "vector",
      "url": "pmtiles://https://maps.pymeshub.lat/tiles/costa-rica-YYYYMMDD.pmtiles"
    }
  }
}
```

La cobertura inicial recomendada es Costa Rica. Ampliar la cobertura cambia el tamaño del
archivo, el tiempo de generación, el almacenamiento y el costo de las lecturas. Esa decisión
se toma antes de descargar o generar datos.

## Llaves y acceso

- MapLibre no requiere una llave.
- Un bucket R2 público de solo lectura con dominio propio no requiere una llave en la app.
- Nunca se publica un token de Cloudflare bajo un nombre `EXPO_PUBLIC_*`.
- Los tokens de Cloudflare solo se usan en despliegues y administración.
- Cualquier llave incluida en una aplicación móvil debe considerarse pública.
- `maps.pymeshub.lat` permite CORS de lectura desde `https://app.pymeshub.lat`.
- El endpoint `r2.dev` del bucket permanece desactivado.

## Orden de implementación

1. Elegir la cobertura del mapa. Costa Rica es el punto de partida recomendado.
2. Generar o adquirir un PMTiles compatible con el esquema del estilo.
3. Subir el archivo con nombre versionado a `pymeshub-maps/tiles/`.
4. Subir las tipografías y sprites requeridos por el estilo.
5. Probar que R2 responde solicitudes HTTP Range para el PMTiles.
6. Crear un estilo candidato que use solo URLs de `maps.pymeshub.lat`.
7. Validar el estilo, atribución, etiquetas y zoom en Android e iOS.
8. Reemplazar el estilo estable solo después de esa validación.
9. Corregir `www.pymeshub.lat` y definir el propósito de `app.pymeshub.lat`.
10. Migrar `api.pymeshub.lat` en un cambio separado con prueba de salud y rollback.
11. Retirar rutas o Workers antiguos solo después de confirmar que no reciben tráfico.

## Verificación

Antes de declarar listo un cambio de mapas:

```powershell
curl.exe --head https://maps.pymeshub.lat/styles/pymeshub/style.json
curl.exe --head --header "Origin: https://app.pymeshub.lat" `
  https://maps.pymeshub.lat/styles/pymeshub/style.json
```

El estilo debe responder `200`. La segunda respuesta debe incluir
`Access-Control-Allow-Origin: https://app.pymeshub.lat`.

Para PMTiles se debe solicitar un rango y recibir `206 Partial Content`:

```powershell
curl.exe --header "Range: bytes=0-16383" `
  https://maps.pymeshub.lat/tiles/costa-rica-YYYYMMDD.pmtiles
```

La validación nativa mínima incluye:

- Expo prebuild sin errores;
- MapLibre presente en el autolinking de Android e iOS;
- una compilación de desarrollo o producción nueva;
- apertura del mapa en un dispositivo o emulador;
- atribución visible;
- prueba sin Expo Go, que no contiene el módulo nativo.

## Rollback

El archivo estable `styles/pymeshub/style.json` es el punto de cambio. Si un PMTiles nuevo
falla, se restaura la versión anterior del estilo. La aplicación conserva la misma URL y no
necesita una recompilación para volver al origen anterior.

Los cambios de dominios se revierten por separado. No se elimina una ruta anterior hasta que
el hostname nuevo responda, el certificado esté activo y la prueba de salud pase.

## Referencias

- [Cloudflare R2: buckets públicos y dominios propios](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2: configuración de CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [MapLibre React Native: configuración con Expo](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/)
- [OpenFreeMap](https://openfreemap.org/)

