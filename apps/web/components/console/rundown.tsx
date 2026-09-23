import { Plate } from "./plate";

const columns = ["Código", "Salida", "Canal", "Estado"] as const;

/** Emission rundown. Posts arrive in phase 2; until then it shows its empty state honestly. */
export function Rundown() {
  return (
    <section aria-labelledby="rundown-heading">
      <Plate id="rundown-heading" aside="0 en cola">
        En cola
      </Plate>
      <div className="mt-5 overflow-hidden rounded-md border border-bezel bg-panel">
        <div
          className="rundown-grid plate-text border-b border-bezel px-4 py-2.5 text-ink-faint"
          aria-hidden="true"
        >
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="flex flex-col items-start gap-1 px-4 py-8 sm:py-10">
          <p className="text-base text-ink">Nada en cola.</p>
          <p className="max-w-[60ch] text-sm text-ink-dim">
            La planilla de emisión se llena cuando se puedan crear carruseles, en la Fase 2. Acá vas
            a ver qué sale, cuándo y por qué canal.
          </p>
        </div>
      </div>
    </section>
  );
}
