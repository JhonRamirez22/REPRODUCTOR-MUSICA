# Sistema de diseño — Reproductor

## Dirección

**Modo: Operate.** Una mesa de escucha personal con la claridad de un índice musical impreso: la pista activa y su carátula real ocupan el escenario; la lista doble aparece como una secuencia legible y manipulable. El sistema se deriva del comportamiento real de la cola, no de un catálogo de demostración.

## Primera vista

En escritorio, la pantalla se organiza en tres zonas estables: playlists a la izquierda, reproducción al centro y cola a la derecha. El video visible de YouTube, el título y los controles dominan el centro. En móvil, la navegación se compacta arriba, el contenido pasa a una columna y los controles quedan fijos abajo; la cola se abre como panel inferior.

## Recorrido

Crear una playlist, buscar una canción o artista en YouTube Music, elegir un resultado y su posición, y reproducirlo en el video visible. Los controles de avanzar, retroceder, repetir, mezclar y reordenar quedan cerca de la pista activa. El estado vacío invita a buscar una pista sin mostrar música de ejemplo.

## Interacción distintiva

Cada fila muestra una conexión vertical discreta que hace visible el orden enlazado sin convertir la interfaz en un diagrama. Los botones accesibles de subir y bajar siguen ofreciendo el mismo reordenamiento sin arrastrar.

## Color y contraste

Se usa la paleta cálida oscura del brief: fondo `#121110`, superficies `#1b1917` y `#25221f`, texto `#f3efe9`, texto secundario `#a39b91` y acento coral `#ff6b3d`. El acento se reserva para reproducir, la selección activa y el foco. Los controles sobre coral usan texto oscuro `#121110`.

## Tipografía y forma

La UI emplea una pila nativa legible con fallback local; no depende de fuentes remotas. Títulos, nombres y duraciones crean jerarquía mediante tamaño, peso y espacio. Superficies planas, bordes finos y radios contenidos mantienen la densidad del reproductor sin paneles anidados ni sombras decorativas.

## Movimiento

Las transiciones de estado duran entre 150 y 250 ms y usan `transform` u `opacity`. `prefers-reduced-motion` elimina el desplazamiento y conserva los cambios de estado.

## Accesibilidad

Foco visible, etiquetas en botones de icono, controles nativos, objetivos táctiles de al menos 44 px, cambios de pista en una región `aria-live="polite"`, lista semántica y operación completa por teclado.

## Límites

No precargar canciones, playlists, URLs, IDs ni carátulas ficticias. No aceptar enlaces de música introducidos manualmente; las pistas se descubren mediante `ytmusicapi`. No ocultar el reproductor de YouTube ni extraer audio. No usar degradados decorativos, brillos, emojis, tarjetas anidadas ni controles solo por arrastre. El contenido de terceros se representa desde sus metadatos o miniaturas reales.
