# Sistema de diseño — Reproductor

## Dirección

**Modo: Operate.** Un reproductor editorial oscuro donde la portada y la pista activa llevan el peso visual. La lista doble se mantiene visible como una cola real, directa y operable. No hay catálogo de demostración: el contenido viene de YouTube Music o de archivos elegidos por la persona.

## Primera vista

En escritorio, la barra lateral agrupa playlists y cuenta, la pista ocupa el escenario central y la cola permanece a la derecha. En móvil, la barra lateral se abre desde el menú superior, los controles se compactan en la parte inferior y la cola aparece como panel deslizable. El CTA de cuenta presenta explícitamente la sincronización para que la persistencia entre dispositivos sea visible desde el primer uso.

## Recorrido de cuenta y biblioteca

Una persona puede crear una cuenta o iniciar sesión desde la sección «Sincroniza tus playlists». El registro vincula a la cuenta las playlists anónimas creadas en ese mismo navegador. La autenticación carga la biblioteca de la cuenta desde Aurora PostgreSQL, por lo que las playlists y las pistas elegidas del catálogo siguen disponibles en otros dispositivos. La cola y la fuente actual se reinician al cambiar de cuenta para no mezclar contenido entre propietarios.

Los archivos locales son temporales: se agregan a la cola en memoria del navegador, no se suben y se deben volver a elegir después de cambiar de dispositivo o iniciar otra sesión. La UI informa el límite antes de enviar esos archivos. La cuenta usa correo y contraseña; no existe recuperación automática ni confirmación por correo.

## Color y contraste

El tema oscuro editorial usa fondo `#0b0b0c`, superficies `#121214`, `#19191b` y `#242426`, texto `#f2f0eb` y secundarios con opacidad del 58% y 34%. El acento base es `#c7a876`; cuando la pista tiene una portada accesible, se muestrea en un canvas nativo, se ajusta para texto AA frente al fondo y se asigna a `--accent`. Si la portada no se puede leer por CORS o falta, se conserva el acento base. Un halo tenue de hasta 11% sigue el color de la portada.

La app empieza en oscuro y respeta movimiento reducido. Hay tokens claros explícitos para una variante futura, pero el producto no cambia de tema automáticamente por la preferencia del sistema.

## Tipografía y forma

DM Sans organiza controles y metadatos; Instrument Serif resalta el nombre de la canción. Ambas fuentes se sirven localmente desde archivos WOFF2 con sus licencias OFL para evitar una dependencia de red en la carga. La portada usa un radio de 20 px. El resto prefiere separación, líneas de borde suaves y superficies planas; el acento identifica estado activo, reproducción y foco.

## Movimiento

Framer Motion utiliza el spring de marca `{ stiffness: 300, damping: 30, mass: 0.8 }` para cambios de posición, y reduce los cambios a fades breves cuando la persona tiene `prefers-reduced-motion`. La cola admite tanto arrastre como botones de mover; en móvil el panel se puede abrir con su CTA además de arrastrarlo. El progreso usa MotionValue para evitar renderizar React en cada actualización de tiempo.

## Accesibilidad

Foco visible, etiquetas accesibles, controles por teclado y áreas táctiles de al menos 44 px. Al abrir registro o login, el foco comienza en el campo de correo. La cola móvil atrapa foco mientras está abierta y conserva los controles accesibles de orden. Las barras de progreso anuncian tiempo y duración.

## Límites

No precargar canciones, playlists, URLs, IDs ni carátulas ficticias. No aceptar enlaces de música introducidos manualmente; las pistas se descubren mediante `ytmusicapi`. Los archivos locales se reproducen desde el navegador sin subirlos. No ocultar el reproductor oficial de YouTube ni extraer audio. El proyecto requiere mantener las funciones y la persistencia existentes mientras se rediseña la interfaz.
