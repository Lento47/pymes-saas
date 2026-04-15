## Descripción del cambio

<!-- Describe claramente qué cambio introduce este PR y por qué es necesario.
     Incluye contexto relevante, links a issues o tickets relacionados. -->

Closes #<!-- número de issue -->

---

## Tipo de cambio

Marca con una `x` el tipo que aplica:

- [ ] `feature` — Nueva funcionalidad
- [ ] `fix` — Corrección de bug
- [ ] `refactor` — Refactorización sin cambio de comportamiento
- [ ] `docs` — Solo documentación
- [ ] `chore` — Tareas de mantenimiento / dependencias / CI
- [ ] `perf` — Mejora de rendimiento
- [ ] `test` — Adición o corrección de tests

---

## Cambios realizados

<!-- Lista los cambios principales (puede ser bullet points):
- Añadida entidad X con campos Y, Z
- Modificado servicio AuthService para soportar refresh tokens
-->

-
-

---

## Checklist

Antes de solicitar revisión, confirma que se cumplen los siguientes puntos:

### Calidad de código
- [ ] El código compila sin errores (`pnpm run build`)
- [ ] No hay errores de linting (`pnpm run lint`)
- [ ] Se han eliminado `console.log` de depuración y código comentado innecesario

### Tests
- [ ] Se han añadido o actualizado tests unitarios para la lógica nueva/modificada
- [ ] Se han añadido o actualizado tests e2e si aplica
- [ ] Todos los tests pasan localmente (`pnpm test`)

### Base de datos / Prisma
- [ ] Si hay cambios en el schema de Prisma, se generó la migración (`prisma migrate dev`)
- [ ] La migración es reversible o se ha documentado cómo revertirla
- [ ] Se han actualizado los seeders si corresponde

### Documentación
- [ ] Se ha actualizado el README o documentación relevante
- [ ] Los endpoints nuevos están documentados en Swagger/OpenAPI
- [ ] Los cambios en variables de entorno están reflejados en `.env.example`

### Breaking changes
- [ ] Este PR **NO** introduce breaking changes
- [ ] Si introduce breaking changes: están documentados abajo y se ha coordinado con el equipo

---

## Breaking changes (si aplica)

<!-- Describe qué se rompe y qué deben hacer los consumidores del API o
     los demás desarrolladores para adaptarse. -->

N/A

---

## Screenshots / evidencia (si aplica)

<!-- Para cambios en UI o comportamiento observable, adjunta capturas o grabaciones. -->

---

## Notas para el reviewer

<!-- Aspectos específicos en los que quieres que el reviewer se enfoque,
     decisiones de diseño que tomaste, alternativas que descartaste, etc. -->
