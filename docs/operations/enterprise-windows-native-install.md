# Enterprise Windows Native: Instalacion

## Topologia objetivo

- 1 servidor Windows del cliente
- `PostgreSQL` local
- `API` y `Web` como servicios Windows
- storage binario en disco local
- clientes LAN por navegador o desktop opcional

## Componentes minimos

- `PostgreSQL`
- `PymesHub API`
- `PymesHub Web`
- carpeta de datos en `C:\ProgramData\PymesHub\`
- desktop enterprise opcional apuntando al host interno

## Rutas operativas por defecto

- `C:\ProgramData\PymesHub\config\`
- `C:\ProgramData\PymesHub\data\documents\`
- `C:\ProgramData\PymesHub\data\attachments\`
- `C:\ProgramData\PymesHub\data\invoices\pdf\`
- `C:\ProgramData\PymesHub\data\invoices\xml\`
- `C:\ProgramData\PymesHub\data\exports\`
- `C:\ProgramData\PymesHub\data\imports\`
- `C:\ProgramData\PymesHub\data\derived\`
- `C:\ProgramData\PymesHub\data\temp\`
- `C:\ProgramData\PymesHub\logs\`
- `C:\ProgramData\PymesHub\backups\`

## Variables operativas recomendadas

- `PymesHub_EDITION=enterprise`
- `PymesHub_STORAGE_MODE=local`
- `PymesHub_STORAGE_ROOT=C:\ProgramData\PymesHub\data`
- `DATABASE_URL=postgresql://...`
- `PORT=4000`
- `CORS_ORIGIN=http://<host-o-ip-del-servidor>:5000`

## Checklist de instalacion

1. Instalar PostgreSQL y crear la base de datos del cliente.
2. Configurar variables de entorno de `api` y `web`.
3. Crear el arbol de carpetas bajo `C:\ProgramData\PymesHub\`.
4. Registrar `api` y `web` como servicios Windows.
5. Ejecutar `prisma migrate deploy`.
6. Validar login, subida y descarga de documentos.
7. Validar backup de base de datos y del arbol `data`.
