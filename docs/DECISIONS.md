# Decisiones

- Se crea el proyecto en `outputs/reproductor-estructuras-datos` porque el workspace de esta tarea es el directorio de salida autorizado; el directorio indicado contiene el brief, no código inicial.
- La interfaz parte del fallback de tokens de la sección 9.4 de `AGENTS.md`: `uipro` y su generador `search.py` no están instalados en el entorno; no añado esa herramienta como dependencia de producción.
- La dirección de diseño conserva el dark-first cálido, un acento coral, tipografía de sistema y jerarquía por espacio indicados en `AGENTS.md`; no se carga tipografía remota para evitar una dependencia de red de la interfaz.
- `jsdom` queda como dependencia de desarrollo junto a Testing Library porque los componentes React requieren un DOM para verificar sus interacciones; no forma parte de la imagen de producción.
- `TEST_DATABASE_URL` queda comentada en `.env.example` para que `npm run check` no intente conectarse ni borrar datos hasta que se active el perfil temporal de pruebas de PostgreSQL.
- `VITE_API_PROXY_TARGET` permite apuntar Vite a otro puerto de Fastify si el 3000 ya está ocupado en desarrollo.
- A petición del usuario, la búsqueda e inserción de pistas usa `ytmusicapi`, solicitada mediante el repositorio compartido; es una biblioteca no oficial y la consulta pública de catálogo no necesita API key ni autenticación.
- El servidor valida que el `videoId` elegido aparezca para el texto de búsqueda y guarda solo metadatos y referencia; el navegador reproduce el resultado en el YouTube IFrame Player API visible y no descarga ni extrae audio.
- La app instala `ytmusicapi` en un entorno Python aislado dentro de Docker. En desarrollo se fija `ytmusicapi==1.12.3` en `server/requirements.txt`; la decisión de añadir una dependencia Python externa se justifica por la petición explícita del usuario de emplear esa biblioteca.
- En Vercel, el backend Fastify y `ytmusicapi` se despliegan como dos proyectos del mismo repositorio: Vercel ejecuta cada función en un runtime independiente y el runtime Node no puede asumir que tiene instalado el paquete Python. Fastify llama a la función Python por HTTPS con un token aleatorio compartido; el adaptador de búsqueda se mantiene en `ytmusic-function/catalog.py` para usar la misma lógica local y remota.
- El entrypoint Fastify de Vercel se publica como una única función de framework; por eso `npm run build:vercel` genera un módulo ESM con frontend y migraciones incrustados, evitando una regla `functions` que solo admite funciones `api/`.
- `JAMENDO_CLIENT_ID` y la ruta de streaming antigua se conservan únicamente para compatibilidad de reproducción con registros creados por la versión anterior; el buscador ya no usa Jamendo.
- YouTube prohíbe la reproducción en segundo plano: el iframe se pausa al ocultarse la página y Media Session solo se registra para fuentes de audio directo, de modo que sus controles no reanuden YouTube en segundo plano.
