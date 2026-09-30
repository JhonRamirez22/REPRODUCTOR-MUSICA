# Revisión de calidad

Actualizada el 30 de septiembre de 2026 para la búsqueda pública de YouTube Music y la reproducción mediante el reproductor oficial de YouTube.

## Construcción y pruebas

- `npm run check`: correcto. ESLint, Prettier, TypeScript y **37 pruebas pasaron**, incluidas las pruebas de integración con PostgreSQL ejecutadas con una base temporal aislada.
- `npm run build`: correcto. El bundle web quedó en 333.73 kB (97.28 kB gzip) de JavaScript y 25.68 kB (5.71 kB gzip) de CSS.
- `server/python/search.py` consultó en vivo `ytmusicapi` con `Oasis Wonderwall` y devolvió 20 canciones válidas. También se comprobó `/api/catalog/search` en el servidor compilado.
- La prueba manual en navegador buscó una canción, la agregó desde resultados, confirmó la persistencia y reprodujo el video en el iframe oficial de YouTube. Se verificó pausa desde los controles de la app; la playlist temporal usada para QA se eliminó al terminar.
- Las pruebas automatizadas del catálogo simulan `ytmusicapi`; no dependen del servicio externo. Las pruebas PostgreSQL usan `TEST_DATABASE_URL` y no emplean la base de datos de producción.

## Interfaz y accesibilidad

- El diálogo de alta busca en YouTube Music y exige elegir un resultado antes de agregarlo. Ya no pide pegar enlaces.
- La lista muestra miniatura, título, artistas, duración y atribución a YouTube Music. Los controles del reproductor manejan el video mediante la API oficial de YouTube.
- No se incorpora captura al README, según la decisión del usuario.
- Lighthouse no quedó disponible para medir sus metas de rendimiento y buenas prácticas.

## Configuración y límites

- `ytmusicapi` es una biblioteca Python comunitaria, no una API key oficial. La búsqueda pública funciona sin credenciales ni cookies; YouTube puede cambiar las solicitudes que usa la biblioteca.
- La reproducción usa el iframe oficial visible de YouTube. La app guarda metadatos e identificadores, y no descarga ni separa el audio del video.
- Se conserva la ruta Jamendo solo para reproducir referencias creadas por una versión anterior; las búsquedas y altas nuevas usan YouTube Music.
- No se pudo validar una imagen Docker porque el daemon local no estaba disponible. Tampoco se ha publicado el proyecto: la URL de producción sigue pendiente de una cuenta y despliegue del propietario.
