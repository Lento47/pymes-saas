# Autenticación API

La API de PymeHub usa **JWT (JSON Web Tokens)** con un sistema de refresh tokens para mantener sesiones seguras de larga duración.

## URL base

```
https://api.pymeshub.lat
```

Todos los endpoints son HTTPS. No se aceptan conexiones HTTP en producción.

## Formato de respuesta

Todas las respuestas son JSON con la siguiente estructura:

```json
// Respuesta exitosa
{
  "data": { ... },
  "message": "OK"
}

// Respuesta de error
{
  "statusCode": 401,
  "message": "Token inválido o expirado",
  "error": "Unauthorized"
}
```

## Registro

Crea una nueva cuenta y workspace:

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "tu@empresa.com",
  "password": "contraseña-segura",
  "name": "Tu Nombre",
  "workspace_name": "Mi Empresa S.A."
}
```

**Respuesta exitosa (201):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rt_abc123...",
  "user": {
    "id": "clx...",
    "email": "tu@empresa.com",
    "name": "Tu Nombre"
  },
  "workspace": {
    "id": "clx...",
    "name": "Mi Empresa S.A.",
    "slug": "mi-empresa-sa"
  }
}
```

## Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "tu@empresa.com",
  "password": "contraseña-segura"
}
```

**Respuesta exitosa (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rt_abc123...",
  "user": { ... },
  "workspace": { ... }
}
```

## Usar el token de acceso

Incluye el `access_token` en el header `Authorization` de todas las peticiones autenticadas:

```http
GET /api/contacts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Duración de los tokens

| Token | Duración | Almacenamiento recomendado |
|---|---|---|
| **Access Token** | 7 días | Memoria / localStorage |
| **Refresh Token** | 30 días | Cookie HttpOnly / localStorage seguro |

## Renovar el access token

Cuando el access token expira (error 401), usa el refresh token para obtener uno nuevo:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "rt_abc123..."
}
```

**Respuesta exitosa (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rt_xyz789..."
}
```

::: warning Rotación de refresh tokens
Cada vez que renuevas el token, PymeHub emite un **nuevo refresh token** y el anterior queda inválido. Si intentas usar un refresh token ya utilizado, **toda la sesión se invalida** (protección contra robo de tokens).
:::

## Logout

Invalida todos los refresh tokens de la sesión actual:

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Respuesta exitosa (200):**
```json
{
  "message": "Sesión cerrada correctamente"
}
```

## Obtener el usuario actual

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Respuesta:**
```json
{
  "id": "clx...",
  "email": "tu@empresa.com",
  "name": "Tu Nombre",
  "avatar_url": null,
  "workspace": {
    "id": "clx...",
    "name": "Mi Empresa S.A.",
    "slug": "mi-empresa-sa",
    "role": "OWNER",
    "plan": "GROWTH"
  }
}
```

## Múltiples workspaces

Un usuario puede pertenecer a múltiples workspaces (ej: consultor con varios clientes).

### Listar workspaces del usuario

```http
GET /api/auth/my-workspaces
Authorization: Bearer <access_token>
```

### Cambiar de workspace

```http
POST /api/auth/switch-workspace
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "workspace_id": "clx..."
}
```

Retorna nuevos tokens con el nuevo `workspace_id` en el payload del JWT.

## Roles y permisos en el JWT

El payload del access token contiene:

```json
{
  "sub": "user_id",
  "email": "tu@empresa.com",
  "workspace_id": "workspace_id",
  "role": "OWNER",
  "is_platform_admin": false,
  "iat": 1700000000,
  "exp": 1700604800
}
```

El `role` puede ser: `OWNER`, `ADMIN`, `AGENT`, o `VIEWER`.

## Códigos de error comunes

| Código | Descripción |
|---|---|
| `401 Unauthorized` | Token inválido, expirado o no enviado |
| `403 Forbidden` | Token válido pero sin permisos para esta acción |
| `429 Too Many Requests` | Límite de rate excedido |

## Invitar y aceptar usuarios

### Invitar a un miembro (requiere ADMIN)

```http
POST /api/workspaces/current/members/invite
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "nuevo@colaborador.com",
  "role": "AGENT"
}
```

### Aceptar una invitación

```http
POST /api/auth/accept-invite
Content-Type: application/json

{
  "token": "token-recibido-por-email",
  "name": "Nombre del usuario",
  "password": "nueva-contraseña"
}
```
