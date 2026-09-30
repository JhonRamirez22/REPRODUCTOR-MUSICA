# Decisiones

- Se crea el proyecto en `outputs/reproductor-estructuras-datos` porque el workspace de esta tarea es el directorio de salida autorizado; el directorio indicado contiene el brief, no código inicial.
- La interfaz parte del fallback de tokens de la sección 9.4 de `AGENTS.md`: `uipro` y su generador `search.py` no están instalados en el entorno; no añado esa herramienta como dependencia de producción.
- La dirección de diseño conserva el dark-first cálido, un acento coral, tipografía de sistema y jerarquía por espacio indicados en `AGENTS.md`; no se carga tipografía remota para evitar una dependencia de red de la interfaz.
- `jsdom` queda como dependencia de desarrollo junto a Testing Library porque los componentes React requieren un DOM para verificar sus interacciones; no forma parte de la imagen de producción.
- `TEST_DATABASE_URL` queda comentada en `.env.example` para que `npm run check` no intente conectarse ni borrar datos hasta que se active el perfil temporal de pruebas de PostgreSQL.
- `VITE_API_PROXY_TARGET` permite apuntar Vite a otro puerto de Fastify si el 3000 ya está ocupado en desarrollo.
- A petición del usuario, la entrada de pistas por URL se reemplaza por búsqueda e inserción desde la API oficial de Jamendo. Se elige su catálogo de streaming y se conservan atribución, ficha y licencia Creative Commons; la credencial queda solo en el servidor. El catálogo requiere que quien despliega configure su propio `JAMENDO_CLIENT_ID` y use el API de forma no comercial conforme a sus términos.
- El reproductor usa `/api/catalog/stream/:trackId` para pedir una redirección de streaming con la credencial en el servidor; la UI no recibe el `client_id` ni acepta URLs de música aportadas por la persona.
