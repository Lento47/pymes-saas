# Enterprise Windows Native: Instalacion

## Topologia objetivo

- 1 servidor Windows del cliente
- `PostgreSQL` local
- `API` y `Web` como servicios Windows
- storage binario en disco local
- clientes LAN por navegador o desktop opcional

## Componentes minimos

- `PostgreSQL`
- `Pymeshub API`
- `Pymeshub Web`
- carpeta de datos en `C:\ProgramData\Pymeshub\`
- desktop enterprise opcional apuntando al host interno

## Rutas operativas por defecto

- `C:\ProgramData\Pymeshub\config\`
- `C:\ProgramData\Pymeshub\data\documents\`
- `C:\ProgramData\Pymeshub\data\attachments\`
- `C:\ProgramData\Pymeshub\data\invoices\pdf\`
- `C:\ProgramData\Pymeshub\data\invoices\xml\`
- `C:\ProgramData\Pymeshub\data\exports\`
- `C:\ProgramData\Pymeshub\data\imports\`
- `C:\ProgramData\Pymeshub\data\derived\`
- `C:\ProgramData\Pymeshub\data\temp\`
- `C:\ProgramData\Pymeshub\logs\`
- `C:\ProgramData\Pymeshub\backups\`

## Variables operativas recomendadas

- `PYMESHUB_EDITION=enterprise`
- `PYMESHUB_STORAGE_MODE=local`
- `PYMESHUB_STORAGE_ROOT=C:\ProgramData\Pymeshub\data`
- `DATABASE_URL=postgresql://...`
- `PORT=4000`
- `CORS_ORIGIN=http://<host-o-ip-del-servidor>:5000`

## Checklist de instalacion

1. Instalar PostgreSQL y crear la base de datos del cliente.
2. Configurar variables de entorno de `api` y `web`.
3. Crear el arbol de carpetas bajo `C:\ProgramData\Pymeshub\`.
4. Registrar `api` y `web` como servicios Windows.
5. Ejecutar `prisma migrate deploy`.
6. Validar login, subida y descarga de documentos.
7. Validar backup de base de datos y del arbol `data`.
