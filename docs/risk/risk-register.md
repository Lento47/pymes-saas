# Registro General de Riesgos de PymeHub

## 1. Proposito

Este registro consolida los riesgos principales de PymeHub a nivel legal, operativo, tecnico y de seguridad. Su objetivo es que los riesgos relevantes tengan visibilidad, owner y plan de tratamiento.

## 2. Reglas de uso

- Todo riesgo relevante debe registrar probabilidad, impacto y accion pendiente.
- El estado debe revisarse periodicamente.
- Los riesgos aceptados deben dejar constancia de quien los acepta.

## 3. Registro

| Riesgo | Probabilidad | Impacto | Control actual | Riesgo residual | Estado | Accion pendiente | Fecha objetivo | Dueño |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aceptacion legal no versionada en producto | Media | Alta | Documentacion definida | Medio/Alto | Abierto | Implementar tabla/eventos de aceptacion | `[FECHA]` | `[RESPONSABLE]` |
| Falta de exportacion de datos estandar | Media | Alta | Offboarding documentado | Medio/Alto | Abierto | Diseñar export por workspace | `[FECHA]` | `[RESPONSABLE]` |
| Borrado incompleto por coexistencia con backups | Media | Media/Alta | Politica de retencion | Medio | Abierto | Definir lifecycle y evidencia de borrado | `[FECHA]` | `[RESPONSABLE]` |
| Uso excesivo de datos en prompts de IA | Media | Alta | Politica de minimizacion | Medio/Alto | Abierto | Implementar filtros y opt-out | `[FECHA]` | `[RESPONSABLE]` |
| Error de aislamiento multi-tenant | Baja/Media | Critica | Arquitectura por workspace | Alto | Abierto | Agregar pruebas automatizadas y auditoria | `[FECHA]` | `[RESPONSABLE]` |
| Acceso interno excesivo a produccion | Media | Alta | Politica de accesos | Medio | Abierto | Revisiones trimestrales y MFA | `[FECHA]` | `[RESPONSABLE]` |
| Inconsistencia entre pricing comercial y enforcement tecnico | Media | Media | Logica de planes definida | Medio | Abierto | Revisar matriz de planes y billing | `[FECHA]` | `[RESPONSABLE]` |
| Dependencia fuerte de terceros criticos | Alta | Media/Alta | Lista de subprocesadores | Medio/Alto | Abierto | Completar registro de vendor risk | `[FECHA]` | `[RESPONSABLE]` |
