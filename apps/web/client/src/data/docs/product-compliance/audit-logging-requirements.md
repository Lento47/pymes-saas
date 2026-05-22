# Requisitos de Audit Logging para PymesHub

## 1. Proposito

Esta especificacion define los eventos y campos minimos que PymesHub debe auditar para soporte, seguridad, cumplimiento y reconstruccion de hechos relevantes.

## 2. Eventos minimos

- login exitoso y fallido;
- cierre de sesion y revocacion de sesiones;
- alta, baja o cambio de rol de usuarios;
- cambios de configuracion del workspace;
- accesos administrativos sensibles;
- carga, descarga y eliminacion de documentos;
- exportacion de datos;
- cambios en canales e integraciones;
- activacion, desactivacion o ejecucion fallida de automatizaciones;
- aceptaciones legales;
- solicitudes y respuestas de privacidad;
- incidentes o bloqueos de seguridad relevantes.

## 3. Campos minimos por evento

- timestamp;
- actor;
- workspace;
- tipo de evento;
- objeto afectado;
- resultado;
- metadata minima necesaria para reconstruir el hecho.

## 4. Reglas de implementacion

- Los logs deben ser razonablemente inmutables en la operacion cotidiana.
- El acceso a logs debe estar restringido.
- No deben registrarse secretos ni contenido excesivo de documentos si no es necesario.
- Los eventos de producto y los logs de seguridad deben poder correlacionarse.

## 5. Criterio de suficiencia

El sistema cumple minimamente cuando permite responder:

- quien hizo la accion;
- sobre que workspace u objeto;
- cuando ocurrió;
- con que resultado;
- y desde que flujo o contexto.
