# Revisión de calidad

Actualizada el 2 de octubre de 2026 para el rediseño editorial y la revisión de cuentas.

## Compilación y pruebas

- `npm run check`: ESLint, Prettier y TypeScript pasan; **70 pruebas pasan y 3 pruebas de integración PostgreSQL se omiten** porque no está configurada `TEST_DATABASE_URL`.
- `npm run build:vercel`: correcto, sin advertencias de tamaño. Salida web: 350.37 kB para la app (102.25 kB gzip), 148.99 kB para animación (49.56 kB gzip) y 41.56 kB de CSS (8.76 kB gzip).
- La prueba de autenticación verifica el alta vinculando las playlists anónimas actuales, inicio de sesión desde una segunda sesión de navegador, correo duplicado, credenciales inválidas y revocación al cerrar sesión. Usa una base de prueba en memoria; no se creó una cuenta de presentación en producción.

## Revisión de interfaz

- Se inspeccionaron el estado vacío, el acceso a cuenta y el registro en escritorio, breakpoint intermedio y móvil. En 360 px CSS el documento mide 360 px y el reproductor queda entre los márgenes internos; en 1100 px CSS la cola termina dentro del viewport. Ambos anchos quedan sin desbordamiento horizontal.
- El formulario móvil cabe dentro de 360 × 800 px y el cursor inicia en el correo. La sección de cuenta está en la barra lateral de escritorio y detrás del menú de playlists en móvil.
- La UI comunica que las playlists se vinculan al crear la cuenta y se consultan desde la nube al iniciar sesión. Los archivos locales no se suben ni sincronizan y se vuelven a seleccionar por dispositivo/sesión.
- El cambio de usuario invalida listas y pistas que todavía estaban cargando, y limpia contenido y archivos temporales antes de cargar la biblioteca asociada a la nueva sesión. «Reintentar» vuelve a comprobar la sesión para recuperar errores transitorios o un cambio de cuenta en otra pestaña.
- Escape y los botones de cierre quedan bloqueados mientras la API procesa el inicio de sesión o el registro.
- La revisión de código y la prueba de autenticación cubren el flujo de cuenta sin añadir ni modificar rutas de backend en esta fase.

## Producción

- El despliegue existente usa Vercel para la interfaz, ECS Express Mode para la API y Aurora PostgreSQL para persistencia. `vercel.json` reescribe `/api/*` al origen HTTPS y evita cachear respuestas privadas.
- La última comprobación previa a la publicación devolvió `200 {"status":"ok"}` en `/api/health`. Después de publicar se debe comprobar de nuevo el build activo y la misma ruta.
- No se probó el registro creando una identidad de prueba en la base real, para no dejar datos de prueba permanentes. La comprobación de persistencia entre dispositivos está cubierta por la prueba de servicio con dos cookies de sesión.

## Catálogo y privacidad

- Las pistas de catálogo persisten como metadatos en PostgreSQL; el audio permanece en su proveedor y el video oficial de YouTube sigue visible.
- Los archivos locales viven en memoria del navegador y se pierden al recargar o cambiar de dispositivo. La interfaz lo explica antes y después de agregarlos.
- No hay recuperación automática de contraseña ni verificación de correo; la UI y el aviso de privacidad lo indican.

## Detector y revisión visual

- `impeccable detect --json` se ejecutó una vez sobre los componentes y estilos afectados. Identificó una transición de altura del progreso, reemplazada por `transform: scaleY()`, y `Instrument Serif`, requerida explícitamente por el brief del usuario. Solo se excluyó ese valor de tipografía en `.impeccable/config.json`.
- La captura no se incorpora al README, según la decisión previa del usuario.
