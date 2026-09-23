# 0005 — Generación con Claude Code headless, aislada del repo

**Estado:** ampliada por 0009 · 2026-09

**Contexto.** Queremos un agente que busque en la web, lea contexto y devuelva JSON estructurado. Claude Code carga los CLAUDE.md del directorio de trabajo y de sus padres: si genera contenido dentro del repo, mezcla las reglas de desarrollo con la voz de marca.

**Decisión.** El worker ejecuta `claude -p` con `--output-format json` y `--json-schema`, herramientas acotadas, tope de turnos y de costo, en un directorio temporal fuera del repo que contiene una copia de `content-workspace/<marca>/` y los archivos de contexto de la tarea.

**Consecuencias.** Dos "Claude" separados: el que desarrolla (CLAUDE.md raíz) y el que crea contenido (CLAUDE.md de marca). Cada ejecución queda registrada con costo y sesión.
