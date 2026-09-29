# 0005 — Generación con Claude Code headless, aislada del repo

**Estado:** ampliada por 0009 · modo liviano el 2026-09-29 · 2026-09

**Contexto.** Queremos un agente que busque en la web, lea contexto y devuelva JSON estructurado. Claude Code carga los CLAUDE.md del directorio de trabajo y de sus padres: si genera contenido dentro del repo, mezcla las reglas de desarrollo con la voz de marca.

**Decisión.** El worker ejecuta `claude -p` con `--output-format json` y `--json-schema`, herramientas acotadas, tope de turnos y de costo, en un directorio temporal fuera del repo que contiene una copia de `content-workspace/<marca>/` y los archivos de contexto de la tarea.

**Consecuencias.** Dos "Claude" separados: el que desarrolla (CLAUDE.md raíz) y el que crea contenido (CLAUDE.md de marca). Cada ejecución queda registrada con costo y sesión.

**Modo liviano (2026-09-29).** El CLAUDE.md de la marca ya no se escribe en el directorio: va como prompt de sistema (`--system-prompt-file`), que reemplaza al de Claude Code, y los archivos de contexto van dentro del prompt, sin herramientas (salvo `ideas.research`, que usa WebSearch y WebFetch). El aislamiento no cambia: se sigue ejecutando en una carpeta temporal fuera del repo y la voz de marca sigue saliendo de la base. Motivo: el prompt de sistema y las herramientas de Claude Code pesaban ~27.000 tokens reenviados en cada turno; un carrusel consumía ~128.000 tokens de entrada de la suscripción. Ver `docs/ARCHITECTURE.md` §7.
