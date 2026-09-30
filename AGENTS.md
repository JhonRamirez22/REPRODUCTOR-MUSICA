# AGENTS.md — Reproductor de Música con Listas Dobles

> Instrucciones para agentes de código (Codex). Léelo completo antes de escribir código.
> Idioma de la UI y la documentación: **español**. Idioma del código (identificadores, commits): **inglés**.

## 0. Reglas de trabajo del agente

- No hagas preguntas salvo que algo bloquee de verdad. Si hay ambigüedad, elige la opción más simple, impleméntala y regístrala en `docs/DECISIONS.md` (una línea: decisión + motivo).
- Trabaja por fases (sección 12). Al terminar cada fase: `npm run check` en verde y un commit (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Código listo para producción: sin pseudocódigo, sin `TODO` sin dueño, sin `any`, sin `console.log` de depuración. Deuda técnica consciente → comentario `// TODO: <qué y por qué>`.
- Simple, nativo y mantenible. Prohibido añadir dependencias fuera de la lista permitida (sección 3) sin justificarlo en `docs/DECISIONS.md`.
- Comenta solo el **porqué**, nunca el qué.
- Nada "quemado": ninguna canción, playlist, URL, ID o texto de negocio en el código. Todo sale de la base de datos, de la entrada del usuario o de variables de entorno.

## 1. Objetivo

App web en **TypeScript** que simula una lista de reproducción de canciones aplicando **listas doblemente enlazadas**, **desplegada en la nube** con URL pública.

### Requisitos del taller (obligatorios)

| # | Requisito | Dónde se cumple |
|---|-----------|-----------------|
| R1 | Frontend con el que el usuario interactúa | `web/` |
| R2 | Agregar canción **al inicio, al final y en cualquier posición** | `DoublyLinkedList.insertAtHead / insertAtTail / insertAt` |
| R3 | **Eliminar** una canción de la lista | `DoublyLinkedList.removeById` |
| R4 | **Adelantar** canción (siguiente) | `PlaybackCursor.next()` |
| R5 | **Retroceder** canción (anterior) | `PlaybackCursor.prev()` |
| R6 | Otras funcionalidades pertinentes | sección 7 |

### Requisitos adicionales del usuario

- **Reproducir música desde la web sin subir archivos**: el usuario pega un enlace y la app reproduce desde la fuente original (sección 5).
- **Crear y gestionar playlists** (varias, con nombre, persistentes).
- **Cero código quemado / totalmente dinámico**: cualquier canción válida funciona, no hay catálogo fijo.
- **Backend funcional** con persistencia real.
- **Desplegado en la nube** (sección 11).
- **Frontend de alta calidad visual** usando las skills *Impeccable* y *UI UX Pro Max* (sección 9).

## 2. Decisión clave: dónde vive la lista doble

- La estructura de datos `DoublyLinkedList<T>` se implementa **a mano** (nodos con `prev` / `next`, punteros `head` / `tail`, `size`). **Prohibido** usar `Array` como estructura interna de la playlist (un `Array` solo se permite para serializar/renderizar a la salida con `toArray()`).
- Vive en `shared/` y se usa en **ambos lados**:
  - **Servidor**: para cada mutación carga los tracks ordenados por `position` → construye la lista → aplica la operación → persiste el nuevo orden (`position = 0..n-1`) en una sola transacción. Así la lógica de negocio pasa por la lista y la BD es solo almacenamiento.
  - **Cliente**: la cola de reproducción usa la misma lista con un `PlaybackCursor` (puntero al nodo actual) para `next()`/`prev()` en O(1).
- Trade-off: persistir `prev_id/next_id` en BD sería "más fiel" pero frágil (estados corruptos, más writes). Persistir `position` es simple, consultable y suficiente con los límites de la sección 6.

## 3. Stack

| Capa | Elección | Motivo |
|------|----------|--------|
| Runtime | Node.js LTS (>= 22), ESM | nativo |
| Lenguaje | TypeScript `strict: true`, `noUncheckedIndexedAccess: true` | requisito del taller |
| Monorepo | npm workspaces: `shared`, `server`, `web` | sin herramientas extra |
| Backend | Fastify | rápido, validación y `inject()` para tests |
| BD | PostgreSQL vía `pg` + SQL plano (sin ORM) | persistente en la nube (Neon/Render/Railway) |
| Validación | `zod` (esquemas en `shared/`, compartidos cliente/servidor) | un único contrato |
| Frontend | Vite + React + TypeScript | estándar |
| Estilos | CSS plano con variables (design tokens) + CSS Modules | sin UI kits |
| Tests | Vitest | un solo runner para todo |

**Dependencias permitidas** (todo lo demás requiere justificación):
- server: `fastify`, `@fastify/static`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `pg`, `zod`
- web: `react`, `react-dom`
- dev: `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `tsx`, `eslint`, `typescript-eslint`, `prettier`, `@types/*`

Sin: Redux, TanStack Query, Tailwind, librerías de drag-and-drop, ORMs, librerías de reproducción (usa la API nativa de YouTube y `HTMLAudioElement`).

## 4. Estructura del repositorio

```
.
├── AGENTS.md
├── README.md                  # qué es, cómo correr, URL de producción
├── PRODUCT.md / DESIGN.md     # generados por /impeccable init (sección 9)
├── docs/DECISIONS.md
├── docker-compose.yml         # solo Postgres local para dev/test
├── Dockerfile                 # multi-stage: build web → server sirve estáticos
├── .env.example
├── package.json               # workspaces + scripts
├── shared/src/
│   ├── doubly-linked-list.ts  # DoublyLinkedList<T>, ListNode<T>
│   ├── playback-cursor.ts     # PlaybackCursor<T>: next/prev/jumpTo/repeat/shuffle
│   ├── source-parser.ts       # parseSourceUrl(url) → { provider, sourceId } | error
│   ├── schemas.ts             # zod: Playlist, Track, requests, responses
│   └── *.test.ts
├── server/
│   ├── migrations/001_init.sql
│   └── src/
│       ├── main.ts            # arranque, migraciones, graceful shutdown
│       ├── app.ts             # buildApp() (testeable con inject)
│       ├── config.ts          # lee y valida env (falla rápido)
│       ├── db.ts              # pool + migrador simple (tabla schema_migrations)
│       ├── owner.ts           # cookie firmada de propietario anónimo
│       ├── routes/{playlists,tracks,resolve,health}.ts
│       ├── services/{playlist-service,metadata-service}.ts
│       └── *.test.ts
└── web/src/
    ├── main.tsx, App.tsx
    ├── api/client.ts          # fetch tipado con los esquemas de shared
    ├── player/{engine.ts,youtube-engine.ts,audio-engine.ts,use-player.ts}
    ├── components/            # PlaylistSidebar, NowPlaying, Controls, QueueList, AddTrackDialog...
    ├── styles/{tokens.css,base.css}
    └── *.test.tsx
```

## 5. Reproducir sin subir música (fuentes)

La app **nunca almacena audio**. Guarda solo metadatos y una referencia a la fuente. Cada canción tiene `provider` + `sourceId`.

### Proveedores obligatorios

1. **`youtube`** — YouTube IFrame Player API.
   - Acepta `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `music.youtube.com/watch?v=`, y `embed/`. Extrae el ID (11 caracteres `[A-Za-z0-9_-]`).
   - Metadatos (título, autor, miniatura) desde **oEmbed** (`https://www.youtube.com/oembed?url=...&format=json`), sin API key. Host fijo en el servidor → sin SSRF.
   - Cumplimiento de términos: el reproductor debe permanecer **visible** (no ocultar el video para "solo audio"; mínimo 200×200 px).
   - Videos no embebibles / eliminados (errores 2, 5, 100, 101, 150): marcar la pista como no disponible en la UI y **saltar automáticamente a la siguiente** sin quedarse en bucle.
2. **`audio`** — URL directa a un archivo de audio servido por terceros (`https:` y extensión `.mp3 .ogg .oga .wav .m4a .aac .flac .opus` o ruta sin extensión si el usuario la marca explícitamente).
   - Se reproduce con `HTMLAudioElement`. **El servidor no descarga ni hace fetch de estas URLs** (evita SSRF); el título lo ingresa el usuario o se deduce del nombre de archivo.
   - Solo `https:` (evita contenido mixto). Rechazar `javascript:`, `data:`, `file:`, IPs privadas/localhost al validar.

### Interfaz común (no es sobre-ingeniería: hay ≥ 2 implementaciones reales)

```ts
interface PlayerEngine {
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume01: number): void;
  destroy(): void;
  on(event: 'ready' | 'ended' | 'error' | 'timeupdate' | 'statechange', cb: (payload: unknown) => void): () => void;
}
```

`use-player.ts` elige el engine por `track.provider`. Añadir un proveedor nuevo = un parser en `source-parser.ts` + un engine; nada más cambia.

### Fase opcional de búsqueda (solo después de que todo lo demás esté completo)
Buscador de catálogo (p. ej. Audius o Jamendo) activado únicamente si existe su variable de entorno; si no, la UI no lo muestra. No es requisito del taller.

## 6. Backend

### Modelo de datos (`server/migrations/001_init.sql`)

```sql
CREATE TABLE playlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  revision    integer NOT NULL DEFAULT 0,          -- control de concurrencia optimista
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX playlists_owner_idx ON playlists (owner_id);

CREATE TABLE tracks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id   uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position >= 0),
  provider      text NOT NULL CHECK (provider IN ('youtube','audio')),
  source_id     text NOT NULL,                     -- videoId o URL completa
  source_url    text NOT NULL,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  artist        text,
  duration_sec  integer CHECK (duration_sec >= 0),
  thumbnail_url text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, position) DEFERRABLE INITIALLY DEFERRED
);
```

Se permite la **misma canción repetida** en una playlist (cada fila es un nodo distinto con su propio `id`).

### Identidad sin login (nube pública)
Cookie **firmada, `HttpOnly`, `SameSite=Lax`, `Secure` en producción** con un `ownerId` UUID generado en la primera visita. Cada consulta filtra por `owner_id`; acceder a una playlist ajena devuelve **404** (no 403, para no filtrar existencia). `// TODO: migrar a cuentas reales si el producto lo requiere.`

### API REST (JSON, prefijo `/api`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | `{status:"ok"}` + chequeo de BD (para el healthcheck del hosting) |
| POST | `/api/resolve` | `{url}` → `{provider, sourceId, title, artist?, thumbnailUrl?}` (vista previa antes de agregar) |
| GET | `/api/playlists` | playlists del propietario (con `trackCount`) |
| POST | `/api/playlists` | `{name}` → crea |
| GET | `/api/playlists/:id` | playlist + tracks ordenados por `position` |
| PATCH | `/api/playlists/:id` | renombrar |
| DELETE | `/api/playlists/:id` | eliminar (cascade) |
| POST | `/api/playlists/:id/tracks` | `{url, title?, artist?, at: {mode:"head"}\|{mode:"tail"}\|{mode:"index", index}, expectedRevision}` |
| DELETE | `/api/playlists/:id/tracks/:trackId` | `?expectedRevision=` |
| PATCH | `/api/playlists/:id/tracks/:trackId/move` | `{toIndex, expectedRevision}` |

- Toda mutación devuelve la playlist completa actualizada con su nuevo `revision`.
- `expectedRevision` distinto al actual → **409** `revision_conflict` (el cliente refresca y reintenta/avisa).
- Formato de error único: `{ "error": { "code": "validation_error", "message": "…", "details"?: … } }`. Nunca filtrar stack traces ni mensajes de `pg`.
- Límites (configurables por env, con defaults): 50 playlists/propietario, 500 pistas/playlist, body máx. 16 KB, rate limit 120 req/min/IP (más estricto en `/api/resolve`: 20/min).

### Edge cases que deben manejarse y testearse explícitamente
- Lista vacía; lista de 1 nodo (head === tail) al insertar/eliminar.
- `insertAt(index)` válido en `0..size`; fuera de rango → error de validación (400), no clamp silencioso.
- Eliminar head, tail, nodo medio, nodo inexistente (404), el único nodo.
- Mover a la misma posición (no-op sin incrementar `revision`).
- Dos pestañas editando a la vez (409).
- URL inválida, de host no soportado, video inexistente en oEmbed (404/401 de YouTube → error claro), timeout de oEmbed (5 s) → `502 upstream_unavailable`.
- Nombre de playlist vacío, solo espacios, o > 80 caracteres; normalizar con `trim()`.

### Seguridad
- `@fastify/helmet` con CSP ajustada al reproductor:
  - `script-src 'self' https://www.youtube.com https://s.ytimg.com`
  - `frame-src https://www.youtube.com https://www.youtube-nocookie.com`
  - `img-src 'self' data: https://i.ytimg.com`
  - `media-src https:` (audio directo de terceros) · `connect-src 'self'`
- Consultas **siempre parametrizadas**. CORS cerrado (mismo origen en prod; en dev usa el proxy de Vite).
- Secretos solo por env (`.env` en `.gitignore`; `.env.example` sin valores reales).
- Apagado ordenado (`SIGTERM`): cerrar Fastify y el pool.

### Variables de entorno (`config.ts` las valida con zod y falla al arrancar si faltan)
`NODE_ENV`, `PORT` (default 3000), `DATABASE_URL`, `COOKIE_SECRET` (≥ 32 chars), `MAX_PLAYLISTS_PER_OWNER`, `MAX_TRACKS_PER_PLAYLIST`.

## 7. Funcionalidades del frontend

**Núcleo (taller):** agregar (inicio / final / posición elegida), eliminar, siguiente, anterior.

**Reproductor:** play/pausa, barra de progreso con seek, volumen/mute, tiempo actual/duración, pista actual resaltada en la cola, doble clic/Enter para saltar a una pista.

**Playlists:** crear, renombrar, eliminar (con confirmación), cambiar entre ellas; al volver a la app se restaura la última playlist (`localStorage`, con try/catch).

**Extras de valor (implementar en este orden, sin salirse del alcance):**
1. Repetir: off / toda la lista / una pista (en "toda la lista" `next()` del tail vuelve al head usando los punteros).
2. Aleatorio (shuffle) sin alterar el orden persistido (la cola de reproducción se baraja solo en memoria).
3. Reordenar pistas (botones subir/bajar accesibles + drag nativo HTML5 opcional) → `move`.
4. Vista previa al pegar un enlace (llama a `/api/resolve`) con miniatura y título editable.
5. Atajos: `Espacio` play/pausa, `←`/`→` anterior/siguiente, `M` mute.
6. **Media Session API** (teclas multimedia del SO y pantalla de bloqueo) — es nativa.
7. Duplicados permitidos; detección de pista no disponible con estilo atenuado.

**Comportamiento de "anterior":** si `currentTime > 3 s`, reinicia la pista; si no, va al nodo `prev`. En el head sin repetición, reinicia la pista.
**Comportamiento de "siguiente":** en el tail sin repetición, detiene la reproducción y deja el cursor en el tail.
**Eliminar la pista que suena:** el cursor pasa al `next` (o `prev` si era el tail); si era la única, estado vacío.
**Autoplay:** los navegadores exigen un gesto del usuario para la primera reproducción; no intentar eludirlo.

**Estados obligatorios en cada vista:** cargando (skeleton), vacío (con llamada a la acción), error (con reintento), éxito. Sin spinners infinitos.

## 8. Contrato de la lista doble (`shared/src/doubly-linked-list.ts`)

```ts
class ListNode<T> { constructor(public readonly id: string, public value: T,
  public prev: ListNode<T> | null = null, public next: ListNode<T> | null = null) {} }

class DoublyLinkedList<T> {
  readonly size: number;                       // getter
  get head(): ListNode<T> | null;
  get tail(): ListNode<T> | null;
  insertAtHead(id: string, value: T): ListNode<T>;       // O(1)
  insertAtTail(id: string, value: T): ListNode<T>;       // O(1)
  insertAt(index: number, id: string, value: T): ListNode<T>; // 0..size; recorre desde el extremo más cercano
  removeById(id: string): T | undefined;                  // O(1) con Map<id, node> interno
  moveTo(id: string, toIndex: number): void;
  getAt(index: number): ListNode<T> | null;
  indexOf(id: string): number;
  toArray(): T[];                                          // solo para serializar/render
  static from<T>(items: Iterable<{ id: string; value: T }>): DoublyLinkedList<T>;
}
```

Reglas: nunca dejar punteros colgantes (al quitar, limpiar `prev`/`next` del nodo retirado); `head.prev === null` y `tail.next === null` siempre; `size` coherente; IDs únicos (lanzar error si se duplica).

**Tests obligatorios** (`doubly-linked-list.test.ts`): cada operación sobre vacía / 1 nodo / N nodos; invariantes tras cada operación (recorrer hacia adelante y hacia atrás da el mismo orden inverso); test aleatorio (500 operaciones con semilla fija) comparando contra un `Array` de referencia **solo dentro del test**.
`PlaybackCursor`: `next`/`prev` en extremos con cada modo de repetición, eliminar el nodo actual, cola vacía.

## 9. Diseño de la interfaz (skills de diseño)

Objetivo: producto **limpio, sobrio y memorable**, no una plantilla genérica de IA. El orden importa: **primero se define el sistema de diseño, luego se programa la UI.**

### 9.1 Instalar las skills (en la raíz del repo)

```bash
# Impeccable (skill de diseño con comandos /impeccable ...)
npx impeccable skills install          # detecta Codex y la instala donde corresponde

# UI UX Pro Max (base de estilos, paletas, tipografías y reglas UX)
npm install -g ui-ux-pro-max-cli
uipro init --ai codex
```

Reinicia/recarga el agente si hace falta para que detecte las skills. Si algún comando falla por red o cambio de sintaxis, consulta `impeccable.style` y el README de `nextlevelbuilder/ui-ux-pro-max-skill`, y sigue con el fallback de 9.4 **sin bloquearte**.

### 9.2 Flujo obligatorio

1. **UI UX Pro Max → sistema de diseño.** Genera la recomendación con el generador de sistemas de diseño de la skill (busca `scripts/search.py` dentro de la carpeta de la skill instalada y confirma flags con `--help`). Consulta sugerida:
   `"music player streaming playlist dark modern minimal" --design-system -p "<NombreProducto>"`.
   Guarda el resultado (paleta, pareja tipográfica, estilo, efectos, anti-patrones, checklist) en `DESIGN.md`/`docs/design-system.md`.
2. **Impeccable → contexto.** Ejecuta `/impeccable init`. Al preguntar por la superficie elige **product** (UI de aplicación). Esto genera `PRODUCT.md` (audiencia, voz, anti-referencias) y `DESIGN.md`. Incorpora lo obtenido en el paso 1 en vez de inventar otro sistema.
3. **Construcción.** Implementa tokens en `web/src/styles/tokens.css` y luego los componentes. Usa `/impeccable craft` para la pantalla principal y `/impeccable polish` al final de la fase de frontend.
4. **Revisión.** Ejecuta `/impeccable audit` y `/impeccable critique`; corrige hallazgos. Luego `npx impeccable detect --fast .` (detector determinista, sin LLM); el resultado debe quedar sin hallazgos o con excepciones justificadas en `docs/DECISIONS.md`.

### 9.3 Dirección visual (guía, UI UX Pro Max puede refinarla)

- **Dark-first** cálido (evitar `#000` puro), con tema claro opcional vía `prefers-color-scheme` + `data-theme`.
- **Un solo color de acento** usado con intención (botón de play, pista activa, foco). El resto: neutros.
- **Evitar los tics de "IA"**: degradado morado→azul, tarjetas dentro de tarjetas, iconos en cuadrado redondeado sobre cada título, texto gris sobre fondos de color, bordes laterales de color, brillos/glows, easing con rebote.
- Jerarquía por tipografía y espacio, no por sombras. Carátula/miniatura protagonista en "Reproduciendo ahora".
- Layout escritorio: barra lateral de playlists · centro "Reproduciendo ahora" (con el reproductor de YouTube **visible**) · cola de reproducción. Móvil: una columna, mini-reproductor fijo abajo que se expande, cola como panel inferior.
- Movimiento sutil (150–250 ms), solo `transform`/`opacity`, y **respetar `prefers-reduced-motion`**.
- Microcopy en español claro y breve ("Agregar al final", "Reproducir a continuación", "Esta pista no está disponible").

### 9.4 Fallback si las skills no se pueden usar (tokens de partida)

```css
:root {
  --bg: #121110;        --surface: #1b1917;   --surface-2: #25221f;
  --border: #332f2b;    --text: #f3efe9;      --text-muted: #a39b91;
  --accent: #ff6b3d;    --on-accent: #121110; --danger: #ff5d5d;
  --radius-sm: 8px;     --radius-md: 12px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```
Ajustar tipografía con una pareja distintiva si hay red para fuentes; cualquier fuente debe tener *fallback*.

### 9.5 Accesibilidad y calidad (no negociable)
- Contraste WCAG AA (4.5:1 texto, 3:1 componentes). Verificar el acento sobre el fondo.
- Todo operable con teclado, foco visible, orden de tabulación lógico, `aria-label` en botones de icono, `aria-live="polite"` para cambios de pista, roles correctos en la lista (`listbox`/`option` o `list`).
- Objetivos táctiles ≥ 44×44 px. Mobile-first, sin scroll horizontal, probado a 360 px.
- Iconos: SVG inline propios y coherentes (mismo grosor). Sin emojis como iconos.
- Lighthouse (móvil): Accesibilidad ≥ 95, Buenas prácticas ≥ 95.

## 10. Calidad, scripts y pruebas

Scripts en el `package.json` raíz:

| Script | Acción |
|--------|--------|
| `npm run dev` | server (tsx watch) + web (vite) en paralelo |
| `npm run build` | build de shared → web → server |
| `npm start` | arranca el server de producción (sirve `web/dist`) |
| `npm test` | Vitest en todos los workspaces |
| `npm run lint` | ESLint + Prettier `--check` |
| `npm run typecheck` | `tsc --noEmit` en cada workspace |
| `npm run check` | lint + typecheck + test (puerta previa a cada commit) |

Pruebas mínimas:
- **shared**: lista doble y cursor (sección 8), `parseSourceUrl` (todas las variantes de URL de YouTube, URLs inválidas, esquemas peligrosos).
- **server**: integración con `app.inject()` y Postgres de prueba (`TEST_DATABASE_URL`, `docker-compose up -d db`): CRUD de playlists, inserción head/tail/index, eliminación, move, 404 por propietario ajeno, 409 por revisión, 400 por validación, límites.
- **web**: componentes clave con Vitest + `@testing-library/react` (añadir como dev-dep): `AddTrackDialog`, `QueueList`, `Controls`; un test del hook `use-player` con un `PlayerEngine` falso.
- El `metadata-service` se testea con `fetch` simulado (nunca llamar a YouTube en tests).

## 11. Despliegue en la nube

Objetivo: **un solo servicio** (Node sirviendo API + frontend estático) + **Postgres administrado**.

- Recomendado: servicio web en **Render** (o Railway/Fly.io) + **Neon** (Postgres con plan gratuito persistente). Alternativa: Postgres de la misma plataforma.
- `Dockerfile` multi-stage (`node:22-alpine`): instalar deps → build → imagen final solo con `server/dist`, `web/dist` y dependencias de producción; ejecutar como usuario no-root; `EXPOSE` del `PORT`; `CMD ["node","server/dist/main.js"]`.
- El servidor sirve `web/dist` con fallback a `index.html` para rutas del cliente (excepto `/api/*`).
- Las migraciones se ejecutan al arrancar, dentro de una transacción con `pg_advisory_lock` para evitar carreras entre instancias.
- Healthcheck: `GET /api/health`. Confiar en `X-Forwarded-*` (`trustProxy: true`) detrás del proxy del hosting para cookies `Secure` y rate limit por IP real.
- Añade `render.yaml` (o el archivo equivalente de la plataforma elegida) y una sección **"Despliegue"** en el README con pasos exactos y las variables de entorno a configurar.
- El agente **no puede autenticarse en la nube por el usuario**: deja todo listo (Dockerfile, config, instrucciones paso a paso) y deja en el README un marcador claro `URL de producción: <pendiente>` para completar tras el primer deploy.

## 12. Plan de ejecución por fases

| Fase | Entregable | Criterio de salida |
|------|-----------|--------------------|
| 1. Base | Monorepo, TS estricto, ESLint/Prettier, Vitest, `npm run check` | check en verde con un test trivial |
| 2. Núcleo | `DoublyLinkedList`, `PlaybackCursor`, `source-parser`, esquemas zod + tests | todos los tests de la sección 8 en verde |
| 3. Backend | Migración, config, CRUD playlists y tracks, `/api/resolve`, seguridad | tests de integración en verde; `curl` manual funcional |
| 4. Diseño | Skills instaladas, sistema de diseño, `PRODUCT.md`, `DESIGN.md`, `tokens.css` | flujo 9.2 pasos 1–2 completados |
| 5. Frontend | Engines, `use-player`, pantallas y componentes, estados vacío/carga/error | requisitos R1–R5 usables de punta a punta con un backend real |
| 6. Extras | Sección 7 (orden indicado) | cada extra con su test |
| 7. Pulido | `/impeccable audit`, `critique`, `polish`, `detect`; Lighthouse | sección 9.5 cumplida |
| 8. Despliegue | Dockerfile, `render.yaml`, README, `.env.example` | imagen construye y corre local con `docker build` + Postgres |

## 13. Definición de terminado

- [ ] R1–R6 funcionan en la UI con datos reales (sin ninguna canción o playlist en el código).
- [ ] Se puede crear una playlist nueva, pegar enlaces de YouTube y de audio directo, reproducir sin subir archivos, y todo persiste tras recargar.
- [ ] Insertar al inicio, al final y en posición N; eliminar; siguiente; anterior; repetir; aleatorio.
- [ ] `npm run check` en verde; sin `any`; sin dependencias fuera de la lista.
- [ ] Sin secretos en el repo; `.env.example` completo.
- [ ] Probado en escritorio y en móvil (360 px); navegación solo con teclado.
- [ ] `docker build` exitoso y app corriendo localmente contra Postgres.
- [ ] README con: descripción, capturas, cómo correr, variables de entorno, pasos de despliegue, limitaciones conocidas (p. ej. videos no embebibles) y URL pública.
- [ ] `docs/DECISIONS.md` con las decisiones tomadas.