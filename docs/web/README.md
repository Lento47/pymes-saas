# Documentacion Frontend (web client)

Este directorio contiene documentacion especifica del cliente web (`apps/web/client`) que vive en la rama `main-web`.

## Contenido

- [`design-system.md`](./design-system.md) — sistema de diseno, tokens, componentes y guia de UI.
- [`cloudflare-deployment.md`](./cloudflare-deployment.md) — despliegue del frontend a Cloudflare Pages: build, env vars, dominios.

## Que vive en main-api (no aqui)

Toda la documentacion cross-cutting (legal, contratos, politicas, business, operations, templates, security audits, deployment del API a Railway) vive en `main-api/docs/`. Esta separacion sigue la regla del proyecto: **frontend → main-web, backend → main-api, sin mezcla**.

Si necesitas contratos, T&C, politicas internas, guia fiscal CR, SLAs, o specs del API, cambia a la rama `main-api` y revisa `docs/`.
