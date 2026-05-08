# Backlog de Implementacion de Cumplimiento para PymesHub

## 1. Proposito

Este backlog traduce el paquete documental en trabajo concreto de producto, backend, frontend y operacion. Su objetivo es cerrar la brecha entre politicas escritas y controles realmente implementados.

## 2. Hito lanzamiento

### Legal y privacidad

- crear tabla versionada de documentos legales publicados;
- crear tabla de aceptaciones legales por usuario y workspace;
- bloquear onboarding sin aceptacion de Terminos y Privacidad;
- publicar paginas legales visibles desde registro, login y footer;
- exponer contacto de privacidad y soporte en UI.

### Seguridad y auditoria

- asegurar audit logs para login, cambios de rol, exportacion, borrado, documentos y configuraciones criticas;
- revisar que todos los modelos sensibles queden correctamente scoped por `workspace_id`;
- agregar pruebas negativas de acceso cruzado multi-tenant;
- reforzar separacion de ambientes y manejo de secretos.

### Retencion, exportacion y baja

- definir endpoint o job de exportacion por workspace;
- definir flujo de cancelacion desde frontend o soporte con evidencia;
- implementar borrado o anonimización por categorias;
- documentar y automatizar tratamiento de backups residuales.

## 3. Hito post-lanzamiento

### IA y OCR

- introducir minimizacion previa de contexto enviado a IA;
- permitir configuracion por workspace para habilitar o limitar funciones IA;
- agregar disclosure visible en flujos de OCR e IA;
- revisar retencion de prompts, outputs y texto OCR.

### Billing y operacion comercial

- alinear enforcement tecnico de planes con pricing publicado;
- preparar integracion con facturacion/cobro y evidencia de eventos comerciales;
- definir estados de cuenta para mora, suspension y reactivacion.

## 4. Hito enterprise-readiness

- ampliar evidencia de aceptacion legal y reportabilidad;
- reforzar controles de soporte con acceso excepcional;
- formalizar reportes de revision de accesos y riesgos;
- endurecer controles de exportacion, logs y segregacion.

## 5. Gobierno continuo

- mantener lista de subprocesadores y vendor risk register como registros vivos;
- calendarizar revision trimestral de accesos y riesgos;
- versionar cambios de politicas y registrar fecha de publicacion.
