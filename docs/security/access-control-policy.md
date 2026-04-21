# Politica de Control de Acceso de PymeHub

## 1. Proposito

Esta politica define las reglas de alta, baja, modificacion, revision y uso de accesos a PymeHub y a su infraestructura. Su objetivo es asegurar que todo acceso responda a necesidad legitima, menor privilegio y trazabilidad.

## 2. Alcance

Aplica a:

- usuarios de cliente dentro del producto;
- cuentas internas de administracion;
- accesos a produccion, staging y desarrollo;
- credenciales, tokens, cuentas de servicio y accesos temporales;
- intervenciones de soporte con acceso a datos del cliente.

## 3. Roles de producto

- `OWNER`: control integral del workspace, miembros, configuracion y aspectos sensibles del entorno del cliente.
- `ADMIN`: administracion operativa del workspace dentro del alcance permitido por producto.
- `AGENT`: trabajo operativo sobre conversaciones, tareas y elementos asignados.
- `VIEWER`: acceso de consulta con capacidad limitada.

## 4. Reglas obligatorias

- Cada usuario debe tener un rol asignado y justificado por necesidad operativa.
- Nadie debe compartir credenciales.
- Los accesos temporales deben tener expiracion y motivo.
- El soporte interno debe operar con trazabilidad y dentro del minimo privilegio.
- El acceso a produccion debe estar limitado al personal estrictamente necesario.

## 5. Altas

### 5.1 Altas internas

Las altas internas deben requerir aprobacion del responsable del servicio o del lider tecnico y deben registrar:

- persona habilitada;
- sistemas o ambientes autorizados;
- nivel de acceso;
- fecha de activacion;
- aprobador.

### 5.2 Altas de cliente

Las altas de cliente deben originarse desde un usuario administrador del workspace o desde un proceso de onboarding autorizado. Toda alta debe asociarse a un rol definido.

## 6. Cambios de acceso

Todo cambio de rol o de privilegio debe:

- responder a un cambio real de necesidad;
- quedar trazado en el sistema o en un registro operativo;
- minimizar el periodo durante el cual se mantienen privilegios elevados.

## 7. Bajas y revocacion

Ante salida de personal, cambio de funciones, sospecha de compromiso o cierre de relacion, deben revocarse sin demora indebida:

- accesos del producto;
- accesos a infraestructura;
- tokens;
- sesiones activas cuando corresponda;
- secretos o llaves asociados al rol.

## 8. Accesos temporales y soporte

Los accesos temporales deben usarse para soporte, incidentes o tareas puntuales. Deben dejar:

- motivo;
- responsable solicitante;
- aprobador;
- fecha de inicio;
- fecha de expiracion;
- evidencia de uso o cierre.

## 9. Revisiones periodicas

Al menos trimestralmente se recomienda revisar:

- accesos internos a produccion;
- usuarios inactivos;
- permisos elevados;
- cuentas de servicio;
- accesos temporales que no fueron revocados.

## 10. Evidencia y registros

Debe existir evidencia razonable de:

- altas;
- bajas;
- cambios de rol;
- revisiones periodicas;
- accesos excepcionales;
- uso de cuentas con privilegios elevados.
