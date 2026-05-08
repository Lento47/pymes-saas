# Paquete Documental Maestro de PymesHub

## 1. Proposito

Este directorio contiene la documentacion maestra de PymesHub como producto SaaS B2B multi-tenant orientado a pymes. El paquete esta diseñado para cubrir de forma coherente la capa legal externa, la capa interna de cumplimiento, la operacion diaria del servicio y los requisitos tecnicos que el producto debe implementar para sostener lo que se promete a clientes, prospectos, proveedores y terceros.

El objetivo del paquete no es convertirse en un tratado teorico ni en una certificacion formal por si mismo. Su objetivo es dejar el repositorio listo para operar con orden, demostrar control documental y servir como base seria para validacion legal, fiscal, de privacidad, seguridad, soporte y producto.

## 2. Alcance

Este paquete aplica a:

- el sitio y dominio `PymesHub.lat`;
- el producto PymesHub y sus modulos de inbox, CRM, tareas, documentos, OCR, automatizaciones, resúmenes IA, insights, notificaciones y administracion multi-tenant;
- la operacion de `Otnel S.A` en `Costa Rica`;
- los clientes B2B de PymesHub;
- los miembros internos, contratistas y proveedores autorizados que acceden a datos o sistemas del servicio.

No sustituye asesoria legal, fiscal o regulatoria local. Cuando exista una zona que requiera validacion externa, el documento correspondiente deja fijado el criterio operativo de trabajo y el punto exacto que debe confirmarse con asesoria.

## 3. Convenciones documentales

### 3.1 Placeholders controlados

Los siguientes placeholders deben permanecer consistentes hasta su sustitucion definitiva:

- `Otnel S.A`
- `privacidad@pymeshub.lat`
- `PymesHub.lat`
- `Costa Rica`

Otros placeholders adicionales podran usarse cuando un dato todavia no se haya definido formalmente, siempre que el documento deje claro si se trata de un dato operativo, legal, comercial o tecnico pendiente.

### 3.2 Estandar editorial

Salvo que la naturaleza del archivo exija otra estructura, cada documento debe incluir, en la medida aplicable:

1. proposito;
2. alcance;
3. definiciones clave;
4. roles y responsables;
5. reglas o politica obligatoria;
6. procedimiento o flujo operativo;
7. evidencia y registros;
8. excepciones y escalamiento;
9. frecuencia de revision;
10. control documental;
11. relacion con otros documentos.

### 3.3 Control documental minimo

Todo documento de este paquete debe interpretarse con los siguientes metadatos por defecto, aun cuando no esten desarrollados como tabla formal dentro de cada archivo:

- owner del documento: responsable funcional del tema;
- ultima revision: fecha en que el documento fue revisado internamente;
- proxima revision: fecha objetivo de revalidacion;
- estado: vigente, en revision o pendiente de validacion externa;
- version: numeracion o identificador de control;
- dependencias: otros documentos o procesos relacionados.

## 4. Principios del paquete

- La documentacion esta adaptada a la operacion real de PymesHub y no a un SaaS generico.
- Se diferencia con claridad entre documentos externos al cliente, politicas internas y especificaciones que el producto debe implementar.
- Ningun documento debe prometer algo que PymesHub no pueda sostener operativamente o tecnicamente.
- Toda afirmacion relevante debe poder rastrearse a una evidencia, flujo, control o backlog de implementacion.
- Donde exista incertidumbre normativa especifica, se documenta el criterio operativo y la necesidad de validacion externa, pero no se inventa certeza.

## 5. Estructura del paquete

- [`legal/`](./legal): documentos contractuales, privacidad, tratamiento de datos, cancelacion, uso aceptable y plantillas de confidencialidad.
- [`business/`](./business): definiciones societarias, guia fiscal y de facturacion para Costa Rica, pricing, checklist de salida y revision de marca/dominio.
- [`security/`](./security): marco de seguridad, accesos, incidentes, backups, retencion, clasificacion, vendors, subprocesadores, riesgos y desarrollo seguro.
- [`operations/`](./operations): soporte, SLA, onboarding, offboarding, reclamos, gestion de cambios y comunicacion de releases.
- [`product-compliance/`](./product-compliance): requisitos de aceptacion legal, auditoria, UI de privacidad, IA, OCR, aislamiento multi-tenant y backlog tecnico.
- [`architecture/`](./architecture): flujos de datos, limites del sistema y mapa de servicios de terceros.
- [`templates/`](./templates): plantillas operativas reutilizables para ventas, privacidad, incidentes, facturacion y onboarding.

## 6. Orden de uso recomendado

1. Completar placeholders corporativos y de jurisdiccion.
2. Validar la capa `legal/` y `business/` con asesoria local y contador.
3. Publicar o preparar la publicacion de los documentos externos vigentes.
4. Convertir `product-compliance/` en backlog tecnico priorizado.
5. Mantener `subprocessors-list.md`, `vendor-risk-register.md` y `risk-register.md` como registros vivos.
6. Versionar las politicas publicadas y conservar evidencia de su aceptacion.

## 7. Estado esperado del repositorio

Al mantener este paquete actualizado, el repositorio debe quedar preparado para:

- publicar paginas legales consistentes con la operacion real;
- contratar clientes B2B con base documental clara;
- gestionar soporte, incidentes, cancelaciones, exportaciones y borrado con criterio uniforme;
- demostrar orden minimo sobre accesos, datos, riesgos y proveedores;
- traducir obligaciones documentales en trabajo concreto de producto y operacion.

## 8. Relacion con otros documentos

Este `README` funciona como indice maestro y norma editorial del paquete. Debe revisarse cada vez que se agregue una nueva politica, se cambie la estructura del directorio o se incorpore una nueva linea de negocio, proveedor critico o capacidad de producto que altere el mapa de cumplimiento de PymesHub.
