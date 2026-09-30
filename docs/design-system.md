# Sistema visual

El generador UI UX Pro Max (`uipro` y `scripts/search.py`) no está instalado en este entorno. Se aplica el fallback aprobado por `AGENTS.md` y la dirección definida en [DESIGN.md](../DESIGN.md).

| Uso                | Token          | Valor     |
| ------------------ | -------------- | --------- |
| Fondo              | `--bg`         | `#121110` |
| Superficie         | `--surface`    | `#1b1917` |
| Superficie elevada | `--surface-2`  | `#25221f` |
| Borde              | `--border`     | `#332f2b` |
| Texto              | `--text`       | `#f3efe9` |
| Texto secundario   | `--text-muted` | `#a39b91` |
| Acento             | `--accent`     | `#ff6b3d` |
| Texto sobre acento | `--on-accent`  | `#121110` |
| Error              | `--danger`     | `#ff5d5d` |

Los valores de espacio siguen saltos de 4 px. Las superficies usan radios de 8 y 12 px, y la UI toma la fuente de sistema disponible. El acento oscuro sobre coral mantiene el texto legible; el acento también supera el contraste requerido frente al fondo.
