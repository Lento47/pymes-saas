# Requisitos de Licencia y Avisos para Instalacion de Windows de PymeHub

## 1. Proposito

Este documento define los requisitos minimos que debe cumplir cualquier instalador de Windows o empaquetado desktop de PymeHub antes de distribuirse a usuarios finales o clientes.

## 2. Alcance

Aplica a:

- instaladores `.exe` o `.msi`;
- asistentes de setup;
- actualizadores que modifiquen terminos de uso;
- cualquier distribucion desktop que requiera aceptacion de licencia o politicas.

## 3. Requisitos obligatorios

- El instalador debe mostrar la licencia o terminos aplicables antes de finalizar la instalacion.
- Debe mostrar la politica de privacidad o un enlace claro a la version vigente.
- Debe mostrar el nombre del proveedor `[NOMBRE_EMPRESA]` y un canal de contacto legal o de soporte.
- Si existe recoleccion de telemetria, actualizaciones automaticas o servicios en segundo plano, eso debe informarse.
- La aceptacion no debe quedar implicita si el modelo legal requiere aceptacion expresa.

## 4. Evidencia minima

El flujo de instalacion deberia poder demostrar:

- version de licencia mostrada;
- fecha de vigencia de los documentos;
- si hubo checkbox o accion de aceptacion;
- que la pantalla fue visible antes de completar la instalacion.

## 5. Reglas de producto

- Si PymeHub se distribuye en Windows, la instalacion no debe omitir la capa legal solo porque ya exista dentro de la app web.
- Si el instalador solo prepara el cliente y el uso final sigue dependiendo de login web o SaaS, igualmente debe mostrar la licencia del software cliente y los avisos relevantes.

## 6. Estado actual

En este repositorio no existe hoy un proyecto de instalador Windows visible. Por tanto, este requisito queda documentado como condicion obligatoria para cualquier futura distribucion desktop.

## 7. Relacion con otros documentos

Este documento debe leerse junto con:

- [`../legal/terms-and-conditions.md`](../legal/terms-and-conditions.md)
- [`../legal/privacy-policy.md`](../legal/privacy-policy.md)
- [`compliance-implementation-backlog.md`](./compliance-implementation-backlog.md)
