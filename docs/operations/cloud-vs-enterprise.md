# Cloud vs Enterprise

## Cloud

- PymeHub opera infraestructura, despliegues, backups y monitoreo.
- El desktop permitido es `desktop-cloud`.
- El updater del shell está activo y controlado por GitHub Releases.
- La URL del shell apunta al SaaS operado por PymeHub.

## Enterprise

- El despliegue es `single-tenant` y self-hosted por cliente.
- La entrega principal es el stack OCI/Compose de `deployments/enterprise`.
- El desktop permitido es `desktop-enterprise` y es opcional.
- El updater del shell se deja desactivado por defecto.
- La URL del shell apunta al host privado del cliente.

## Reglas de soporte

- Cloud: PymeHub es responsable de backups, upgrades y observabilidad de plataforma.
- Enterprise: la responsabilidad operativa exacta depende del contrato, pero debe explicitar:
  - quién hace backups
  - quién ejecuta upgrades
  - quién monitorea la infraestructura
  - quién administra acceso remoto y troubleshooting
