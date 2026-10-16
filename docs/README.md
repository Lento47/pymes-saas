# Documentación de PymesHub — marketplace y documentación heredada

## 1. Proposito

Este directorio reúne documentación del **marketplace de comercio local y entregas PymesHub** y documentos heredados de su etapa como SaaS B2B. **No todos los textos describen la arquitectura o las funcionalidades actuales.** La documentación histórica se conserva como referencia hasta su revisión; no debe interpretarse como prueba de que una integración, control o servicio esté desplegado.

Para la arquitectura vigente, consultar primero [`../README.md`](../README.md) y [`../AGENTS.md`](../AGENTS.md). Para el reporte externo de vulnerabilidades, el documento canónico es [`../SECURITY.md`](../SECURITY.md); las políticas de `legal/policies/` establecen criterios internos y no sustituyen ese canal de reporte.

## 2. Alcance y separacion por rama

En la rama principal `master`, el producto prioritario es el marketplace que conecta **clientes, comercios y repartidores**, con aplicaciones web y móvil, un cliente de escritorio y una API de Cloudflare Workers. La infraestructura principal utiliza D1, KV, R2 y Queues. **La migración no ha terminado:** `AGENTS.md` también identifica funciones operativas de consola y reportes de errores en NestJS/Railway y PostgreSQL. Esas superficies no deben omitirse de seguridad o respuesta a incidentes mientras sigan operativas.

Los documentos sobre inbox, CRM, OCR, IA, workspaces, facturación SaaS y la antigua separación `main-api`/`main-web` pueden referirse al producto anterior. Evaluar su vigencia por separado antes de utilizarlos para describir el marketplace o asumir compromisos con terceros. Las entidades centrales del marketplace son usuarios, comercios, sucursales, pedidos, repartidores y entregas.

Las referencias corporativas, fiscales y de privacidad requieren validación por las personas responsables. Este repositorio **no sustituye asesoría legal, fiscal ni regulatoria en Costa Rica**.

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
│   ├── api-deployment/             referencias heredadas de despliegue a Railway (verificar vigencia)
│   ├── api-spec/                   requisitos del producto (legal acceptance, auditoria, IA, OCR, multi-tenant)
│   ├── architecture/               diagramas, boundaries, Cloudflare, mapas y servicios externos
│   └── security-audits/            historial de remediaciones de seguridad
└── templates/                    ← PLANTILLAS REUTILIZABLES
    └── (onboarding, incidentes, privacidad, facturacion, ordenes de servicio)
```

## 4. Convenciones

### 4.1 Placeholders controlados

- `Otnel S.A.` — entidad legal a confirmar con los responsables
- `privacidad@pymeshub.lat` — contacto a verificar antes de publicarlo
- `pymeshub.lat` — dominio de la aplicación web documentada
- `Costa Rica` — jurisdicción que requiere validación legal según el caso

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

La topologia operativa de Cloudflare y el despliegue de mapas estan documentados en
[`technical/architecture/cloudflare-and-maps.md`](technical/architecture/cloudflare-and-maps.md).

## 7. Relacion con la rama frontend

**Estado actual:** `master` es la rama principal unificada. La regla histórica `main-web`/`main-api` ya no describe la organización activa del repositorio. Web y API Worker tienen despliegues diferenciados en Cloudflare; los procesos legados de Railway permanecen separados mientras se completa su retirada. Consulte los flujos de release reales antes de deducir qué se desplegó a producción a partir de un commit. El contenido de esta sección sustituye las indicaciones de ramas del paquete SaaS anterior.
