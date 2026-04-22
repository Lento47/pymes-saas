# Enterprise Windows Native: Storage Local

## Principio de separacion

- `PostgreSQL` guarda datos estructurados y metadata.
- El disco local guarda blobs y archivos pesados.
- `config` y `logs` viven fuera del contenido de negocio.

## Que vive en PostgreSQL

- usuarios
- permisos
- estados de negocio
- auditoria estructurada
- metadata de documentos
- referencias a `storage_relative_path`

## Que vive en disco local

- documentos subidos
- adjuntos
- exportaciones
- imports
- PDFs y XMLs generados
- previews y artefactos regenerables
- temporales de procesamiento

## Reglas de modelado

- nunca usar paths absolutos como verdad de negocio
- guardar paths relativos desde `PYMESHUB_STORAGE_ROOT`
- usar checksum para integridad
- bloquear path traversal
- mantener `temp` y `derived` como contenido regenerable

## Backup minimo

- dump de `PostgreSQL`
- copia consistente de `C:\ProgramData\Pymeshub\data\`
- `config\` solo segun politica de secretos

## Restore minimo

1. restaurar base de datos
2. restaurar arbol `data`
3. verificar archivos faltantes o huerfanos
4. correr reconciliacion si se implementa operativamente
