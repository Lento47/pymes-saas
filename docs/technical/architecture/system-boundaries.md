# Limites del Sistema de PymeHub

## 1. Proposito

Este documento delimita que funciones controla directamente PymeHub y cuales dependen parcial o totalmente de terceros. Su objetivo es evitar promesas ambiguas sobre el alcance real del producto y apoyar el analisis de riesgo y cumplimiento.

## 2. Lo que controla PymeHub

- autenticacion y gestion de workspaces;
- logica de roles y permisos del producto;
- gestion de conversaciones, tareas, contactos y documentos;
- automatizaciones, notificaciones y reglas internas;
- resúmenes e insights como funcionalidad de producto;
- experiencia de usuario, disclosure legal y trazabilidad operativa.

## 3. Lo que depende de terceros

- hosting e infraestructura base;
- almacenamiento de archivos;
- colas y cache;
- correo transaccional;
- modelos de IA;
- eventualmente pagos y monitoreo.

## 4. Implicacion de cumplimiento

PymeHub controla su logica de autorizacion, retencion, experiencia de usuario y operacion propia, pero depende de terceros para disponibilidad parcial, region de datos, terminos auxiliares y ciertas medidas de seguridad subyacentes. Esa dependencia debe reflejarse en privacidad, DPA, vendor risk y comunicaciones a clientes.
