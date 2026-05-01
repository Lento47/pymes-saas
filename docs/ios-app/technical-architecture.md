# Arquitectura Tecnica: PymesHub iOS

## Stack recomendado

- SwiftUI para UI.
- Swift Concurrency (`async`/`await`) para llamadas de red.
- Observation de iOS 17+ para estado raiz y modelos observables.
- Keychain para refresh token y datos sensibles de sesion.
- URLSession con un cliente API propio.
- XCTest para servicios, parsing y flujos criticos.

## Estructura propuesta

```text
apps/ios/PymesHub/
  PymesHubApp.swift
  App/
    AppTab.swift
    AppRouter.swift
    SessionStore.swift
  Core/
    API/
      APIClient.swift
      AuthInterceptor.swift
      APIError.swift
    Security/
      KeychainStore.swift
    Models/
      AuthModels.swift
      ConversationModels.swift
      ContactModels.swift
      TaskModels.swift
      InvoiceModels.swift
  Features/
    Auth/
    Inbox/
    Contacts/
    Tasks/
    Invoices/
    Settings/
  Resources/
  Tests/
```

## Navegacion

- `TabView` como shell principal.
- `NavigationStack` por tab para conservar historial independiente.
- Rutas tipadas por enum, por ejemplo `InboxRoute.conversation(id:)`.
- Sheets con enum identificable, no multiples booleanos.

## Autenticacion

La web actual usa:

- `POST /api/auth/login` con header `x-workspace-slug`.
- `POST /api/auth/refresh`.
- `GET /api/auth/me`.
- `POST /api/auth/logout`.
- `GET /api/auth/my-workspaces`.
- `POST /api/auth/switch-workspace`.

En iOS:

- Guardar refresh token en Keychain.
- Guardar access token solo en memoria.
- Refrescar automaticamente ante 401 una sola vez.
- Limpiar sesion si refresh falla.
- Enviar `Authorization: Bearer <token>` y `x-workspace-slug` en solicitudes autenticadas.

## API inicial

El cliente iOS debe cubrir primero estos dominios existentes:

- Auth: login, refresh, me, logout, workspaces.
- Conversations: lista, detalle, mensajes, enviar, asignar, resolver.
- Contacts: lista, detalle, crear, editar.
- Tasks: lista, crear, actualizar, completar, vencidas.
- Invoices: lista, detalle, pagos, recordatorios, Hacienda solo con confirmacion.
- Notifications: lista, conteo, marcar leidas.
- Search: busqueda global.

## Manejo de datos

- El MVP puede operar online-first sin cache persistente compleja.
- Cache en memoria por pantalla y refresh al aparecer.
- Offline real queda fuera del MVP salvo lectura de ultimo estado si se decide agregar persistencia.
- Para listas grandes, paginar desde el API cuando el endpoint lo permita.

## Seguridad

- Keychain para refresh token.
- No imprimir tokens en logs.
- No persistir payloads sensibles sin cifrado.
- Usar ATS/HTTPS en produccion.
- Confirmaciones nativas para acciones sensibles: facturacion, Hacienda, eliminar/desactivar.
- Biometric unlock opcional solo como proteccion local de apertura, no como reemplazo de token.

## Observabilidad

- Enviar errores de red y errores 5xx a una ruta compatible con error reports.
- Adjuntar app version, build, iOS version, device model, workspace id si esta disponible y endpoint.
- Medir latencia por endpoint y tiempo de render inicial de pantallas criticas.

## Riesgos

- Contratos API no tipados para Swift. Mitigacion: definir DTOs Swift y tests de decoding con fixtures.
- Refresh token y cambio de workspace pueden generar estados inconsistentes. Mitigacion: `SessionStore` unico.
- Tiempo real puede requerir ajustes de CORS/auth/socket. Mitigacion: iniciar con polling y luego agregar Socket.IO.
- Facturacion tiene alto riesgo operativo. Mitigacion: modo lectura primero y acciones con confirmacion.

## Criterios de aceptacion tecnicos

- Build local en Xcode sin warnings criticos.
- Tests unitarios para `APIClient`, refresh token y decoding de modelos principales.
- Login real contra API de staging/dev.
- Cierre de sesion revoca refresh tokens.
- No hay tokens en logs ni archivos locales.
