# Revisión de calidad

Actualizada el 30 de septiembre de 2026 para la integración del catálogo Jamendo.

## Construcción y pruebas

- `npm run check`: correcto. ESLint, Prettier, TypeScript y pruebas: **30 pasaron; 3 pruebas PostgreSQL se omitieron** porque no existe `TEST_DATABASE_URL` y Docker no puede conectarse al socket local.
- `npm run build`: correcto. El bundle web quedó en 333.50 kB (97.22 kB gzip) de JavaScript y 26.20 kB (5.81 kB gzip) de CSS. Incluye `/privacy.html`.
- Las pruebas nuevas simulan la API de Jamendo. Verifican búsqueda, metadatos, enlace de licencia, ID verificado al insertar, redirección de streaming y que el `client_id` no llegue a la respuesta del navegador.
- La migración `002_jamendo_catalog.sql` y la suite PostgreSQL requieren una ejecución cuando haya una base local disponible; no se atribuye a esta revisión una verificación de la migración en un servidor Postgres.

## Interfaz y accesibilidad

- Las pruebas de componentes verifican la búsqueda, selección, inserción en la posición elegida, resultados obsoletos ignorados, estado sin credencial y enlace de atribución de Jamendo en la cola.
- La corrección anterior de accesibilidad móvil quedó en `46744be`: los paneles cerrados se excluyen del árbol accesible, se atrapa el foco en los abiertos y los controles táctiles pequeños miden al menos 44 × 44 px.
- La pantalla principal se revisó antes de añadir el catálogo. El nuevo diálogo de búsqueda no tuvo inspección visual manual en navegador en esta pasada.
- Los tokens de texto de ambos temas superaban WCAG AA en la revisión anterior: tema oscuro, texto principal 16.47:1, secundario 6.88:1 y acento 6.67:1; tema claro, 14.25:1, 5.76:1 y 5.46:1.
- Lighthouse no está instalado, por lo que las metas móviles de 95 en accesibilidad y buenas prácticas siguen sin medirse.
- No se incorpora captura al README, según la decisión del usuario.

## Configuración y límites de verificación

- El código está conectado al API oficial, pero no se ha consultado el catálogo en vivo: falta configurar una credencial propia `JAMENDO_CLIENT_ID`.
- No se probó una reproducción real contra Jamendo ni se inspeccionaron visualmente los resultados remotos.
- La publicación y URL de producción siguen pendientes de una cuenta del proveedor y del primer despliegue.
