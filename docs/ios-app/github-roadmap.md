# Roadmap GitHub: PymesHub iOS

## Milestones propuestos

### M0 - Discovery y scaffolding

- Decidir repo o monorepo.
- Decidir version minima de iOS.
- Crear proyecto Xcode.
- Configurar bundle id, signing y entornos.
- Crear `APIClient` base y `SessionStore`.

### M1 - Auth y shell

- Login con workspace slug.
- Refresh token en Keychain.
- `GET /api/auth/me`.
- Logout.
- Shell con tabs y navegacion tipada.

### M2 - Inbox

- Lista de conversaciones.
- Detalle con mensajes.
- Envio de mensaje.
- Resolver y asignar.
- Estados de error/carga/vacio.

### M3 - Contactos y tareas

- CRUD operativo de contactos.
- Lista y acciones de tareas.
- Busqueda basica.

### M4 - Facturas lectura primero

- Lista y detalle de facturas.
- Pagos y estados.
- Recordatorios.
- Acciones Hacienda detras de confirmacion.

### M5 - Produccion beta

- Observabilidad iOS.
- QA en TestFlight.
- Push/polling definido.
- Checklist de privacidad y seguridad.

## Issues iniciales

1. `ios: decide app location and deployment workflow`
2. `ios: scaffold Xcode project`
3. `ios: implement APIClient with auth headers`
4. `ios: implement Keychain-backed SessionStore`
5. `ios: build login screen with workspace slug`
6. `ios: add authenticated app shell with tabs`
7. `ios: implement conversations list`
8. `ios: implement conversation detail and message composer`
9. `ios: implement contacts list/detail/editor`
10. `ios: implement tasks list and completion flow`
11. `ios: implement invoices read-only views`
12. `ios: add client error reporting and endpoint latency metrics`

## Labels sugeridos

- `ios`
- `mobile`
- `api-contract`
- `security`
- `auth`
- `inbox`
- `billing`
- `observability`

## Flujo de ramas

- Crear una rama de trabajo antes de scaffolding, por ejemplo `codex/ios-planning` o un nombre sin slash si la maquina vuelve a tener problemas con refs.
- No mezclar cambios de `apps/api` con iOS en un mismo PR salvo que el issue sea un contrato API puntual.
- Si un endpoint nuevo o ajuste backend es obligatorio, hacer PR separado hacia `main-api`.
- Si se toca web/admin para configuracion visible, hacer PR separado hacia la rama web correspondiente.

## Plantilla breve de PR

```md
## Resumen

- Agrega plan/scaffolding inicial de PymesHub iOS.
- Define arquitectura SwiftUI, autenticacion y roadmap de milestones.

## Verificacion

- [ ] Proyecto iOS compila localmente en Xcode
- [ ] Tests unitarios pasan
- [ ] Login validado contra API dev/staging

## Riesgo

- Sin cambios de backend ni despliegue en este PR.
```
