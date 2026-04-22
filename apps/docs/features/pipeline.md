# Pipeline de Ventas

El **Pipeline de Ventas** te da una vista visual de todas tus oportunidades comerciales organizadas en etapas, como un tablero Kanban. Sabe exactamente en qué punto está cada deal y cuánto vale tu cartera en total.

## ¿Para qué sirve?

- Visualizar todas las oportunidades de venta en un solo tablero
- Mover deals de etapa en etapa conforme avanzan
- Calcular el valor total de tu pipeline
- Asignar deals a vendedores específicos
- Vincular oportunidades a contactos del CRM

## Etapas del pipeline

Las etapas son completamente personalizables para tu proceso de ventas. Ejemplos típicos:

```
Prospecto → Calificado → Propuesta enviada → Negociación → Cerrado ✓
```

Para crear o editar etapas: **Pipeline → "Gestionar etapas"** (requiere rol Admin).

Cada etapa tiene:
- **Nombre** (ej: "Propuesta enviada")
- **Posición** — Orden en el tablero
- **Color** — Para identificación visual

## Deals (Oportunidades)

Un **deal** es una oportunidad de venta específica con un cliente.

### Crear un deal

1. En el tablero, haz clic en **"+ Nuevo deal"** en cualquier etapa
2. O ve a **Pipeline → "Nuevo deal"**

Completa los datos:
- **Nombre del deal** — ej: "Implementación sistema contable - Empresa ABC"
- **Contacto** — Vincula al cliente del CRM
- **Valor** — Monto estimado de la oportunidad
- **Probabilidad** — % de probabilidad de cierre (0-100%)
- **Asignado a** — Vendedor responsable
- **Fecha de cierre estimada**

### Estados de un deal

| Estado | Descripción |
|---|---|
| **Abierto** | En proceso, todavía en juego |
| **Ganado** | Se cerró la venta exitosamente 🎉 |
| **Perdido** | No se concretó la oportunidad |

### Mover un deal

Arrastra el deal de una columna a otra en el tablero Kanban, o abre el deal y cambia la etapa desde el selector desplegable.

## Vista del tablero

El tablero muestra todas las etapas como columnas. Cada tarjeta de deal muestra:

- Nombre del deal
- Nombre del contacto
- Valor en CRC o USD
- Probabilidad (%)
- Agente asignado
- Días en la etapa actual

## Métricas del pipeline

En la parte superior del tablero verás:

| Métrica | Descripción |
|---|---|
| **Total pipeline** | Suma de todos los deals abiertos |
| **Deals este mes** | Deals creados en el mes actual |
| **Tasa de conversión** | % deals ganados vs. total cerrados |
| **Promedio de ciclo** | Tiempo promedio de Prospecto a Cerrado |

## Integración con el CRM

Los deals están vinculados directamente a contactos del CRM. Desde el perfil de un contacto puedes ver todos los deals asociados y su estado actual.

Esto te da una vista completa del valor histórico y actual de cada cliente.

## Buenas prácticas

- **Actualiza la etapa regularmente**: Un pipeline desactualizado da métricas incorrectas
- **Define el criterio de cada etapa**: Todo el equipo debe saber qué significa pasar de "Calificado" a "Propuesta enviada"
- **Registra el motivo de pérdida**: Cuando un deal se pierde, documenta por qué en las notas — es información valiosa
- **Revisa el pipeline semanalmente**: Una revisión semanal con el equipo evita que deals se queden sin atención
