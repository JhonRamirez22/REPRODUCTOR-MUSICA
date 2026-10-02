# Auditoría de QA y correcciones

**Fecha:** 2026-10-02

**Alcance:** repositorio completo: frontend, API, lógica compartida, adaptador Python, dependencias y configuración de despliegue. La revisión es estática y local; no modifica bases ni recursos AWS/Vercel.

## 1. Resumen ejecutivo

1. El build, ESLint/Prettier y TypeScript pasan bajo Node 22.
2. La suite final tiene 72 tests Vitest aprobados y 3 de integración PostgreSQL omitidos; los 3 tests Python pasan.
3. Se corrigieron cinco defectos funcionales/de seguridad y el advisory moderado de Vitest.
4. La duplicación medida es 0,45%, dentro del límite de 3%; npm audit termina con 0 vulnerabilidades.
5. El proyecto aún no supera la cobertura objetivo (51,30% líneas, 44,04% ramas), no ejecutó integración real con PostgreSQL y no tiene CI; QA no lo considera listo para una liberación con esos gates.

## 2. Fase 1: reconocimiento y línea base

### Stack y dependencias externas

- **Lenguajes:** TypeScript/JavaScript, Python y SQL.
- **Frontend:** React 19, Vite 6, CSS; reproductor nativo HTML Audio y YouTube IFrame Player API.
- **Backend:** Fastify 5, `pg`, Zod y Node.js ESM; paquetes agrupados con npm workspaces (`shared`, `server`, `web`).
- **Adaptador de catálogo:** Python y `ytmusicapi`; la API puede ejecutarlo localmente o llamar a la función remota autenticada mediante `YTMUSIC_API_URL` y `YTMUSIC_API_TOKEN`.
- **Persistencia:** PostgreSQL/Aurora, consultas SQL planas, migraciones y autenticación IAM opcional. También se acepta `DATABASE_URL`.
- **Fuentes adicionales:** Jamendo queda como compatibilidad heredada; los archivos locales se reproducen desde memoria/URL `blob:` y no se persisten.
- **Pruebas:** Vitest + Testing Library en TypeScript; desde esta auditoría, `unittest` de la biblioteca estándar de Python. No se añade framework Python.
- **CI:** no encontré workflows de GitHub Actions, GitLab CI, Jenkins, Azure ni Bitbucket. `buildspec.aws.yml`, `render.yaml` y `vercel.json` son despliegue/configuración, no una suite CI que ejecute calidad.

### Mapa de módulos y rutas críticas

- `web/src/main.tsx` → `web/src/App.tsx` → `web/src/api/client.ts` → `/api/*`.
- `server/src/main.ts` aplica migraciones, construye Fastify, abre el listener y cierra el pool al recibir SIGTERM/SIGINT. `server.js` es una entrada de empaquetado que también usa `buildApp`.
- `server/src/app.ts` configura cookies, CSP, proxy, rate limit, rutas y estáticos.
- Rutas API: `/api/health`, `/api/auth/*`, `/api/catalog/{status,search,stream/:trackId}` y CRUD de `/api/playlists/:id` y pistas.
- `server/src/services/playlist-service.ts` transforma la playlist mediante `DoublyLinkedList` y persiste posiciones en transacciones; `server/src/services/auth-service.ts` usa scrypt y sesiones con token opaco.
- `shared/src/doubly-linked-list.ts`, `shared/src/playback-cursor.ts` y `shared/src/schemas.ts` contienen estructura, navegación y validación compartidas.
- `ytmusic-function/api/index.py` autentica la función remota; `ytmusic-function/catalog.py` valida/sanitiza resultados de `ytmusicapi`.

### Línea base previa a las correcciones

| Comando                        | Resultado inicial                                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                | Pasó; Vite generó bundles web y TypeScript compiló servidor/paquete compartido.                                                                                                  |
| `npm run lint`                 | Pasó; ESLint y Prettier no reportaron errores.                                                                                                                                   |
| `npm test`                     | **68 pasaron, 2 fallaron y 3 se omitieron** (73 total). Los dos fallos de `usePlayer` dependían de preferencias `repeatMode` conservadas en `localStorage` por casos anteriores. |
| `python3 -m unittest discover` | No había tests Python: 0 ejecutados y salida 5 de `unittest`.                                                                                                                    |
| Cobertura                      | No medible: faltaba `@vitest/coverage-v8`.                                                                                                                                       |
| `npm audit`                    | 2 paquetes reportados por un advisory moderado en Vitest 3.2.7 / `@vitest/mocker`, [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (CVE-2026-84373).    |

Los 3 tests omitidos son pruebas PostgreSQL que requieren `TEST_DATABASE_URL`. `docker-compose` existe, pero no hay daemon: el socket local de Colima (`~/.colima/default/docker.sock`) no estaba disponible.

## 3. Fases 2–3: pruebas y métricas

### Resultados finales

| Métrica                    |                     Línea base |                                                                                                                            Final |            Objetivo | Estado                                                   |
| -------------------------- | -----------------------------: | -------------------------------------------------------------------------------------------------------------------------------: | ------------------: | -------------------------------------------------------- |
| Build                      |                           Pasa |                                                                                                                 Pasa con Node 22 |                Pasa | Cumple                                                   |
| ESLint/Prettier            |                      0 errores |                                                                                                                        0 errores |           0 errores | Cumple                                                   |
| Vitest                     | 68 pasan, 2 fallan, 3 omitidos |                                                                                                   72 pasan, 0 fallan, 3 omitidos |            0 fallos | Cumple con integración pendiente                         |
| Python `unittest`          |                      Sin tests |                                                                                                                          3 pasan |    Suite ejecutable | Cumple                                                   |
| Cobertura de líneas TS     |    Sin proveedor/configuración |                                                                                                                       **51,30%** |                ≥80% | No cumple                                                |
| Cobertura de ramas TS      |    Sin proveedor/configuración |                                                                                                                       **44,04%** |                ≥80% | No cumple                                                |
| Cobertura lógica crítica   |                   Sin medición | Lista doble 98,07%; cursor 93,33%; auth 94,73%; playlist service 51,02%; YouTube Music service 56,73%; `usePlayer` 74,38% líneas |                ≥90% | Parcial; lógica playlist/player por debajo               |
| Complejidad ciclomática TS |                    No se medía |                                                                               **25 funciones >10**; máxima 39 (`PlayerControls`) |         Ninguna >10 | No cumple                                                |
| Duplicación                |                    No se medía |                                                                                            **0,45%** (42/9.420 líneas; 5 clones) |                 <3% | Cumple                                                   |
| npm audit                  |                    2 moderadas |                                                                                         **0** (0 bajas/moderadas/altas/críticas) |                   0 | Cumple                                                   |
| Secretos                   |                    No se medía |                                      Sin coincidencias en escaneo de patrones de claves/PEM/tokens sobre archivos Git rastreados |                   0 | Sin hallazgo; no sustituye un escáner histórico completo |
| CI                         |                  No encontrado |                                                                                                                   No configurado | Pipeline de calidad | No cumple                                                |

La cobertura final mide **TypeScript de `shared/`, `server/` y `web/`**, excluye tests y `dist`, y no incluye Python. El punto de partida de cobertura se reporta como “no medible” porque el proveedor no estaba instalado; no comparo con el primer intento que contaba `shared/dist` como código duplicado.

El análisis adicional de complejidad se hizo con la regla ESLint `complexity: 10`, excluyendo archivos `.test.*`. Los máximos destacados son `PlayerControls` 39, `NowPlaying` y `QueuePanel` 34, `AddTrackDialog` 32, `usePlayer` 31 y `App` 29. El lint normal no activa esta regla, por eso puede pasar mientras la métrica advierte deuda.

### Seguridad y deuda técnica

- Consultas SQL observadas usan parámetros; no encontré `dangerouslySetInnerHTML`, `eval` ni `new Function` en el código de producto.
- Las entradas REST se validan con Zod; contraseñas con scrypt, sesiones aleatorias guardadas como SHA-256 y cookies `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
- CSP limita scripts/frames al reproductor; el proxy remoto de música usa HTTPS y token de servidor. La URL de audio de terceros se reproduce en cliente, no se descarga en el backend.
- Se encontró y corrigió confianza ilimitada de `X-Forwarded-For`, que permitía evadir límites por IP. La nueva regla confía en un salto, correspondiente al balanceador de ECS Express; hay que conservar esa topología.
- El advisory de Vitest afecta el tooling de desarrollo/pruebas y requiere que el servidor correspondiente sea accesible; la dependencia está solo en desarrollo. Se actualizó de todos modos a la versión parcheada.
- `npm outdated` muestra actualizaciones mayores disponibles para Vite, TypeScript, ESLint, Zod, jsdom y otras; no son CVE reportadas por `npm audit`. No hice upgrades mayores sin necesidad. Vitest sí se subió a la versión corregida del advisory.
- No encontré `TODO`, `FIXME`, `XXX` o `HACK` en código de producto. No hay analizador de código muerto; por lo tanto, no afirmo que esté ausente.
- Hotspot corregido: la reordenación ya no hace hasta 500 `UPDATE` secuenciales por pista. Queda pendiente confirmar plan/resultado SQL contra PostgreSQL real.
- No medí carga real, latencia del proveedor, memoria prolongada ni disponibilidad externa. YouTube Music depende de una API no oficial y el comportamiento del proveedor no se garantiza con tests locales.

## 4. Fase 4: procedimientos de QA

### Plan de pruebas

1. **Funcionales:** registrar, iniciar/cerrar sesión, persistir playlists, cambiar propietario, crear/renombrar/eliminar playlist, buscar YouTube Music, insertar head/tail/índice, mover, quitar, conflictos de revisión y límites. Confirmar que archivos locales solo viven en la sesión actual.
2. **Integración:** arrancar PostgreSQL temporal; migrar desde cero; cubrir transacciones, orden persistido, ownership 404, revisión 409, cascada de borrado y límites. Mantener pruebas deterministas y limpiar la fila creada.
3. **Regresión:** ejecutar Vitest + Python en cada cambio; conservar los casos que reproducen falsificación XFF, error HTTP 500, contaminación de preferencias y respuesta remota malformada.
4. **Smoke:** `GET /api/health`, catálogo configurado/no configurado, una sesión y lectura/escritura de playlist, 404 API y 429; después repetir contra el origen desplegado y la URL pública Vercel.
5. **E2E:** navegador de escritorio y móvil (360 px); registro/login → búsqueda → añadir/reordenar/reproducir → recargar → verificar persistencia. Comprobar video YouTube visible, salto de pista no disponible, teclado y que el archivo local deja de existir al cambiar de dispositivo/recargar.

### Revisión de código y release

- Confirmar validación Zod de params/query/body; SQL parametrizado y transacción; verificación del dueño antes de devolver datos; 404 para recursos ajenos; revisión optimista.
- Verificar tokens solo en entorno, cookies y CSP de producción, 429 homogéneo, `X-Forwarded-For` desde un salto confiable y que el endpoint origin no evite el balanceador.
- Antes de release: `npm run check`, tests PostgreSQL, `npm run build`, `npm audit --audit-level=moderate`, smoke API/web, revisar migraciones/env vars y confirmar artefacto de despliegue y rollback.

### Matriz de riesgos

| Prioridad | Riesgo                                                        | Probabilidad × impacto | Tratamiento                                                                                                                |
| --------- | ------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P1        | Cobertura global baja y sin pruebas directas de ambos engines | Alta × Alta            | Ampliar pruebas de player, API client, rutas y estados principales; gate gradual hasta 80%/90%.                            |
| P1        | Integración PostgreSQL no ejecutada en esta auditoría         | Media × Alta           | Arrancar DB temporal en CI y correr las 3 pruebas; validar escritura con `unnest`.                                         |
| P1        | Sin CI; una regresión no bloquea merge                        | Alta × Alta            | Añadir pipeline con calidad y build.                                                                                       |
| P1        | Dependencia del catálogo YouTube Music no oficial             | Alta × Alta            | Smoke/alerta de upstream y mensajes de indisponibilidad; el servicio no controla cambios externos.                         |
| P2        | 25 funciones TS superan complejidad 10                        | Alta × Media           | Extraer lógica de estados/validación solo al tocar esas áreas; priorizar `usePlayer`, `App`, controles y playlist service. |
| P2        | Sin medición Python de coverage/ramas                         | Media × Media          | Mantener `unittest`; incorporar cobertura Python cuando se elija herramienta estándar y alcance para CI.                   |
| P3        | Dependencias con nuevas versiones mayores                     | Media × Baja           | Revisar compatibilidad en una actualización separada, sin mezclarla con fixes de QA.                                       |

**Pruebas no funcionales pendientes:** carga concurrente de búsqueda y playlist (picos y límites), auditoría de seguridad automatizada completa/histórica, teclado/lector de pantalla y contraste, navegadores Chromium/Firefox/Safari móvil, expiración y caída de PostgreSQL/upstream, timeouts y recuperación. No se reportan como ejecutadas.

### Pipeline CI propuesto

```text
npm ci
  → npm run lint
  → npm run typecheck
  → npm test
  → npm run test:python
  → npm test -- --coverage
  → npm audit --audit-level=moderate
  → npm run build
```

Mantener build, tipos, suites y audit como gates inmediatos. **No se debe declarar alcanzado el gate de cobertura:** primero hay que cubrir los huecos y después activar mínimo global 80% en líneas/ramas y 90% en lógica crítica. Los tests de PostgreSQL deben correr en la misma pipeline con una base temporal.

## 5. Fase 5: defectos y fixes

| ID / severidad    | Ubicación                                     | Causa y evidencia antes del fix                                                                                                                                                                         | Corrección                                                                                                                           |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| QA-01 / Baja      | `web/src/player/use-player.test.tsx:10`       | Dos tests fallaban en suite (`seekTo = -1`, `repeatMode = off`) y pasaban aislados. El modo repeat persistido contaminaba el siguiente caso.                                                            | `beforeEach` limpia `localStorage`; 10 tests del hook pasan juntos.                                                                  |
| PERF-01 / Media   | `server/src/services/playlist-service.ts:271` | Cada reordenación esperaba un `UPDATE` por pista. El test añadido falló antes: 3 llamadas para 3 pistas, con el mismo coste hasta el límite 500.                                                        | Una sentencia parametrizada `UPDATE … FROM unnest(uuid[], integer[])`; test exige una única escritura y orden final.                 |
| SEC-01 / Media    | `server/src/app.ts:49`, entrada `server.js`   | `trustProxy: true` aceptaba la dirección más a la izquierda de `X-Forwarded-For`. Test antes del fix devolvió 200 con dos direcciones falsificadas distintas y límite 1.                                | Se confía un salto del balanceador; `server.js` deja que `buildApp` cree la instancia con la misma política.                         |
| API-01 / Media    | `server/src/app.ts:55-101,136`                | El `errorResponseBuilder` devolvía un objeto plano sin `statusCode`; al activar el límite, la app respondía 500. La prueba esperaba 429 y recibió 500.                                                  | Usar el Error 429 estándar del plugin y normalizarlo en `setErrorHandler`; el endpoint vuelve 429 con `rate_limit_exceeded`.         |
| CAT-01 / Media    | `ytmusic-function/catalog.py:11-53`           | El test falló con `AttributeError` ante una fila `None`; valores no-lista en artistas/miniaturas podían romper la búsqueda; `bool` pasaba como duración `int`; nombres de artista conservaban espacios. | Ignorar filas/campos malformados, aceptar solo lista/duración entera no booleana y normalizar artistas. Tres tests `unittest` pasan. |
| DEP-01 / Moderada | `package.json`, `package-lock.json`           | npm audit baseline informó [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) en Vitest 3.2.7.                                                                                    | Vitest y `@vitest/coverage-v8` fijados a la serie corregida 4.1.11; npm audit final informa cero vulnerabilidades.                   |

Los tests nuevos se ejecutaron antes del fix para comprobar el fallo y después para comprobar la corrección. La sentencia SQL nueva tiene test de número de consultas/orden simulado, pero **no pudo validarse contra PostgreSQL real** por falta del daemon local.

## 6. Fase 6: comandos y pendientes

### Comandos

Requiere Node 22.x, Python 3 y npm:

```bash
npm run check
npm run build
npm test -- --coverage
npm audit --audit-level=moderate
npm exec --yes --package=jscpd@5.4.0 -- jscpd --min-lines 5 --min-tokens 50 --threshold 3 --reporters console --ignore '**/*.test.*,**/tests/**,**/dist/**,**/node_modules/**,coverage/**' shared/src server/src web/src server/python ytmusic-function server.js
./node_modules/.bin/eslint shared/src server/src web/src --ignore-pattern '**/*.test.*' --rule 'complexity: ["warn", 10]'
```

Para integración PostgreSQL cuando Docker esté disponible:

```bash
docker-compose --profile test up -d test-db
TEST_DATABASE_URL=postgres://reproductor:reproductor_local@localhost:15433/reproductor_test npm test
docker-compose --profile test down
```

### Pendientes con dueño

- **TODO — Mantenedor del repositorio:** elevar cobertura TS desde 51,30%/44,04% a 80%/80%, y cubrir ≥90% de playlist service, `usePlayer` y engines. Se deja pendiente porque ahora mismo no hay tests suficientes para garantizar esos gates sin una campaña de cobertura mayor.
- **TODO — Mantenedor del repositorio/CI:** ejecutar integración con PostgreSQL real y crear CI que bloquee cambios si lint, tipos, tests, audit o build fallan; esta sesión no tenía daemon Docker ni workflow.
- **TODO — Mantenedor del repositorio:** completar pruebas E2E, carga, seguridad histórica, accesibilidad y compatibilidad de navegador; no se inventan resultados sin ejecutarlas.
- **TODO — Mantenedor del repositorio:** decidir si añade herramienta de cobertura Python y de dead-code; actualmente Python tiene tests estándar, pero no cobertura de líneas/ramas ni un detector de código muerto.
