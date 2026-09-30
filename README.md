# Reproductor de playlists

Aplicación web en español para crear playlists persistentes desde enlaces de YouTube y URLs directas a audio HTTPS. Una lista doblemente enlazada implementada a mano conserva el orden en el servidor y dirige la navegación del reproductor en el cliente. La app almacena referencias y metadatos; nunca sube ni descarga archivos de audio.

**URL de producción: `<pendiente>`**. El servicio, la imagen Docker y el blueprint de Render quedan listos; el primer despliegue requiere una cuenta y credenciales administradas por quien publica el proyecto.

## Funciones

- Crear, renombrar, cambiar y eliminar playlists con persistencia PostgreSQL e identidad anónima por cookie firmada.
- Agregar canciones al inicio, al final o en una posición elegida; duplicados permitidos, reordenamiento con controles accesibles y eliminación.
- Reproducir YouTube con su IFrame Player API visible o audio directo de terceros con `HTMLAudioElement`.
- Play/pausa, progreso y búsqueda temporal, volumen, mute, anterior, siguiente, repetición, shuffle y Media Session.
- Vista previa de enlaces, título y artista editables, controles por teclado y cola adaptable a móvil.
- Saltar las fuentes que fallan sin quedar en un ciclo; las pistas se pueden volver a intentar desde la cola.

No se incluye un catálogo o playlists de demostración: cada persona agrega sus propias fuentes. Los videos que no permiten inserción pueden fallar aunque el enlace exista.

## Requisitos

- Node.js 22 o posterior y npm incluido con Node.
- Docker Compose para ejecutar PostgreSQL en desarrollo y las pruebas de integración.
- No se necesita instalar PostgreSQL en el host.

## Desarrollo local

Desde la raíz de este repositorio:

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run dev
```

Abre <http://localhost:5173>. Vite envía `/api` al servidor Fastify en el puerto 3000. La primera petición entrega una cookie de propietario; la migración corre al iniciar el servidor.

Para probar rutas de producción y los archivos compilados, ejecuta `npm run build` y luego `npm start`. El servidor publica `web/dist` y envía la aplicación cliente para rutas que no comienzan por `/api/`.

### Variables de entorno

| Variable                  | Requerida | Valor local predeterminado           | Descripción                                                                                        |
| ------------------------- | --------: | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                |        No | `development`                        | `development`, `test` o `production`.                                                              |
| `PORT`                    |        No | `3000`                               | Puerto HTTP; Render inyecta el suyo.                                                               |
| `DATABASE_URL`            |        Sí | Base `reproductor` del Compose local | Cadena de conexión PostgreSQL.                                                                     |
| `COOKIE_SECRET`           |        Sí | Marcador en `.env.example`           | Secreto de al menos 32 caracteres; en producción usa un valor aleatorio gestionado por el hosting. |
| `MAX_PLAYLISTS_PER_OWNER` |        No | `50`                                 | Tope por cookie de propietario.                                                                    |
| `MAX_TRACKS_PER_PLAYLIST` |        No | `500`                                | Tope por playlist.                                                                                 |
| `BODY_LIMIT_BYTES`        |        No | `16384`                              | Tamaño máximo del JSON, limitado a 16 KiB.                                                         |
| `RATE_LIMIT_MAX`          |        No | `120`                                | Peticiones por minuto e IP; `/api/resolve` usa 20 por minuto.                                      |
| `TEST_DATABASE_URL`       |        No | Sin configurar                       | Base aislada para pruebas de integración; las pruebas pueden crear y borrar sus filas.             |

`.env.example` solo sirve para desarrollo local. No pongas secretos reales en Git, `render.yaml` ni capturas.

## Comprobaciones y pruebas

```bash
# Suite de estructuras, cursor, parser, metadatos, API con inject y componentes
npm test

# ESLint, formato, compilación tipada y suite de pruebas
npm run check

# Compilación de shared, frontend y servidor
npm run build
```

Las pruebas unitarias de metadatos simulan `fetch`; no contactan a YouTube. Las pruebas PostgreSQL se omiten si no existe `TEST_DATABASE_URL`, por lo que `npm run check` no requiere PostgreSQL tras copiar `.env.example`. Para habilitarlas, inicia la base temporal y pasa la URL solo al comando de prueba:

```bash
docker compose --profile test up -d test-db
TEST_DATABASE_URL=postgres://reproductor:reproductor_local@localhost:15433/reproductor_test npm test
```

No configures las pruebas contra una base con datos que quieras conservar. Cuando termines, `docker compose --profile test down` elimina el contenedor; su volumen es temporal.

`npm run check` no requiere conexión a PostgreSQL. Un `npm run build` tampoco requiere conexión: compila la aplicación, pero iniciar el servidor sí requiere que `DATABASE_URL` responda.

La revisión visual, los contrastes y las verificaciones de producción están resumidos en [`docs/QA.md`](docs/QA.md). La captura de escritorio se revisó en el navegador, pero no se incluye como archivo porque el navegador bloqueó su exportación local.

## API

Todas las rutas usan JSON y el prefijo `/api`. Los cambios reciben `expectedRevision`; una edición concurrente devuelve `409 revision_conflict`. Los errores comparten `{ "error": { "code", "message", "details"? } }`.

| Método                   | Ruta                                                            | Resultado                                                                            |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET`                    | `/api/health`                                                   | Estado del servidor y de PostgreSQL; devuelve `503` si la BD no responde.            |
| `POST`                   | `/api/resolve`                                                  | Valida y devuelve vista previa de una fuente compatible.                             |
| `GET`, `POST`            | `/api/playlists`                                                | Lista del propietario o crea una playlist.                                           |
| `GET`, `PATCH`, `DELETE` | `/api/playlists/:playlistId`                                    | Lee, renombra o elimina una playlist propia.                                         |
| `POST`                   | `/api/playlists/:playlistId/tracks`                             | Inserta con `at: { mode: "head" }`, `{ mode: "tail" }` o `{ mode: "index", index }`. |
| `DELETE`                 | `/api/playlists/:playlistId/tracks/:trackId?expectedRevision=N` | Elimina una canción de la playlist.                                                  |
| `PATCH`                  | `/api/playlists/:playlistId/tracks/:trackId/move`               | Cambia la posición con `{ toIndex, expectedRevision }`.                              |

Ejemplo de comprobación local:

```bash
curl -i http://localhost:3000/api/health
curl -i -c /tmp/reproductor-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mi música"}' \
  http://localhost:3000/api/playlists
```

La segunda llamada crea y guarda la cookie firmada. Reutiliza el archivo con `-b /tmp/reproductor-cookies.txt` para las llamadas posteriores desde `curl`.

## Despliegue en Render

1. Sube este repositorio a un Git remoto y conecta el repositorio en Render.
2. Crea un **Blueprint** usando `render.yaml`. Este define un servicio Docker, un Postgres, la ruta `/api/health` y `COOKIE_SECRET` generado por Render.
3. Espera a que la migración y la comprobación de salud terminen. Copia la URL `onrender.com` de ese servicio y reemplaza `<pendiente>` arriba.
4. Si vas a conservar playlists a largo plazo, cambia Postgres a un plan con persistencia permanente antes de guardar datos importantes.

El blueprint usa planes gratuitos para facilitar una primera evaluación. Render indica que una base Postgres gratuita vence a los **30 días**; durante los 14 días de gracia se puede actualizar antes de que Render la elimine. Las instancias web gratuitas también pueden suspenderse cuando están inactivas. Elige una base persistente de pago o un Postgres administrado externo antes de ofrecer almacenamiento duradero. La disponibilidad y el precio dependen de los planes vigentes en la cuenta. [Límites gratuitos de Render](https://render.com/docs/free), [referencia de `render.yaml`](https://render.com/docs/blueprint-spec).

El contenedor usa Node 22 Alpine, compila las tres áreas, conserva solo artefactos y dependencias de producción, corre como usuario `node` y ejecuta las migraciones con bloqueo advisory al arrancar. Render entrega `PORT`; en local se publica el puerto 3000.

### Construir con Docker

```bash
docker compose up -d db
docker build -t reproductor-estructuras-datos .
docker run --rm --name reproductor \
  --network reproductor-estructuras-datos_default \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://reproductor:reproductor_local@db:5432/reproductor \
  -e COOKIE_SECRET='un-secreto-local-de-al-menos-32-caracteres' \
  -p 3000:3000 \
  reproductor-estructuras-datos
```

Abre <http://localhost:3000>. Si el proyecto Docker Compose tiene otro nombre, ajusta `--network` al nombre que muestre `docker network ls`, o agrega el servicio web al Compose local. `DATABASE_URL` debe apuntar al contenedor Postgres desde la red Docker.

## Límites conocidos y privacidad

- YouTube puede impedir la vista previa o inserción por disponibilidad, privacidad, región o configuración del canal. La app muestra un error y omite la pista. Su reproductor permanece visible y mide al menos 200 × 200 px.
- El proveedor del audio debe permitir reproducción desde otros sitios y entregar cabeceras CORS/media adecuadas. La app no descarga ni analiza la URL desde su servidor.
- El enlace directo y los metadatos de una playlist sí se almacenan en PostgreSQL. Para audio, el título se escribe o deriva del nombre de archivo; YouTube aporta metadatos de oEmbed.
- La cookie anónima identifica el navegador. Borrar cookies crea otro propietario y no permite recuperar las playlists anteriores. No hay cuenta, sincronización de usuario autenticada ni recuperación de identidad.
- El servicio se mantiene en el mismo origen en producción: CORS permanece cerrado. Las cookies son `HttpOnly`, `SameSite=Lax` y `Secure` en producción; las consultas parametrizadas y los límites viven en la API.
- La miniatura proviene de `i.ytimg.com`; la reproducción se rige por los términos y controles de YouTube. La app no intenta ocultar el video ni descargar contenido.

## Estructura

```text
shared/             lista doble, cursor, URL y esquemas comunes
server/             Fastify, API, migraciones PostgreSQL y engines de metadatos
web/                React, Vite, motores de reproducción y UI accesible
docs/               decisiones y sistema visual
PRODUCT.md          contexto de producto
DESIGN.md           contrato visual
AGENTS.md           brief de implementación recibido
```

Las decisiones de implementación están en [`docs/DECISIONS.md`](docs/DECISIONS.md); el contrato visual está en [`DESIGN.md`](DESIGN.md) y [`docs/design-system.md`](docs/design-system.md). La verificación está en [`docs/QA.md`](docs/QA.md).
