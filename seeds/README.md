# Seeds

Datos iniciales que `pnpm db:seed` carga en la base. **Después del seed, la base es la fuente de verdad** y todo se edita desde el panel; estos archivos no se leen en tiempo de ejecución.

```
brands/<slug>/
  voice.md     → brand_documents (kind: voice)
  rules.md     → brand_documents (kind: rules)
  pricing.md   → brand_documents (kind: pricing)   (opcional)
  cases.md     → brand_documents (kind: cases)     (opcional)
  assets/      → brand_assets + volumen de media
```

La configuración visual (preset y tokens), pilares y contacto de cada marca se definen en el script de seed de `packages/db`, con los valores de `docs/DESIGN-SYSTEM.md` §7 y §8 y los pilares de cada `voice.md`.
