# Paquete Documental Maestro de PymeHub

## 1. Proposito

Este directorio contiene la documentacion maestra de PymeHub como producto SaaS B2B multi-tenant orientado a pymes. El paquete cubre la capa contractual externa, las politicas internas de cumplimiento, la operacion del servicio, y las especificaciones tecnicas del API.

El objetivo no es teoria ni certificacion: es dejar el repositorio listo para operar con orden, demostrar control documental, y servir como base seria para validacion legal, fiscal, de privacidad, seguridad, soporte y producto.

## 2. Alcance y separacion por rama

Este paquete vive en `main-api` y aplica a:

- el sitio y dominio `[DOMINIO]`;
- el producto PymeHub (inbox, CRM, tareas, documentos, OCR, automatizaciones, IA, multi-tenant);
- la operacion de `[NOMBRE_EMPRESA]` en `[JURISDICCION]`;
- los clientes B2B de PymeHub;
- los miembros internos, contratistas y proveedores autorizados.

Documentacion **especifica del frontend** (design system, despliegue Cloudflare Pages) vive en `main-web/docs/web/`. Esa rama solo contiene docs frontend.

No sustituye asesoria legal, fiscal o regulatoria local.

## 3. Estructura

```
docs/
├── legal/                        ← LEGAL (cara externa + politicas internas)
│   ├── contracts/                  contratos: T&C, MSA, DPA, NDA, AUP, cancelacion, privacidad
│   ├── policies/                   politicas internas: seguridad, accesos, datos, incidentes, backups
│   └── corporate/                  figura legal, marca, checklist de cumplimiento pais
├── business/                     ← OPERACION COMERCIAL/FISCAL
│   ├── costa-rica-tax-invoicing-guide.md
│   ├── cabys-tax-matrix.md
│   ├── pricing-billing-policy.md
│   └── vendor-risk-register.md
├── operations/                   ← OPERACION DEL SERVICIO
│   └── (SLA, soporte, onboarding, offboarding, reclamos, releases, change mgmt)
├── risk/                         ← REGISTROS VIVOS
│   ├── risk-register.md
│   └── subprocessors-list.md
├── technical/                    ← INGENIERIA Y SPECS DEL API
│   ├── api-deployment/             despliegue del API a Railway
│   ├── api-spec/                   requisitos del producto (legal acceptance, auditoria, IA, OCR, multi-tenant)
│   ├── architecture/               diagramas, boundaries, third-party services
│   └── security-audits/            historial de remediaciones de seguridad
└── templates/                    ← PLANTILLAS REUTILIZABLES
    └── (onboarding, incidentes, privacidad, facturacion, ordenes de servicio)
```

## 4. Convenciones

### 4.1 Placeholders controlados

- `[NOMBRE_EMPRESA]`
- `[CORREO_LEGAL]`
- `[DOMINIO]`
- `[JURISDICCION]`

### 4.2 Estandar editorial

Cada documento debe incluir, en la medida aplicable: proposito, alcance, definiciones clave, roles, reglas, procedimiento, evidencia, excepciones, frecuencia de revision, control documental, relacion con otros documentos.

### 4.3 Control documental minimo

Por defecto en cada archivo: owner, ultima revision, proxima revision, estado (vigente / en revision / pendiente de validacion externa), version, dependencias.

## 5. Principios

- La documentacion esta adaptada a la operacion real, no a un SaaS generico.
- Se diferencia con claridad entre documentos externos al cliente (`legal/contracts/`), politicas internas (`legal/policies/`), specs tecnicas (`technical/api-spec/`) y operacion (`operations/`, `business/`).
- Ningun documento debe prometer algo que no se pueda sostener tecnicamente.
- Toda afirmacion relevante debe rastrearse a evidencia, flujo, control o backlog.
- Donde haya incertidumbre normativa, se documenta el criterio operativo y la necesidad de validacion externa.

## 6. Orden de uso recomendado

1. Completar placeholders corporativos y de jurisdiccion.
2. Validar `legal/contracts/` y `legal/corporate/` con asesoria local + contador.
3. Publicar paginas legales externas.
4. Convertir `technical/api-spec/compliance-implementation-backlog.md` en backlog tecnico priorizado.
5. Mantener `risk/risk-register.md`, `risk/subprocessors-list.md` y `business/vendor-risk-register.md` como registros vivos.
6. Versionar las politicas publicadas y conservar evidencia de aceptacion.

## 7. Relacion con la rama frontend

La regla del proyecto: **frontend → main-web, backend + cross-cutting → main-api, sin mezcla**. Cada push gatilla CI + deploy en su plataforma respectiva (Cloudflare Pages para `main-web`, Railway para `main-api`).
