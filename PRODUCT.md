# Producto

<!-- impeccable:product-schema 1 -->

## Plataforma

web

## Stack

Monorepo TypeScript con Node.js, Fastify, PostgreSQL, React y Vite, según el stack definido en el brief entregado.

## Usuarios

Inferido del taller: estudiantes que aprenden estructuras de datos y necesitan demostrar operaciones de playlist; también personas que organizan música desde un catálogo de artistas independientes.

## Propósito

Permitir crear playlists persistentes, buscar música mediante una API de catálogo y escuchar, ordenar y recorrer sus pistas. El éxito consiste en mostrar una lista doblemente enlazada real mientras la app funciona como reproductor.

## Posicionamiento

La misma lista doblemente enlazada implementada a mano dirige las mutaciones del servidor y el cursor de reproducción del cliente. Este mecanismo es un requisito explícito del brief.

## Contexto de uso

La persona busca una canción o artista en el catálogo, elige una pista, decide dónde insertarla y recorre la cola con controles, teclado o botones táctiles. Una cookie firmada conserva la propiedad anónima del navegador.

## Capacidades y restricciones

- La UI y la documentación del producto están en español; los identificadores del código están en inglés.
- Las playlists y las pistas persisten en PostgreSQL. El audio no se sube ni se almacena.
- La fuente de las pistas nuevas es el catálogo de Jamendo; se conserva un enlace a la página del artista y su licencia Creative Commons.
- El video de YouTube permanece visible en un reproductor de al menos 200 × 200 px.
- El orden se implementa con una lista doblemente enlazada, nunca con un array como estructura de datos.
- Se requieren accesibilidad, operación por teclado, diseño adaptable y estados explícitos de carga, vacío, error y éxito.
- El despliegue queda preparado para Render y PostgreSQL administrado; la persona propietaria realiza la autenticación y el primer despliegue.

## Evidencia disponible

`AGENTS.md` es el brief de producto e ingeniería. No se proporcionaron marca, catálogo musical, datos de playlists ni capturas. La app no debe inventar esos materiales.

## Principios de producto

- Demostrar la estructura de datos mediante operaciones reales.
- Permitir que cada persona traiga fuentes compatibles.
- Mantener el audio en su proveedor de origen.
- Conservar las playlists entre sesiones.
- Hacer accesibles con teclado y controles táctiles las acciones del reproductor y la cola.
