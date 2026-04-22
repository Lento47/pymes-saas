# Pymeshub Enterprise Self-Hosted

Distribución `single-tenant` para clientes enterprise. Soporta Docker Engine o Podman siempre que el entorno pueda ejecutar imágenes OCI y `compose`.

## Componentes

- `postgres`
- `redis`
- `minio`
- `api`
- `web`
- `minio-init` para crear el bucket inicial

## Puesta en marcha

1. Copia `.env.enterprise.example` a `.env`.
2. Ajusta secretos, puertos y `APP_ORIGIN`.
3. Desde esta carpeta ejecuta:

```bash
docker compose --env-file .env -f compose.enterprise.yml up -d --build
```

Con Podman:

```bash
podman compose --env-file .env -f compose.enterprise.yml up -d --build
```

La UI queda expuesta por `WEB_PORT`. El API y las dependencias quedan internas excepto MinIO, que mantiene el console/API publicados para operación.

## Upgrade

```bash
docker compose --env-file .env -f compose.enterprise.yml pull
docker compose --env-file .env -f compose.enterprise.yml up -d --build
```

`api` ejecuta `prisma migrate deploy` al iniciar.

## Backup / Restore

PostgreSQL:

```bash
docker exec -t <postgres-container> pg_dump -U "$DB_USER" "$DB_NAME" > backup.sql
cat backup.sql | docker exec -i <postgres-container> psql -U "$DB_USER" "$DB_NAME"
```

MinIO:

- respaldar el volumen `minio_data`
- o usar `mc mirror` hacia almacenamiento externo

## Desktop opcional

El cliente enterprise puede usar el shell Tauri opcional apuntando a la URL privada del despliegue:

```bash
set PYMESHUB_REMOTE_URL=https://cliente.interno
pnpm --filter @pymeshub/desktop tauri:build:enterprise
```
