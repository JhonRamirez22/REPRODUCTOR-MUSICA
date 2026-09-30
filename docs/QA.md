# Revisión de calidad

Actualizada el 30 de septiembre de 2026 tras integrar la búsqueda pública de YouTube Music y los últimos ajustes del reproductor.

## Compilación y análisis estático

- `npm run lint`: correcto; ESLint y Prettier pasaron.
- `npm run typecheck`: correcto en `shared`, `server` y `web`.
- `TEST_DATABASE_URL= npm run check`: correcto; **41 pruebas pasaron y 3 pruebas de integración con PostgreSQL se omitieron** porque no había una base de prueba disponible en el sandbox.
- `npm run build`: correcto. El bundle web quedó en 335.36 kB (97.73 kB gzip) de JavaScript y 25.92 kB (5.75 kB gzip) de CSS.
- `impeccable detect --json web/src`: `[]`, sin hallazgos.

## Catálogo y reproducción

- `server/python/search.py` consultó en vivo `ytmusicapi` con `Oasis Wonderwall` y devolvió 20 resultados válidos. También se comprobó `/api/catalog/search` en el servidor compilado.
- La prueba manual anterior en navegador buscó una canción, la agregó desde resultados, confirmó la persistencia en PostgreSQL y reprodujo el video en el iframe oficial de YouTube. La playlist temporal de QA se eliminó.
- La búsqueda simulada verifica reintento después de falta del paquete; la UI no enseña instrucciones de configuración del servidor, y el alta rechaza posiciones inválidas.
- La UI no acepta enlaces para altas nuevas. Solo agrega un video elegido de resultados y el servidor verifica de nuevo que corresponda a la consulta.
- YouTube pausa al ocultarse la página y no registra controles de Media Session: sus políticas prohíben reproducir YouTube en segundo plano. Media Session queda disponible para fuentes de audio directo.

## Interfaz y accesibilidad

- Revisión visual manual en escritorio (1270 × 714) y móvil (360 × 800): sin desbordamiento horizontal. La cola vacía sin playlists invita a crear una.
- Los objetivos táctiles de móvil tienen al menos 44 × 44 px. El reproductor muestra los atajos de teclado. Se verificaron variantes oscura y clara.
- Contraste calculado: texto principal 16.47:1 en oscuro y 14.25:1 en claro; texto secundario 6.39:1 y 6.44:1; texto del botón acento 6.67:1 y 5.46:1.
- La crítica de interfaz encontró y corrigió mensajes internos de configuración, CTA incorrecta cuando no existen playlists, validación del índice y falta de pista visible de atajos.
- La CLI de Impeccable instalada no incluye comandos `audit`, `critique` ni `polish`; se usaron las guías de la skill y dos revisiones independientes, además del detector disponible.
- No se incorpora captura al README, según la decisión del usuario. No se obtuvo una puntuación Lighthouse: el ejecutable no está instalado y Chrome no estuvo disponible para la medición automatizada.

## Pruebas no verificadas en esta sesión

- `docker build` no se pudo ejecutar: el sandbox no permitió acceso al socket local de Docker. Tampoco se pudo repetir la integración PostgreSQL contra una instancia viva ni iniciar el contenedor contra esa base.
- El acceso puntual a red y al socket de Docker solicitado para completar esas verificaciones no quedó concedido.

## Límites y despliegue

- `ytmusicapi` es una biblioteca comunitaria no oficial, no una API key. Las búsquedas públicas no requieren credenciales; YouTube puede cambiar las solicitudes que usa la biblioteca.
- El reproductor de YouTube se conserva visible (mínimo 200 × 200 px). La aplicación no descarga ni separa audio. Las reglas de reproducción en segundo plano se documentan en el README y en `docs/DECISIONS.md`.
- La URL pública queda como `<pendiente>`: el despliegue requiere cuentas y credenciales del propietario. No se intentó autenticar en la nube.
