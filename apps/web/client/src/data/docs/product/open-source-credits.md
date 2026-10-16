# PymesHub — Open-source credits

- [English](#english)
- [Español](#espanol)

---

## English

**PymesHub is built on open-source software, and this page gives it credit.** Each project below does a real job in the product; the licence is the one the package publishes. Where a project is dual-licensed we show both options, and PymesHub uses it under the permissive option.

### How to read this page

- It lists the projects that carry the product, not every transitive dependency. Any package manager inventory of the repository contains hundreds of entries; the ones here are the ones a person would recognise.
- The licence column is copied from each package's own published metadata, not interpreted by us.
- If you believe a project is used here and not credited, or a notice is missing where one is required, write to **hola@pymeshub.com** and we will correct it.

### The product's own code

PymesHub's own software — the web application, the mobile application, the desktop application, the API, and the shared packages — is published under the **MIT licence**, with the copyright notice **© 2026 Otnel**. Open-source components remain under their own licences.

### Framework and interface (web)

| Project | What it does here | Licence |
| --- | --- | --- |
| React / React DOM | The interface of the storefront and the business dashboard | MIT |
| Wouter | The small router the web app navigates with | Unlicense |
| TanStack Query | Data fetching and caching for every screen | MIT |
| Radix UI (`@radix-ui/react-*`) | The accessible primitives behind dialogs, menus, tabs and more | MIT |
| Tailwind CSS, Tailwind Merge | The styling system and class composition | MIT |
| CVA (`class-variance-authority`) | Variant-based component styling | Apache-2.0 |
| Lucide | The icon set | ISC |
| Sonner | Toasts | MIT |
| Vaul | The drawer used for mobile sheets | MIT |
| cmdk | The command palette component | MIT |
| Embla Carousel | The carousels on the storefront | MIT |
| Framer Motion | Animation | MIT |
| Recharts | The business charts | MIT |
| react-markdown, remark-gfm | Rendering the documentation and legal pages (including this one) | MIT |
| MapLibre GL JS, PMTiles, Protomaps basemaps | The maps, and the tile format and styles behind them | BSD-3-Clause |
| three | 3D rendering used in the product | MIT |
| React Hook Form, resolvers | Form state and validation | MIT |
| date-fns | Date handling | MIT |
| input-otp | The code input used for verification steps | MIT |
| next-themes | Light and dark themes | MIT |
| nuqs | URL state | MIT |
| Zod, zod-validation-error | Schema validation shared between client and server | MIT |
| SuperJSON | Serialising data over the wire | MIT |

### API, database and cloud plumbing

| Project | What it does here | Licence |
| --- | --- | --- |
| Hono | The HTTP framework the API runs on | MIT |
| `@hono/trpc-server` | Serving tRPC through Hono | MIT |
| tRPC (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`) | The typed API contract between clients and backend | MIT |
| Drizzle ORM | Typed access to the database | Apache-2.0 |
| Drizzle Kit | Migrations | MIT |
| Better Auth (`better-auth`, `@better-auth/drizzle-adapter`) | Sessions, sign-in and account flows | MIT |
| Wrangler, `@cloudflare/workers-types` | Building and deploying to the cloud platform, and its types | MIT OR Apache-2.0 |
| Sentry (`@sentry/cloudflare`, `@sentry/react`, `@sentry/react-native`) | Error monitoring across all three clients | MIT |
| Supabase JS (`@supabase/supabase-js`, `@supabase/server`) | Talking to the identity provider | MIT |

### Mobile (iOS and Android)

| Project | What it does here | Licence |
| --- | --- | --- |
| Expo and its modules (`expo-router`, `expo-notifications`, `expo-location`, `expo-image-picker`, `expo-secure-store`, `expo-updates`, `expo-localization` and the rest) | The mobile application: navigation, push notifications, location, camera, secure storage, over-the-air updates and localisation | MIT |
| React Native | The native runtime | MIT |
| React Native community libraries (Reanimated, Gesture Handler, Screens, SVG, Safe Area Context, Worklets, Keyboard Controller, Async Storage) | Gestures, animation, navigation and storage | MIT |
| `@maplibre/maplibre-react-native` | Maps on mobile | MIT |
| React Native Web | Shared components that also render in the browser | MIT |

### Desktop (Windows)

| Project | What it does here | Licence |
| --- | --- | --- |
| Tauri (`@tauri-apps/api`, `@tauri-apps/cli` and the official plugins) | The desktop application shell, notifications, deep links, updater, store and shell access | Apache-2.0 OR MIT |

### Build, test and quality tooling

| Project | What it does here | Licence |
| --- | --- | --- |
| TypeScript | The language the whole repository is written in | Apache-2.0 |
| Vite and `@vitejs/plugin-react` | Building and serving the web application | MIT |
| Vitest | The unit and package test suites | MIT |
| Playwright | End-to-end tests | Apache-2.0 |
| Testing Library (`@testing-library/react`, `jest-dom`, `user-event`) and jsdom | Component tests against a simulated browser | MIT |
| esbuild | The bundler underneath the build | MIT |
| PostCSS, Autoprefixer | CSS processing | MIT |
| Biome | Linting and formatting | MIT OR Apache-2.0 |
| ESLint and its React plugins | Linting | MIT |
| Prettier | Formatting | MIT |
| tsx | Running TypeScript scripts | MIT |
| dotenv | Environment loading | BSD-2-Clause |
| cross-env, wait-on | Cross-platform scripts and readiness waits | MIT |
| nanoid | Generating short identifiers | MIT |
| `@types/node` and the other DefinitelyTyped packages | Type definitions provided by the community | MIT |

### Typefaces

The storefront and the documentation are set in typefaces served by Google Fonts. Their licences are the ones their upstream projects publish (the families used here are licensed for free use, including commercially).

### A note on the maps

The map data and styles come from the open-source Protomaps and OpenStreetMap ecosystem. Map data © OpenStreetMap contributors.

### What this page does not claim

- It is a credit list, not a legal notice bundle. The licence terms of each project govern its use, and where a project requires its notice to travel with a distribution, that notice ships with the software or is available on request.
- Version numbers change with every dependency update; the link, not the version, is the stable fact here.
- Mentioning a project does not imply any endorsement of PymesHub by its maintainers.

---

## Español

**PymesHub está construido sobre software libre y esta página le da el crédito.** Cada proyecto de abajo cumple una función real en el producto; la licencia es la que publica el propio paquete. Cuando un proyecto tiene doble licencia mostramos las dos opciones, y PymesHub lo usa bajo la opción permisiva.

### Cómo leer esta página

- Lista los proyectos que sostienen el producto, no cada dependencia transitiva. Un inventario completo del repositorio tiene cientos de entradas; acá están las que una persona reconocería.
- La columna de licencia está copiada de los metadatos publicados de cada paquete, no interpretada por nosotros.
- Si creés que un proyecto se usa acá y no está acreditado, o que falta un aviso donde corresponde, escribí a **hola@pymeshub.com** y lo corregimos.

### El código propio del producto

El software propio de PymesHub — la aplicación web, la móvil, la de escritorio, la API y los paquetes compartidos — se publica bajo licencia **MIT**, con el aviso de copyright **© 2026 Otnel**. Los componentes de código abierto siguen bajo sus propias licencias.

### Marco e interfaz (web)

| Proyecto | Qué hace acá | Licencia |
| --- | --- | --- |
| React / React DOM | La interfaz de la tienda y del panel del negocio | MIT |
| Wouter | El router liviano con el que navega la web | Unlicense |
| TanStack Query | Obtención y caché de datos en cada pantalla | MIT |
| Radix UI (`@radix-ui/react-*`) | Las primitivas accesibles detrás de diálogos, menús, pestañas y más | MIT |
| Tailwind CSS, Tailwind Merge | El sistema de estilos y la composición de clases | MIT |
| CVA (`class-variance-authority`) | Estilos de componentes por variantes | Apache-2.0 |
| Lucide | El set de íconos | ISC |
| Sonner | Los avisos emergentes | MIT |
| Vaul | El panel deslizable usado en móvil | MIT |
| cmdk | El componente de paleta de comandos | MIT |
| Embla Carousel | Los carruseles de la tienda | MIT |
| Framer Motion | Animación | MIT |
| Recharts | Los gráficos del negocio | MIT |
| react-markdown, remark-gfm | El renderizado de la documentación y las páginas legales (incluida esta) | MIT |
| MapLibre GL JS, PMTiles, Protomaps basemaps | Los mapas, y el formato de teselas y los estilos detrás | BSD-3-Clause |
| three | Renderizado 3D usado en el producto | MIT |
| React Hook Form, resolvers | Estado y validación de formularios | MIT |
| date-fns | Manejo de fechas | MIT |
| input-otp | La entrada de código usada en pasos de verificación | MIT |
| next-themes | Temas claro y oscuro | MIT |
| nuqs | Estado en la URL | MIT |
| Zod, zod-validation-error | Validación de esquemas compartida entre cliente y servidor | MIT |
| SuperJSON | Serialización de datos en el cable | MIT |

### API, base de datos y plomería de nube

| Proyecto | Qué hace acá | Licencia |
| --- | --- | --- |
| Hono | El marco HTTP sobre el que corre la API | MIT |
| `@hono/trpc-server` | Servir tRPC a través de Hono | MIT |
| tRPC (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`) | El contrato de API tipado entre clientes y backend | MIT |
| Drizzle ORM | Acceso tipado a la base de datos | Apache-2.0 |
| Drizzle Kit | Migraciones | MIT |
| Better Auth (`better-auth`, `@better-auth/drizzle-adapter`) | Sesiones, inicio de sesión y flujos de cuenta | MIT |
| Wrangler, `@cloudflare/workers-types` | Compilar y desplegar en la plataforma de nube, y sus tipos | MIT OR Apache-2.0 |
| Sentry (`@sentry/cloudflare`, `@sentry/react`, `@sentry/react-native`) | Monitoreo de errores en los tres clientes | MIT |
| Supabase JS (`@supabase/supabase-js`, `@supabase/server`) | Comunicación con el proveedor de identidad | MIT |

### Móvil (iOS y Android)

| Proyecto | Qué hace acá | Licencia |
| --- | --- | --- |
| Expo y sus módulos (`expo-router`, `expo-notifications`, `expo-location`, `expo-image-picker`, `expo-secure-store`, `expo-updates`, `expo-localization` y el resto) | La aplicación móvil: navegación, notificaciones, ubicación, cámara, almacenamiento seguro, actualizaciones al aire y localización | MIT |
| React Native | El entorno nativo | MIT |
| Librerías de la comunidad de React Native (Reanimated, Gesture Handler, Screens, SVG, Safe Area Context, Worklets, Keyboard Controller, Async Storage) | Gestos, animación, navegación y almacenamiento | MIT |
| `@maplibre/maplibre-react-native` | Mapas en móvil | MIT |
| React Native Web | Componentes compartidos que también se dibujan en el navegador | MIT |

### Escritorio (Windows)

| Proyecto | Qué hace acá | Licencia |
| --- | --- | --- |
| Tauri (`@tauri-apps/api`, `@tauri-apps/cli` y los plugins oficiales) | El contenedor de la aplicación de escritorio, notificaciones, enlaces profundos, actualizador, store y acceso al shell | Apache-2.0 OR MIT |

### Herramientas de construcción, prueba y calidad

| Proyecto | Qué hace acá | Licencia |
| --- | --- | --- |
| TypeScript | El lenguaje en el que está escrito todo el repositorio | Apache-2.0 |
| Vite y `@vitejs/plugin-react` | Compilar y servir la aplicación web | MIT |
| Vitest | Las suites de pruebas unitarias y de paquetes | MIT |
| Playwright | Pruebas de extremo a extremo | Apache-2.0 |
| Testing Library (`@testing-library/react`, `jest-dom`, `user-event`) y jsdom | Pruebas de componentes contra un navegador simulado | MIT |
| esbuild | El empaquetador que está debajo del build | MIT |
| PostCSS, Autoprefixer | Procesamiento de CSS | MIT |
| Biome | Lint y formato | MIT OR Apache-2.0 |
| ESLint y sus plugins de React | Lint | MIT |
| Prettier | Formato | MIT |
| tsx | Ejecutar scripts de TypeScript | MIT |
| dotenv | Carga de variables de entorno | BSD-2-Clause |
| cross-env, wait-on | Scripts multiplataforma y esperas de disponibilidad | MIT |
| nanoid | Generar identificadores cortos | MIT |
| `@types/node` y los demás paquetes de DefinitelyTyped | Definiciones de tipos aportadas por la comunidad | MIT |

### Tipografías

La tienda y la documentación se componen con tipografías servidas por Google Fonts. Sus licencias son las que publican sus proyectos de origen (las familias usadas acá tienen licencia de uso libre, incluido el uso comercial).

### Una nota sobre los mapas

Los datos y estilos de mapa vienen del ecosistema de código abierto de Protomaps y OpenStreetMap. Datos de mapa © colaboradores de OpenStreetMap.

### Lo que esta página no afirma

- Es una lista de créditos, no un paquete de avisos legales. Los términos de licencia de cada proyecto rigen su uso, y cuando un proyecto exige que su aviso viaje con una distribución, ese aviso se entrega con el software o queda disponible a pedido.
- Los números de versión cambian con cada actualización de dependencias; el enlace, y no la versión, es el dato estable acá.
- Mencionar un proyecto no implica que sus mantenedores respalden a PymesHub.
