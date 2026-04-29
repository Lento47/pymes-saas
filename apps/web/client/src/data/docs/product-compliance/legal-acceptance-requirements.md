# Requisitos de Aceptacion Legal en Producto para PymeHub

## 1. Proposito

Esta especificacion define que debe implementar PymeHub para demostrar, de forma verificable, que un cliente o usuario autorizado acepto los documentos legales aplicables y en que version lo hizo.

## 2. Alcance

Aplica a la aceptacion de:

- Terminos y Condiciones;
- Politica de Privacidad;
- MSA, si se instrumenta desde producto;
- DPA u otros anexos cuando se habilite esa capacidad;
- cualquier politica cuya aceptacion deba quedar versionada.

## 3. Registro documental versionado

El sistema debe poder representar cada documento legal publicado con, como minimo:

- identificador del documento;
- nombre visible;
- version;
- fecha de publicacion;
- estado vigente o no vigente;
- hash o identificador interno del contenido publicado.

## 4. Evento de aceptacion

Por cada aceptacion, el sistema debe guardar:

- documento;
- version;
- usuario;
- workspace;
- timestamp;
- metodo de aceptacion;
- origen del flujo;
- IP y user-agent cuando juridica y tecnicamente aplique;
- evidencia asociada o referencia interna.

## 5. Reglas de negocio

- No debe completarse el alta de un workspace sin aceptacion de Terminos y Privacidad.
- Las versiones vigentes deben estar visibles desde el flujo de aceptacion.
- Cuando cambie materialmente un documento, el sistema debe permitir re-aceptacion.
- El historial de versiones no debe perderse al publicar una nueva version.

## 6. Requisitos operativos

- Soporte o legal autorizados deben poder consultar evidencia de aceptacion.
- Los eventos de aceptacion deben quedar ligados a audit logs cuando aplique.
- La aceptacion no debe depender solo de una marca visual sin persistencia de backend.

## 7. Artefactos sugeridos

- tabla versionada de documentos legales;
- tabla de eventos de aceptacion;
- endpoint interno para verificar estado de aceptacion por workspace;
- audit log de re-aceptaciones o sustituciones.
