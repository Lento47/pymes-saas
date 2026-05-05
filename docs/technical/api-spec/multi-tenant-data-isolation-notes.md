# Notas de Aislamiento Multi-Tenant para PymeHub

## 1. Proposito

Esta especificacion define el criterio minimo de aislamiento multi-tenant que PymeHub debe sostener para evitar mezcla, exposicion o acceso cruzado entre workspaces.

## 2. Principio general

Todo dato del producto debe quedar asociado a un `workspace` y no ser visible, consultable ni modificable por usuarios de otros tenants, salvo funciones administrativas excepcionales expresamente autorizadas y controladas.

## 3. Controles esperados

- filtro obligatorio por `workspace_id` a nivel de aplicacion y consultas;
- autorizacion por rol antes de acceder a recursos;
- contexto de workspace validado en cada peticion autenticada;
- pruebas negativas de acceso cruzado;
- cuidado especial en exportaciones, adjuntos, busquedas globales y jobs asincronos.

## 4. Zonas de riesgo

- endpoints admin o internos;
- workers y automatizaciones;
- documentos y buckets de storage;
- notificaciones en tiempo real;
- logs, reportes y dashboards agregados.

## 5. Evidencia y pruebas requeridas

- tests automatizados de autorizacion y scoping por workspace;
- pruebas manuales de cambio de rol;
- revision de consultas de reporting;
- validacion de que tareas, conversaciones, documentos y contactos no pueden mezclarse entre tenants.
