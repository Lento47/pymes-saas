# PymesHub — Finding shops: search, categories and the "best" order

- [English](#english)
- [Español](#espanol)

---

## English

**How the storefront decides what to show and in what order.** Two things shape it: the filters a caller sends, and one ordering rule that is arithmetic rather than a habit. This page documents both, including what the ranking is **not** allowed to read.

### What a browse call sends

| Input | Values | Default |
| --- | --- | --- |
| `search` | Free text, up to 120 characters | — |
| `categoryId` | A category | — |
| `lat`, `lng` | The caller's position | — |
| `radiusKm` | 0.5 – 80 | 10 |
| `openNow` | Only shops open at this moment | false |
| `deliveryOnly` | Only shops that deliver | false |
| `sort` | `distance`, `rating`, `popular`, `newest`, `best` | `distance` |
| `limit` | 1 – 50 | 20 |

- **Only `ACTIVE` and `CLOSED` shops are visible to customers.** `DRAFT` and `SUSPENDED` are not in the feed, and a shop that loses its listing (a suspended subscription) drops out of it.
- A subscription status and being listed are two different facts: a shop that is `PAST_DUE` has lost plan features but **keeps its customers**.
- **`isOpen` and `distanceKm` are computed on the server.** Working out "is it open" needs the shop's timezone, its hours and the current time, and the first two are exactly what a phone in a different timezone gets wrong.
- **A category filter reads a sector as "this sector and the categories it holds."** The taxonomy has two levels (`0006_category_taxonomy.sql`), so filtering by a sector returns every shop filed under its children.
- `best` is **additive**. The four sorts a client already pages on keep their behaviour and their meaning, because a shipped mobile build sends one of them by name; `distance` stays the default so a caller that names no sort keeps the order it has always had, and a caller that wants the ranking asks for it by name.

Source: `packages/shared/src/schemas/business.ts` (`businessListInput`), `packages/trpc-api/src/services/helpers.ts` (`PUBLIC_BUSINESS_STATUSES`, `inCategory`), `packages/db/migrations/0006_category_taxonomy.sql`.

### The `best` order, in three signals

The algorithm has a name and a version — currently **`best-v1`**, with a weights set published as **`best-v1.0`** — because a score without a version is a score nobody can reproduce next month.

| Signal | Weight |
| --- | --- |
| Distance | 0.4 |
| Rating | 0.4 |
| Preparation reliability | 0.2 |

Every signal is normalised to `0..1` and the score is their **weighted mean**. The weights sum to 1 so the arithmetic can be checked by hand; they are a starting hypothesis, held in one place and versioned so that changing them is a diff rather than a hunt. A hand-edited weights value that is negative, `NaN` or all-zero falls back to the defaults, because a shop list that silently reorders the marketplace is worse than one that ignores the edit.

### Four rules the ordering keeps

1. **Missing is not zero.** A shop nobody has rated, or one whose orders have not been counted yet, enters at the platform's *prior* for that signal, not at 0. A zero would rank every new business last forever — which is the bug that stops a marketplace growing its supply — and it would also be a lie: "no evidence" is not "bad".
   - The rating prior is the platform mean, **4.3**, and it takes about **10 reviews** of its own before a shop moves most of the way off it. The formula is the Bayesian mean `(Σr + C·m) / (n + C)`, so "with no reviews, this is the platform average" is also the honest answer to "how good is this shop?".
   - Preparation reliability is not a bare percentage: it is the **lower bound** of the interval the evidence supports, because `1/1` is not 100%. The prior is added as **pseudo-orders** (on-time rate **0.85**, confidence **10**), so a shop with no orders lands on the *pessimistic end* of the prior and a shop with **one** on-time order already scores **above** it.
2. **Proximity is a smooth decay, not bands.** `exp(-d/τ)` with **τ = 2.5 km** — the distance at which proximity has fallen to `1/e`. The bands this replaced (`0.5/1/2/5 km`) had cliffs where two shops twenty metres apart could differ by 0.2 of score, which is a difference a customer can neither see nor explain.
3. **Organic rank never reads money.** No commission, no fee, no payout, no discount depth. Ranked-by-payment is undetectable by the customer, which is what makes it the worst failure available here — so it is a rule in the module rather than a convention someone has to remember.
4. **Same inputs, same order.** There is no randomness and no clock read inside the ranking: time arrives as a parameter and ties break on the shop's id. The score is rounded to six decimals so a cursor cannot drift in the last bit, and a ranking that reshuffles between two identical reads cannot be paginated, replayed or debugged.

### What the customer sees

**Never the score, and never a weight.** A number invites argument about the number, and a shop that learns its weight learns how to move it. The surfaces show a **reason** instead, drawn in the order the signals contributed:

- `nearby` — the distance signal is real evidence and strong;
- `highly_rated` — real evidence, at least 5 ratings, and a high value;
- `usually_ready_on_time` — real evidence of preparation reliability;
- `new_shop` — **less than half** of the applied weight came from this shop's own record, which is the honest label for a shop most of whose score is the platform's prior.

A reason is checkable by the person reading it, and if it is wrong it is wrong about something they can see.

### What is not wired yet

**Preparation reliability is on its prior floor today.** The projection that counts on-time preparations is not implemented, so the current ordering is carried by distance and rating while the preparation signal sits on the platform's prior. The substitution rule is here first on purpose — it is the part that had to be right before the signal could arrive.

A projection is also **aged rather than trusted**: when one is present it is written by a queue consumer somewhere behind the write that caused it, so it is always a little stale, and its authority decays smoothly with a **24-hour half-life**. A cliff ("older than an hour, ignore it") would change the shape of the ranking at an arbitrary instant and would quietly renormalise the weights — a change no version number would record.

Source: `packages/shared/src/ranking.ts` (`RANKING_VERSION`, `DEFAULT_RANKING_WEIGHTS`, `RANKING_PRIORS`).

### Related pages

- [PymesHub: product overview](/documentation/product-overview)
- [Ordering, paying and tracking](/documentation/ordering-and-tracking)
- [Selling on PymesHub](/documentation/selling-on-pymeshub)
- [Delivering on PymesHub](/documentation/delivering-on-pymeshub)

### What this page does not claim

- It describes the scoring module and the browse inputs as they exist in the repository. It is not a promise about a specific shop's position, and the weights are a starting hypothesis rather than a measured optimum.
- A score is comparable **within one request**, under one weights version. It is not a probability and it is not a rating of the shop's quality.
- The preparation signal is documented but not yet fed.

---

## Español

**Cómo decide la tienda qué mostrar y en qué orden.** Dos cosas lo moldean: los filtros que manda quien consulta y una regla de ordenamiento que es aritmética y no costumbre. Esta página documenta las dos, incluido lo que el ranking **no** tiene permitido leer.

### Qué manda una llamada de exploración

| Entrada | Valores | Por defecto |
| --- | --- | --- |
| `search` | Texto libre, hasta 120 caracteres | — |
| `categoryId` | Una categoría | — |
| `lat`, `lng` | La posición de quien consulta | — |
| `radiusKm` | 0.5 – 80 | 10 |
| `openNow` | Solo negocios abiertos en este momento | false |
| `deliveryOnly` | Solo negocios que entregan | false |
| `sort` | `distance`, `rating`, `popular`, `newest`, `best` | `distance` |
| `limit` | 1 – 50 | 20 |

- **Solo los negocios `ACTIVE` y `CLOSED` son visibles para los clientes.** `DRAFT` y `SUSPENDED` no están en el feed, y un negocio que pierde su listado (suscripción suspendida) sale de él.
- El estado de la suscripción y estar listado son dos hechos distintos: un negocio en `PAST_DUE` perdió funciones del plan pero **conserva sus clientes**.
- **`isOpen` y `distanceKm` se calculan en el servidor.** Resolver "está abierto" necesita la zona horaria del negocio, su horario y la hora actual, y las dos primeras son exactamente lo que un teléfono en otra zona horaria hace mal.
- **Filtrar por categoría lee un sector como "este sector y las categorías que contiene".** La taxonomía tiene dos niveles (`0006_category_taxonomy.sql`), así que filtrar por un sector devuelve cada negocio archivado bajo sus hijos.
- `best` es **aditivo**. Los cuatro órdenes con los que un cliente ya pagina mantienen su comportamiento y su significado, porque una versión publicada de la app móvil manda uno de ellos por nombre; `distance` sigue siendo el valor por defecto para que quien no nombra un orden conserve el que siempre tuvo, y quien quiere el ranking lo pide por nombre.

Fuente: `packages/shared/src/schemas/business.ts` (`businessListInput`), `packages/trpc-api/src/services/helpers.ts` (`PUBLIC_BUSINESS_STATUSES`, `inCategory`), `packages/db/migrations/0006_category_taxonomy.sql`.

### El orden `best`, en tres señales

El algoritmo tiene nombre y versión — hoy **`best-v1`**, con un juego de pesos publicado como **`best-v1.0`** — porque un puntaje sin versión es un puntaje que nadie puede reproducir el mes que viene.

| Señal | Peso |
| --- | --- |
| Distancia | 0.4 |
| Calificación | 0.4 |
| Confiabilidad de preparación | 0.2 |

Cada señal se normaliza a `0..1` y el puntaje es su **media ponderada**. Los pesos suman 1 para que la aritmética se pueda verificar a mano; son una hipótesis de arranque, guardados en un solo lugar y versionados, así que cambiarlos es un diff y no una cacería. Un valor de pesos editado a mano que sea negativo, `NaN` o todo ceros cae a los valores por defecto, porque una lista de negocios que reordena el marketplace en silencio es peor que una que ignora la edición.

### Cuatro reglas que mantiene el ordenamiento

1. **Lo que falta no es cero.** Un negocio que nadie calificó, o cuyos pedidos todavía no se contaron, entra con el *prior* de la plataforma para esa señal, no con 0. Un cero dejaría a todo negocio nuevo último para siempre — que es el error que impide que un marketplace crezca en oferta — y además sería mentira: "sin evidencia" no es "malo".
   - El prior de calificación es la media de la plataforma, **4.3**, y hacen falta unas **10 reseñas** propias para que un negocio se mueva casi del todo fuera de ella. La fórmula es la media bayesiana `(Σr + C·m) / (n + C)`, así que "sin reseñas, esto es el promedio de la plataforma" es además la respuesta honesta a "qué tan bueno es este negocio".
   - La confiabilidad de preparación no es un porcentaje pelado: es el **límite inferior** del intervalo que sostiene la evidencia, porque `1/1` no es 100%. El prior se suma como **pedidos ficticios** (puntualidad **0.85**, confianza **10**), así que un negocio sin pedidos cae en el *extremo pesimista* del prior y un negocio con **un** pedido puntual ya puntúa **por encima**.
2. **La cercanía es un decaimiento suave, no franjas.** `exp(-d/τ)` con **τ = 2.5 km** — la distancia a la que la cercanía cae a `1/e`. Las franjas que esto reemplazó (`0.5/1/2/5 km`) tenían acantilados donde dos negocios a veinte metros podían diferir 0.2 de puntaje, una diferencia que el cliente no puede ver ni explicar.
3. **El orden orgánico nunca lee dinero.** Ni comisión, ni tarifa, ni pago, ni profundidad de descuento. Estar ordenado por pago es indetectable para el cliente, y eso es lo que lo vuelve la peor falla disponible acá — por eso es una regla del módulo y no una convención que alguien tiene que recordar.
4. **Mismos datos, mismo orden.** No hay aleatoriedad ni lectura de reloj dentro del ranking: el tiempo llega como parámetro y los empates se rompen por el id del negocio. El puntaje se redondea a seis decimales para que un cursor no se corra en el último bit, y un ordenamiento que se baraja entre dos lecturas idénticas no se puede paginar, reproducir ni depurar.

### Qué ve el cliente

**Nunca el puntaje y nunca un peso.** Un número invita a discutir sobre el número y, peor, un negocio que aprende su peso aprende cómo moverlo. Las pantallas muestran un **motivo**, en el orden en que contribuyeron las señales:

- `nearby` — la señal de distancia es evidencia real y fuerte;
- `highly_rated` — evidencia real, al menos 5 calificaciones y un valor alto;
- `usually_ready_on_time` — evidencia real de confiabilidad de preparación;
- `new_shop` — **menos de la mitad** del peso aplicado vino del registro propio de ese negocio, que es la etiqueta honesta para un negocio cuya puntuación es en su mayoría el prior de la plataforma.

Un motivo se puede verificar por quien lo lee, y si está mal, está mal sobre algo que esa persona puede ver.

### Qué todavía no está conectado

**La confiabilidad de preparación está hoy en el piso del prior.** La proyección que cuenta preparaciones puntuales no está implementada, así que el ordenamiento actual lo llevan distancia y calificación mientras la señal de preparación se apoya en el prior de la plataforma. La regla de sustitución está primero a propósito: es la parte que tenía que estar bien antes de que la señal pudiera llegar.

Una proyección además **envejece en vez de confiarse**: cuando existe, la escribe un consumidor de cola en algún punto detrás de la escritura que la causó, así que siempre está algo vieja, y su autoridad decae suavemente con una **vida media de 24 horas**. Un acantilado ("si tiene más de una hora, ignoralo") cambiaría la forma del ranking en un instante arbitrario y renormalizaría los pesos en silencio — un cambio que ningún número de versión registraría.

Fuente: `packages/shared/src/ranking.ts` (`RANKING_VERSION`, `DEFAULT_RANKING_WEIGHTS`, `RANKING_PRIORS`).

### Páginas relacionadas

- [PymesHub: descripción general del producto](/documentation/product-overview)
- [Pedir, pagar y seguir un pedido](/documentation/ordering-and-tracking)
- [Vender en PymesHub](/documentation/selling-on-pymeshub)
- [Repartir en PymesHub](/documentation/delivering-on-pymeshub)

### Lo que esta página no afirma

- Describe el módulo de puntaje y las entradas de exploración tal como existen en el repositorio. No promete la posición de un negocio concreto, y los pesos son una hipótesis de arranque y no un óptimo medido.
- Un puntaje es comparable **dentro de una misma consulta**, bajo una versión de pesos. No es una probabilidad ni una calificación de la calidad del negocio.
- La señal de preparación está documentada pero todavía no se alimenta.
