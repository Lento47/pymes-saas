# ¿Qué es PymeHub?

PymeHub es una **plataforma operativa todo-en-uno** diseñada para pequeñas y medianas empresas (PyMEs) hispanohablantes. Centraliza en un solo lugar todo lo que necesitas para operar tu negocio: conversaciones con clientes, CRM, tareas, documentos, automatizaciones y facturación.

## El problema que resuelve

La mayoría de las PyMEs operan con herramientas fragmentadas: el email en un lugar, WhatsApp en el celular, las tareas en Excel, los documentos en Google Drive, y la facturación en otro sistema. Esto genera pérdida de información, tiempo desperdiciado cambiando entre apps, y una visión incompleta del negocio.

PymeHub unifica todo en una sola plataforma con inteligencia artificial que analiza tus datos y te dice exactamente qué ajustar.

## Propuesta de valor

> **"Tu socio inteligente que te dice exactamente qué ajustar en tu negocio, basado en datos."**

- **Un solo inbox** para Email y WhatsApp
- **CRM integrado** con historial completo por contacto
- **IA que trabaja para ti** generando insights y resúmenes diarios en español
- **Automatizaciones** sin código para flujos repetitivos
- **Facturación electrónica** integrada con Hacienda (Costa Rica)
- **Acceso desde cualquier lugar**: web y app de escritorio Windows

## ¿Para quién es PymeHub?

PymeHub está diseñado para:

- **Dueños y gerentes de PyMEs** que quieren visibilidad completa de su operación
- **Equipos de ventas y soporte** que manejan comunicación con clientes
- **Empresas costarricenses** que necesitan facturación electrónica integrada
- **Negocios en crecimiento** que quieren automatizar procesos sin contratar más personal

## Arquitectura multi-tenant

PymeHub es una plataforma **multi-tenant**: cada empresa tiene su propio espacio de trabajo (workspace) completamente aislado. Tus datos nunca se mezclan con los de otras empresas.

Cada workspace tiene:
- Sus propios usuarios con roles y permisos
- Sus propios contactos, conversaciones y tareas
- Su propia configuración de canales e integraciones
- Su propio plan de suscripción

## Plataformas disponibles

| Plataforma | URL / Distribución | Estado |
|---|---|---|
| **Web** | pymeshub.lat | Disponible |
| **Desktop Windows** | Descarga directa | Disponible |
| **API REST** | api.pymeshub.lat | Disponible |

## Tecnologías

PymeHub está construido con tecnologías modernas y confiables:

- **Backend:** NestJS + PostgreSQL + Redis
- **Frontend:** React + TypeScript + Tailwind CSS
- **Desktop:** Tauri 2 (Rust + WebView)
- **IA:** OpenAI, Anthropic (Claude), Google Gemini
- **Email:** Resend
- **Almacenamiento:** S3 / MinIO
- **Tiempo real:** Socket.IO (WebSockets)

## Próximos pasos

- [Inicio rápido →](/guide/getting-started)
- [Explorar funcionalidades →](/features/inbox)
- [Ver planes y precios →](/planes/pricing)
