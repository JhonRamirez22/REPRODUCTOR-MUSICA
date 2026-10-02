# Reproductor de playlists

Aplicación web en español para crear playlists persistentes y buscar canciones en YouTube Music mediante [`ytmusicapi`](https://github.com/sigma67/ytmusicapi). Una lista doblemente enlazada implementada a mano conserva el orden en el servidor y dirige la navegación en el cliente. La app guarda referencias y metadatos; nunca sube ni extrae archivos de audio.

**URL de producción: `<pendiente de verificar>`**. El frontend se publica como sitio estático en Vercel; la API corre en ECS Express Mode y PostgreSQL en Aurora Express con IAM y TLS.

## Funciones

- Crear, renombrar, cambiar y eliminar playlists con PostgreSQL e identidad anónima por cookie firmada.
- Buscar por título o artista, elegir un resultado de YouTube Music y agregarlo al inicio, al final o en una posición elegida.
- Verificar en el servidor que el video seleccionado pertenece a la búsqueda antes de guardarlo; la interfaz no ofrece entrada de enlaces.
- Reproducir mediante el reproductor oficial de YouTube visible, con play/pausa, progreso, volumen, anterior, siguiente, repetición y shuffle. Media Session se usa en pistas de audio directo.
- Reordenar con controles accesibles, eliminar pistas, permitir duplicados y saltar fuentes no disponibles.
- Diseño adaptable, operación por teclado y estados de carga, error y vacío.

No se precarga música de demostración. La búsqueda pública no requiere API key ni cuenta. El reproductor almacena el `videoId` y metadatos, no el audio.

## Requisitos

- Node.js 22 y npm.
- Python 3.10 o posterior con `pip`.
- Docker Compose para PostgreSQL en desarrollo y las pruebas de integración.

## Desarrollo local

Desde la raíz de este repositorio:

```bash
cp .env.example .env
docker compose up -d db
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
npm run dev
```

Abre <http://localhost:5173>. Vite envía `/api` a Fastify en el puerto 3000. La primera petición entrega una cookie de propietario y el servidor aplica las migraciones al iniciar.

`ytmusicapi` realiza búsquedas públicas sin autenticar. El proyecto que enlazaste es la biblioteca cliente, no una API key. `.env.example` configura el Python del entorno virtual; ajusta `YTMUSIC_PYTHON` si lo creaste en otra ruta. No copies cookies, encabezados de sesión ni credenciales de tu cuenta de YouTube.

Para probar rutas de producción y archivos compilados:

```bash
npm run build
npm start
```

El servidor publica `web/dist`; las rutas que no comienzan por `/api/` devuelven la app cliente.

### Variables de entorno

| Variable                  |   Requerida | Predeterminado                 | Descripción                                                                            |
| ------------------------- | ----------: | ------------------------------ | -------------------------------------------------------------------------------------- |
| `NODE_ENV`                |          No | `development`                  | `development`, `test` o `production`.                                                  |
| `PORT`                    |          No | `3000`                         | Puerto HTTP; Render inyecta el suyo.                                                   |
| `DATABASE_URL`            | Condicional | Base `reproductor` del Compose | Cadena PostgreSQL local o de otros proveedores; no se combina con autenticación IAM.   |
| `PGHOST`                  | Condicional | Sin configurar                 | Endpoint Aurora para autenticación IAM.                                                |
| `PGPORT`                  |          No | `5432`                         | Puerto PostgreSQL del clúster.                                                         |
| `PGDATABASE`              | Condicional | Sin configurar                 | Base PostgreSQL cuando se usa autenticación IAM.                                       |
| `PGUSER`                  | Condicional | Sin configurar                 | Usuario PostgreSQL con `rds_iam` concedido.                                            |
| `AWS_REGION`              | Condicional | Sin configurar                 | Región AWS para generar tokens de autenticación IAM.                                   |
| `COOKIE_SECRET`           |          Sí | Marcador en `.env.example`     | Secreto de al menos 32 caracteres; en producción se inyecta desde AWS Secrets Manager. |
| `YTMUSIC_PYTHON`          |          No | `python3`                      | Intérprete que tiene instalado `ytmusicapi`.                                           |
| `YTMUSIC_API_URL`         |          No | Sin configurar                 | URL HTTPS `/api` de un servicio de catálogo separado.                                  |
| `YTMUSIC_API_TOKEN`       |          No | Sin configurar                 | Secreto compartido de al menos 32 caracteres; requerido junto a `YTMUSIC_API_URL`.     |
| `MAX_PLAYLISTS_PER_OWNER` |          No | `50`                           | Tope por cookie de propietario.                                                        |
| `MAX_TRACKS_PER_PLAYLIST` |          No | `500`                          | Tope por playlist.                                                                     |
| `BODY_LIMIT_BYTES`        |          No | `16384`                        | Tamaño máximo del JSON, limitado a 16 KiB.                                             |
| `RATE_LIMIT_MAX`          |          No | `120`                          | Peticiones por minuto e IP; las búsquedas usan 20 por minuto.                          |
| `TEST_DATABASE_URL`       |          No | Sin configurar                 | Base aislada para pruebas PostgreSQL.                                                  |
| `JAMENDO_CLIENT_ID`       |          No | Sin configurar                 | Solo permite reproducir registros de Jamendo guardados por una versión anterior.       |

`.env.example` solo sirve para desarrollo local. No pongas secretos reales en Git ni en capturas.

Para Aurora, configura `PGHOST`, `PGDATABASE`, `PGUSER` y `AWS_REGION` juntos; el rol de la tarea ECS obtiene permisos `rds-db:connect` y el SDK genera tokens temporales. En desarrollo local y otros proveedores PostgreSQL puedes usar `DATABASE_URL`. `YTMUSIC_API_URL` y `YTMUSIC_API_TOKEN` se configuran juntos solo si separas el catálogo en otro servicio; si faltan, el adaptador Python local se usa dentro del contenedor.

## Comprobaciones y pruebas

```bash
# ESLint, formato, TypeScript y pruebas
npm run check

# Compilación de shared, frontend y servidor
npm run build
```

Las pruebas del catálogo simulan el ejecutor de `ytmusicapi` y no llaman al servicio externo. Las pruebas PostgreSQL se omiten cuando no existe `TEST_DATABASE_URL`. Para ejecutarlas con la base temporal:

```bash
docker compose --profile test up -d test-db
TEST_DATABASE_URL=postgres://reproductor:reproductor_local@localhost:15433/reproductor_test npm test
docker compose --profile test down
```

No configures las pruebas contra una base con datos que quieras conservar. `npm run build` no necesita una base; iniciar el servidor sí requiere que `DATABASE_URL` responda.

La revisión visual y las verificaciones están resumidas en [`docs/QA.md`](docs/QA.md). No se incluye captura, según la decisión del usuario. El aviso de privacidad público está disponible en `/privacy.html`.

## API

Todas las rutas usan JSON y el prefijo `/api`. Las mutaciones reciben `expectedRevision`; una edición concurrente devuelve `409 revision_conflict`. Los errores comparten `{ "error": { "code", "message", "details"? } }`.

| Método                   | Ruta                                                            | Resultado                                                                                       |
| ------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`                    | `/api/health`                                                   | Estado del servidor y PostgreSQL; devuelve `503` si la BD no responde.                          |
| `GET`                    | `/api/catalog/status`                                           | Indica si el paquete `ytmusicapi` está instalado en el runtime.                                 |
| `GET`                    | `/api/catalog/search?q=...`                                     | Busca canciones públicas en YouTube Music; máximo 20 solicitudes por minuto.                    |
| `GET`, `POST`            | `/api/playlists`                                                | Lista del propietario o crea una playlist.                                                      |
| `GET`, `PATCH`, `DELETE` | `/api/playlists/:playlistId`                                    | Lee, renombra o elimina una playlist propia.                                                    |
| `POST`                   | `/api/playlists/:playlistId/tracks`                             | Recibe `{ query, videoId, at, expectedRevision }`; el servidor vuelve a verificar el resultado. |
| `DELETE`                 | `/api/playlists/:playlistId/tracks/:trackId?expectedRevision=N` | Elimina una canción.                                                                            |
| `PATCH`                  | `/api/playlists/:playlistId/tracks/:trackId/move`               | Cambia la posición con `{ toIndex, expectedRevision }`.                                         |

Ejemplo de comprobación local:

```bash
curl -i http://localhost:3000/api/health
curl -i -c /tmp/reproductor-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mi música"}' \
  http://localhost:3000/api/playlists
```

## Despliegue en AWS y Vercel

La API y la búsqueda de catálogo se ejecutan juntas en el contenedor Fastify: la imagen instala Python y `ytmusicapi`, aplica las migraciones al arrancar y sirve `web/dist` en despliegues autocontenidos. En producción, Vercel sirve únicamente el frontend y reescribe `/api/*` al servicio HTTPS de ECS Express Mode.

### API y PostgreSQL en AWS

- CodeBuild compila el repositorio usando `buildspec.aws.yml` y publica la imagen en ECR `reproductor-estructuras-datos-api` con una etiqueta derivada del commit.
- ECS Express Mode sirve la imagen por HTTPS en `https://reproductor-estructuras-datos-api.ecs.us-east-1.on.aws`. El contenedor escucha en `3000`; el healthcheck es `/api/health`.
- Aurora PostgreSQL Express usa IAM para autenticar conexiones y TLS para cifrar la red. El clúster crea primero la base administrada `postgres`; después se crea `reproductor`, porque Express no admite `DatabaseName` al crear el clúster.
- La identidad de tarea de ECS recibe `rds-db:connect` para el usuario PostgreSQL de la app. `COOKIE_SECRET` se inyecta desde AWS Secrets Manager; no se guarda en Git ni en Vercel.
- El plan Free de la cuenta AWS limita la retención configurada a 1 día. La aplicación sigue guardando datos en Aurora; este valor acorta la ventana de recuperación de backups.

### Frontend en Vercel

El proyecto Vercel conectado a `JhonRamirez22/REPRODUCTOR-MUSICA` debe usar el directorio raíz `.`. El archivo `vercel.json` selecciona Vite, compila con `npm run build:vercel`, publica `web/dist` y reescribe `/api/:path*` hacia ECS. Las respuestas de la API llevan `Cache-Control: no-store` porque incluyen playlists privadas asociadas a cookies.

No hacen falta variables de entorno para la API en Vercel: el proxy mantiene las peticiones y cookies bajo el dominio visible del frontend. Configura el mismo origen para Production y Preview solo cuando exista también un backend para ese entorno. Comprueba `https://<dominio-principal>/api/health`; después reemplaza `<pendiente de verificar>` por el dominio público confirmado.

La reescritura externa está documentada en [Rewrites de Vercel](https://vercel.com/docs/routing/rewrites) y la configuración de compilación y salida en [`vercel.json`](https://vercel.com/docs/project-configuration/vercel-json). La guía de [ECS Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html) documenta el endpoint HTTPS administrado.

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

El contenedor ya incluye el intérprete y el paquete Python para búsquedas públicas; no requiere una API key.

## Límites conocidos y privacidad

- `ytmusicapi` es una biblioteca no oficial que reproduce las solicitudes web públicas de YouTube Music. No tiene una clave de API propia; la búsqueda no autenticada puede cambiar o dejar de funcionar si YouTube cambia su interfaz. No se envían cookies ni credenciales de usuario. Consulta el [proyecto y su documentación](https://github.com/sigma67/ytmusicapi).
- La reproducción usa el YouTube IFrame Player API con el video visible (mínimo 200 × 200 px). La app pausa YouTube cuando la página queda oculta: las [políticas de YouTube para desarrolladores](https://developers.google.com/youtube/terms/developer-policies-guide) prohíben habilitar reproducción en segundo plano, descargar o separar audio. Media Session queda habilitada para fuentes de audio directo.
- El servidor pasa el texto de búsqueda a `ytmusicapi`; el navegador carga la miniatura de YouTube y el reproductor oficial al reproducir. YouTube recibe las solicitudes y datos técnicos que requiere la reproducción.
- Solo se guardan el `videoId`, título, artista, duración, miniatura, posición y referencia de origen. No se almacena audio.
- La cookie anónima identifica el navegador. Borrarla crea otro propietario y no permite recuperar playlists anteriores. No hay cuenta ni recuperación de identidad.
- El servicio permanece en el mismo origen en producción: CORS está cerrado. Las cookies son `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- `/api/catalog/stream/:trackId` y `JAMENDO_CLIENT_ID` solo se conservan para reproducir pistas Jamendo creadas por una versión anterior; el buscador actual no usa Jamendo.

## Estructura

```text
shared/             lista doble, cursor y esquemas comunes
server/             Fastify, API, migraciones y adaptador de ytmusicapi
server/python/      puente JSON pequeño hacia la biblioteca Python
web/                React, Vite, motores de reproducción y UI accesible
docs/               decisiones, QA y sistema visual
PRODUCT.md          contexto de producto
DESIGN.md           contrato visual
AGENTS.md           brief de implementación recibido
```

Las decisiones están en [`docs/DECISIONS.md`](docs/DECISIONS.md); el contrato visual, en [`DESIGN.md`](DESIGN.md) y [`docs/design-system.md`](docs/design-system.md); la verificación, en [`docs/QA.md`](docs/QA.md).
