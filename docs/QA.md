# Revisión de calidad

Verificación realizada el 30 de septiembre de 2026 sobre el proyecto local.

## Construcción y pruebas

- `npm run check`: correcto. ESLint y Prettier, TypeScript y pruebas: **43 pasaron; 3 pruebas PostgreSQL se omitieron** porque Colima/PostgreSQL no estaban disponibles en esta última ejecución.
- `npm run build`: correcto. El bundle web quedó en 328.34 kB (95.65 kB gzip) de JavaScript y 22.82 kB (5.30 kB gzip) de CSS.
- La suite PostgreSQL se había ejecutado completa anteriormente con 45 pruebas aprobadas. Tras esa ejecución se añadió una prueba unitaria del nombre de archivo codificado; en esta última pasada esa prueba pasó y las tres integraciones quedaron omitidas por falta de la base de prueba.
- La imagen Docker se construyó y ejecutó contra PostgreSQL local: `/api/health` respondió 200, `/api/playlists` respondió 200 con `[]`, y una ruta de cliente respondió 200 con HTML.

## Interfaz, accesibilidad y seguridad

- Inspección visual en escritorio y en 360 px, además de los estados de diálogo, cola móvil y reproductor expandido. En 360 px no hubo desbordamiento horizontal; teclado Escape cerró el reproductor expandido y devolvió el foco al control de apertura.
- El flujo manual de creación, vista previa, inserción y eliminación de una pista de audio de prueba terminó con la playlist vacía. La consola no mostró errores nuevos después de corregir el bucle de renderizado.
- Las razones de contraste calculadas para texto fueron: tema oscuro, texto principal 16.47:1, texto secundario 6.88:1 y texto de acento 6.67:1; tema claro, 14.25:1, 5.76:1 y 5.46:1. Todas superan 4.5:1.
- `impeccable detect --fast .` terminó correctamente; la versión instalada informa que `--fast` se ignora. Los escaneos JSON de `web/src` y de la vista local a 360 × 800 devolvieron `[]`.
- El ejecutable Lighthouse no está instalado, así que los umbrales móviles de 95 para accesibilidad y buenas prácticas no se midieron. No se atribuye una puntuación estimada.
- La interfaz quedó capturada y revisada dentro del navegador. La política del navegador bloqueó la navegación a una URL `data:` para exportar el JPEG, por lo que no se guarda una imagen en el repositorio ni se enlaza una captura inexistente.

## Hallazgos pendientes

- **P2 — Lighthouse sin medición:** falta ejecutar Lighthouse móvil cuando esté disponible para verificar las dos puntuaciones mínimas requeridas.
- **P2 — Imagen no adjunta al README:** la captura visual no se pudo exportar al árbol del proyecto con las herramientas permitidas. La implementación incluye el estado visual revisado; el archivo de evidencia queda pendiente.

No se observaron hallazgos P0 o P1 durante esta revisión. La URL de producción también queda pendiente del primer despliegue autenticado, como indica el README.
