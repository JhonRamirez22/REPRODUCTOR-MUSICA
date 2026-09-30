# Reproductor de playlists

Aplicación web en español para crear playlists persistentes y buscar música en el catálogo de Jamendo. Una lista doblemente enlazada implementada a mano conserva el orden en el servidor y dirige la navegación del reproductor en el cliente. La app almacena referencias y metadatos; nunca sube ni descarga archivos de audio.

**URL de producción: `<pendiente>`**. El servicio, la imagen Docker y el blueprint de Render quedan listos; el primer despliegue requiere una cuenta y credenciales administradas por quien publica el proyecto.

## Funciones

- Crear, renombrar, cambiar y eliminar playlists con persistencia PostgreSQL e identidad anónima por cookie firmada.
- Agregar canciones al inicio, al final o en una posición elegida; duplicados permitidos, reordenamiento con controles accesibles y eliminación.
- Buscar canciones por título o artista en la API de Jamendo, escuchar la transmisión oficial y conservar artista, ficha de origen y licencia.
- Play/pausa, progreso y búsqueda temporal, volumen, mute, anterior, siguiente, repetición, shuffle y Media Session.
- Controles por teclado y táctiles, con estados de carga y error y una cola adaptable a móvil.
- Saltar las fuentes que fallan sin quedar en un ciclo; las pistas se pueden volver a intentar desde la cola.

No se incluye música de demostración. El catálogo solo aparece conectado cuando el servidor tiene `JAMENDO_CLIENT_ID`; no se pegan enlaces de música en la interfaz.

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

Para activar la búsqueda, crea una aplicación en el [portal de desarrolladores de Jamendo](https://developer.jamendo.com/) y agrega tu `JAMENDO_CLIENT_ID` a `.env`. El ID solo se lee en el servidor y no se entrega al navegador. Sin esa variable, la app informa que el catálogo no está conectado.

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
| `JAMENDO_CLIENT_ID`       |        No | Sin configurar                       | ID de tu aplicación Jamendo; requerido para activar el catálogo y el streaming.                    |
| `RATE_LIMIT_MAX`          |        No | `120`                                | Peticiones por minuto e IP; las búsquedas de catálogo usan 20 por minuto.                          |
| `TEST_DATABASE_URL`       |        No | Sin configurar                       | Base aislada para pruebas de integración; las pruebas pueden crear y borrar sus filas.             |

`.env.example` solo sirve para desarrollo local. No pongas secretos reales en Git, `render.yaml` ni capturas.

## Comprobaciones y pruebas

```bash
# Suite de estructuras, cursor, catálogo simulado, API con inject y componentes
npm test

# ESLint, formato, compilación tipada y suite de pruebas
npm run check

# Compilación de shared, frontend y servidor
npm run build
```

Las pruebas del catálogo simulan `fetch`; no contactan a Jamendo. Las pruebas PostgreSQL se omiten si no existe `TEST_DATABASE_URL`, por lo que `npm run check` no requiere PostgreSQL tras copiar `.env.example`. Para habilitarlas, inicia la base temporal y pasa la URL solo al comando de prueba:

```bash
docker compose --profile test up -d test-db
TEST_DATABASE_URL=postgres://reproductor:reproductor_local@localhost:15433/reproductor_test npm test
```

No configures las pruebas contra una base con datos que quieras conservar. Cuando termines, `docker compose --profile test down` elimina el contenedor; su volumen es temporal.

`npm run check` no requiere conexión a PostgreSQL. Un `npm run build` tampoco requiere conexión: compila la aplicación, pero iniciar el servidor sí requiere que `DATABASE_URL` responda.

La revisión visual, los contrastes y las verificaciones de producción están resumidos en [`docs/QA.md`](docs/QA.md). La captura de escritorio se revisó en el navegador, pero no se incluye como archivo porque el navegador bloqueó su exportación local.

El aviso de privacidad público está disponible en `/privacy.html` y enlazado desde la interfaz. Explica la cookie de propietario, los datos de playlists, la búsqueda a través de Jamendo y la transmisión del audio.

## API

Todas las rutas usan JSON y el prefijo `/api`. Los cambios reciben `expectedRevision`; una edición concurrente devuelve `409 revision_conflict`. Los errores comparten `{ "error": { "code", "message", "details"? } }`.

| Método                   | Ruta                                                            | Resultado                                                                                        |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`                    | `/api/health`                                                   | Estado del servidor y de PostgreSQL; devuelve `503` si la BD no responde.                        |
| `GET`                    | `/api/catalog/status`                                           | Indica si el catálogo está configurado; no expone la credencial.                                 |
| `GET`                    | `/api/catalog/search?q=...`                                     | Busca pistas de Jamendo; máximo 20 solicitudes por minuto.                                       |
| `GET`                    | `/api/catalog/stream/:trackId`                                  | Obtiene una redirección de streaming oficial para el ID seleccionado.                            |
| `GET`, `POST`            | `/api/playlists`                                                | Lista del propietario o crea una playlist.                                                       |
| `GET`, `PATCH`, `DELETE` | `/api/playlists/:playlistId`                                    | Lee, renombra o elimina una playlist propia.                                                     |
| `POST`                   | `/api/playlists/:playlistId/tracks`                             | Recibe `{ catalogTrackId, at, expectedRevision }` e inserta la pista verificada por el servidor. |
| `DELETE`                 | `/api/playlists/:playlistId/tracks/:trackId?expectedRevision=N` | Elimina una canción de la playlist.                                                              |
| `PATCH`                  | `/api/playlists/:playlistId/tracks/:trackId/move`               | Cambia la posición con `{ toIndex, expectedRevision }`.                                          |

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
3. Espera al primer despliegue. Copia la URL `onrender.com` del servicio y reemplaza `<pendiente>` arriba.
4. Crea una aplicación en el [portal de desarrolladores de Jamendo](https://developer.jamendo.com/) e incluye la URL pública del reproductor en la descripción de la aplicación.
5. En las variables del servicio Render, agrega `JAMENDO_CLIENT_ID` con el ID privado de tu aplicación.
6. Si vas a conservar playlists a largo plazo, cambia Postgres a un plan con persistencia permanente antes de guardar datos importantes.

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

Para habilitar el catálogo en ese contenedor, agrega `-e JAMENDO_CLIENT_ID='<tu-id>'` al comando `docker run`; conserva el ID fuera de archivos versionados.

## Límites conocidos y privacidad

- Jamendo ofrece un catálogo de artistas independientes con licencias Creative Commons; no es el catálogo comercial de YouTube Music ni de Spotify. La API exige atribuir al artista y a Jamendo, enlazar la ficha original y respetar la licencia mostrada ([documentación de tracks](https://developer.jamendo.com/v3.0/tracks), [términos de la API](https://devportal.jamendo.com/api_terms_of_use)).
- Los términos publicados de la API permiten uso no comercial. Antes de usar el reproductor con fines comerciales, consulta Jamendo y obtén la autorización o licencia que corresponda.
- La API solo permite streaming; el servidor redirige a la transmisión oficial. No guarda audio, no descarga pistas y mantiene `JAMENDO_CLIENT_ID` fuera de la respuesta al navegador.
- La cookie anónima identifica el navegador. Borrar cookies crea otro propietario y no permite recuperar las playlists anteriores. No hay cuenta, sincronización de usuario autenticada ni recuperación de identidad.
- El servicio se mantiene en el mismo origen en producción: CORS permanece cerrado. Las cookies son `HttpOnly`, `SameSite=Lax` y `Secure` en producción; las consultas parametrizadas y los límites viven en la API.

## Estructura

```text
shared/             lista doble, cursor y esquemas comunes
server/             Fastify, API, migraciones PostgreSQL y adaptador del catálogo Jamendo
web/                React, Vite, motores de reproducción y UI accesible
docs/               decisiones y sistema visual
PRODUCT.md          contexto de producto
DESIGN.md           contrato visual
AGENTS.md           brief de implementación recibido
```

Las decisiones de implementación están en [`docs/DECISIONS.md`](docs/DECISIONS.md); el contrato visual está en [`DESIGN.md`](DESIGN.md) y [`docs/design-system.md`](docs/design-system.md). La verificación está en [`docs/QA.md`](docs/QA.md).
