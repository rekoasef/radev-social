import type { CSSProperties, ReactNode } from "react";
import { cueTime, ramp, type Word } from "../anim/timing";
import type { DocuGraphic } from "./schema";

// Motion graphics del formato documental: paneles oscuros sobre la imagen, con la paleta del archivo
// (papel, tinta, ocre y rojo ladrillo). Todo entra y sale atado a palabras de la voz.
const FONT = "'Inter Tight Variable', sans-serif";
const C = { paper: "#F1E8D4", gold: "#E3B04B", brick: "#D2563A", ink: "rgba(16,13,10,0.8)" };
const TOP = { arriba: 560, centro: 880, abajo: 1360 } as const;
/** En 16:9 (1920×1080) los paneles son más bajos y angostos, y el contenido se achica un 20 %. */
const TOP_WIDE = { arriba: 190, centro: 330, abajo: 500 } as const;
export type GraphicFormat = "9x16" | "16x9";

const toCue = (c: Parameters<typeof cueTime>[0], words: Word[]) => cueTime(c, words);

/** 0 antes de `at`, 1 mientras está, y baja a 0 en 0,3 s después de `until`. */
function life(t: number, at: number, until: number | undefined) {
  const inn = ramp(t, at, at + 0.35);
  const out = until === undefined ? 0 : ramp(t, until, until + 0.3);
  return inn * (1 - out);
}

function Panel({ pos, k, children, style, format = "9x16" }: { pos: keyof typeof TOP; k: number; children: ReactNode; style?: CSSProperties; format?: GraphicFormat }) {
  const wide = format === "16x9";
  return (
    <div
      style={{
        position: "absolute",
        left: wide ? 110 : 70,
        ...(wide ? { width: 1000 } : { right: 70 }),
        top: wide ? TOP_WIDE[pos] : TOP[pos],
        opacity: k,
        transform: `translateY(${(1 - k) * 36}px)`,
        background: C.ink,
        borderLeft: `10px solid ${C.brick}`,
        borderRadius: 18,
        padding: "26px 36px",
        fontFamily: FONT,
        color: C.paper,
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      <div style={{ zoom: wide ? 0.8 : 1 }}>{children}</div>
    </div>
  );
}

export function GraphicView({ g, t, words, format = "9x16" }: { g: DocuGraphic; t: number; words: Word[]; format?: GraphicFormat }) {
  if (g.kind === "cronologia") {
    const times = g.items.map((it) => toCue(it.at, words));
    const end = g.until === undefined ? undefined : toCue(g.until, words);
    const k = life(t, times[0] ?? 0, end);
    return (
      <Panel pos={g.pos} k={k} format={format}>
        {g.items.map((it, i) => {
          const a = ramp(t, times[i] ?? 0, (times[i] ?? 0) + 0.35);
          return (
            <div key={`${it.date}-${it.text}`} style={{ display: "flex", alignItems: "center", gap: 22, padding: "10px 0", opacity: a, transform: `translateX(${(1 - a) * -30}px)` }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.brick, flex: "none" }} />
              <div style={{ fontSize: 46, fontWeight: 900, color: C.gold, minWidth: 190 }}>{it.date}</div>
              <div style={{ fontSize: 40, fontWeight: 600 }}>{it.text}</div>
            </div>
          );
        })}
      </Panel>
    );
  }
  const at = toCue(g.at, words);
  const k = life(t, at, g.until === undefined ? undefined : toCue(g.until, words));
  if (g.kind === "fecha") {
    return (
      <Panel pos={g.pos} k={k} format={format}>
        <div style={{ fontSize: 78, fontWeight: 900, letterSpacing: "0.04em", lineHeight: 1.05 }}>{g.text}</div>
        {g.sub ? <div style={{ fontSize: 38, fontWeight: 600, color: C.gold, marginTop: 8 }}>{g.sub}</div> : null}
      </Panel>
    );
  }
  if (g.kind === "cifra") {
    const n = Math.round(g.value * ramp(t, at, at + 1.3));
    return (
      <Panel pos={g.pos} k={k} format={format}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ fontSize: 150, fontWeight: 900, color: C.gold, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {n.toLocaleString("es-AR")}
          </div>
          {g.unit ? <div style={{ fontSize: 58, fontWeight: 800 }}>{g.unit}</div> : null}
        </div>
        <div style={{ fontSize: 38, fontWeight: 600, marginTop: 6, opacity: 0.9 }}>{g.label}</div>
      </Panel>
    );
  }
  if (g.kind === "nombre") {
    return (
      <Panel pos={g.pos} k={k} format={format} style={{ right: "auto", maxWidth: 860, ...(format === "16x9" ? { width: "auto" } : {}) }}>
        <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.05 }}>{g.name}</div>
        <div style={{ fontSize: 34, fontWeight: 600, color: C.gold, marginTop: 6 }}>{g.role}</div>
      </Panel>
    );
  }
  return (
    <Panel pos={g.pos} k={k} format={format}>
      <div style={{ fontSize: 120, fontWeight: 900, color: C.brick, lineHeight: 0.6, height: 50 }}>“</div>
      <div style={{ fontSize: 48, fontWeight: 700, fontStyle: "italic", lineHeight: 1.2 }}>{g.text}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: C.gold, marginTop: 12 }}>— {g.by}</div>
    </Panel>
  );
}
