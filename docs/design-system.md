# Sistema visual

La interfaz usa el concepto editorial descrito en [DESIGN.md](../DESIGN.md). Los valores base coinciden con `web/src/styles/tokens.css`; la portada puede cambiar `--accent` a un tono que mantiene contraste AA con el fondo oscuro.

| Uso                  | Token             | Valor base |
| -------------------- | ----------------- | ---------- |
| Fondo                | `--bg`            | `#0b0b0c`  |
| Superficie           | `--surface`       | `#121214`  |
| Superficie elevada   | `--surface-2`     | `#19191b`  |
| Superficie terciaria | `--surface-3`     | `#242426`  |
| Texto                | `--text`          | `#f2f0eb`  |
| Texto secundario     | `--text-muted`    | 58%        |
| Texto terciario      | `--text-tertiary` | 34%        |
| Acento base          | `--accent`        | `#c7a876`  |
| Error                | `--danger`        | `#ff5d5d`  |

DM Sans e Instrument Serif se autoalojan en `web/public/fonts/`; no se descarga tipografía desde Google durante la navegación. La escala de espacio usa pasos de 4 px. La portada tiene radio de 20 px. El tema oscuro es predeterminado; el cambio de preferencia del sistema no altera la paleta.

En la biblioteca, las acciones de crear cuenta e iniciar sesión son accesibles desde la sección de cuenta. Tras autenticarse, la app trae las playlists desde el backend común y PostgreSQL. Los archivos locales permanecen en la sesión del dispositivo, no se suben y no participan en la sincronización.
