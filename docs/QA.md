# Revisión de calidad

Actualizada el 1 de octubre de 2026 tras integrar reproducción temporal de archivos locales.

## Compilación y análisis estático

- `npm run lint`: correcto; ESLint y Prettier pasaron.
- `npm run typecheck`: correcto en `shared`, `server` y `web`.
- `npm run check`: correcto; **55 pruebas pasaron** y 3 pruebas PostgreSQL se omitieron porque no se configuró `TEST_DATABASE_URL`.
- `npm run build`: correcto. El bundle web quedó en 340.00 kB (99.34 kB gzip) de JavaScript y 26.59 kB (5.85 kB gzip) de CSS.
- `impeccable detect --json` sobre los componentes y estilos modificados: `[]`, sin hallazgos.

## Catálogo y reproducción

- `server/python/search.py` consultó en vivo `ytmusicapi` con `Oasis Wonderwall` y devolvió 20 resultados válidos. También se comprobó `/api/catalog/search` en el servidor compilado.
- La prueba manual anterior en navegador buscó una canción, la agregó desde resultados, confirmó la persistencia en PostgreSQL y reprodujo el video en el iframe oficial de YouTube. La playlist temporal de QA se eliminó.
- La búsqueda simulada verifica reintento después de falta del paquete; la UI no enseña instrucciones de configuración del servidor, y el alta rechaza posiciones inválidas.
- La UI no acepta enlaces para altas nuevas. Solo agrega un video elegido de resultados y el servidor verifica de nuevo que corresponda a la consulta.
- YouTube pausa al ocultarse la página y no registra controles de Media Session: sus políticas prohíben reproducir YouTube en segundo plano. Media Session queda disponible para fuentes de audio directo.
- La selección local acepta varios archivos de audio, valida tipos y extensiones reconocidos, los asocia a la playlist activa en la cola enlazada de esta sesión y no llama a la API. La URL `blob:` se revoca al cambiar de fuente o destruir el motor.
- En el navegador se eligió un WAV de prueba de ocho segundos; el título local apareció en reproducción y el tiempo avanzó. El archivo se procesó solo en el navegador.

## Interfaz y accesibilidad

- Revisión visual manual en escritorio (1270 × 714) y móvil (360 × 800): sin desbordamiento horizontal. La cola vacía sin playlists invita a crear una.
- Los objetivos táctiles de móvil tienen al menos 44 × 44 px. El reproductor muestra los atajos de teclado. Se verificaron variantes oscura y clara.
- Contraste calculado: texto principal 16.47:1 en oscuro y 14.25:1 en claro; texto secundario 6.39:1 y 6.44:1; texto del botón acento 6.67:1 y 5.46:1.
- La crítica de interfaz encontró y corrigió mensajes internos de configuración, CTA incorrecta cuando no existen playlists, validación del índice y falta de pista visible de atajos.
- La CLI de Impeccable instalada no incluye comandos `audit`, `critique` ni `polish`; se usaron las guías de la skill y dos revisiones independientes, además del detector disponible.
- Lighthouse móvil: **Accesibilidad 100 y Buenas prácticas 100**. La captura no se incorpora al README, según la decisión del usuario.

## Despliegue local

- `docker build --tag reproductor-estructuras-datos .`: correcto. La imagen multi-stage instaló `ytmusicapi` y compiló shared, web y server.
- La imagen arrancó conectada a la base PostgreSQL temporal. `/api/health` devolvió `200`, `/api/catalog/status` devolvió `{ "enabled": true }` y la búsqueda real de YouTube Music devolvió resultados.
- Prueba HTTP de extremo a extremo: cookie de propietario, creación de playlist, búsqueda real, alta validada por el servidor, recarga con la pista persistida y borrado de la playlist temporal.
- La vista previa Vite se revisó en `http://127.0.0.1:5173`; la prueba de reproducción usó un WAV sintético temporal.

## Límites y despliegue

- `ytmusicapi` es una biblioteca comunitaria no oficial, no una API key. Las búsquedas públicas no requieren credenciales; YouTube puede cambiar las solicitudes que usa la biblioteca.
- El reproductor de YouTube se conserva visible (mínimo 200 × 200 px). La aplicación no descarga ni separa audio. Las reglas de reproducción en segundo plano se documentan en el README y en `docs/DECISIONS.md`.
- Frontend público: <https://reproductor-musica-bice.vercel.app>. API pública: <https://re-06c0b12191414b5aa42f2fbea8f52b6a.ecs.us-east-1.on.aws>. La aplicación AWS existente usa Aurora PostgreSQL Express con un día de retención, el límite aceptado por el plan Free.
- El archivo local se agrega al final de la playlist solo durante la sesión; no se sube, y habrá que elegirlo otra vez tras recargar.
