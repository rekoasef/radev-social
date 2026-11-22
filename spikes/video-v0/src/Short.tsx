import "@fontsource-variable/inter-tight";
import "@fontsource-variable/space-grotesk";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Series,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export type ShortProps = { seconds: number };

// Colores fijos solo para la prueba de rendimiento (en V0-5 vienen de los tokens de la marca).
const C = { bg: "#0E0F12", text: "#F4F1EA", accent: "#FF6A1A", muted: "#8A8F98" };
const DISPLAY = "'Space Grotesk Variable', sans-serif";
const BODY = "'Inter Tight Variable', sans-serif";

// Parte de cada escena dentro del Short (suman 1).
const SCENES = [
  { weight: 0.17, render: () => <TitleScene /> },
  { weight: 0.23, render: () => <ListScene /> },
  { weight: 0.2, render: () => <BigNumberScene /> },
  { weight: 0.2, render: () => <QuoteScene /> },
  { weight: 0.2, render: () => <ClosingScene /> },
];

export const Short = ({ seconds }: ShortProps) => {
  const total = seconds * FPS;
  let used = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, color: C.text, fontFamily: BODY }}>
      <Series>
        {SCENES.map((scene, i) => {
          const frames =
            i === SCENES.length - 1 ? total - used : Math.round(total * scene.weight);
          used += frames;
          return (
            <Series.Sequence key={i} durationInFrames={frames}>
              <SceneShell>{scene.render()}</SceneShell>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

// Fondo animado común (gradiente que se mueve + grilla de puntos): da trabajo real al render.
const SceneShell = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = 50 + Math.sin(frame / 40) * 30;
  const y = 30 + Math.cos(frame / 55) * 20;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x}% ${y}%, ${C.accent}55, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.muted}33 2px, transparent 2px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `0 ${frame * 0.8}px`,
        }}
      />
      <AbsoluteFill style={{ padding: "220px 90px 380px", justifyContent: "center" }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.8 } });
};

const TitleScene = () => {
  const words = ["Cómo", "funciona", "un", "worker"];
  return (
    <div style={{ fontFamily: DISPLAY, fontSize: 150, fontWeight: 700, lineHeight: 1.02 }}>
      {words.map((w, i) => {
        const p = useEnterAt(i * 6);
        return (
          <div
            key={w}
            style={{
              transform: `translateY(${(1 - p) * 80}px)`,
              opacity: p,
              color: i === 3 ? C.accent : C.text,
            }}
          >
            {w}
          </div>
        );
      })}
    </div>
  );
};

// Hooks llamados en un orden fijo dentro de map: válido porque la lista no cambia.
const useEnterAt = (delay: number) => useEnter(delay);

const ListScene = () => {
  const items = ["La web toma el pedido", "Lo deja en la cola", "El worker lo procesa", "Guarda el resultado"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 84, fontWeight: 700, marginBottom: 20 }}>
        El recorrido
      </div>
      {items.map((t, i) => {
        const p = useEnterAt(10 + i * 12);
        return (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              fontSize: 58,
              opacity: p,
              transform: `translateX(${(1 - p) * -120}px)`,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 24,
                background: C.accent,
                color: C.bg,
                display: "grid",
                placeItems: "center",
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 52,
                transform: `scale(${p})`,
              }}
            >
              {i + 1}
            </div>
            {t}
          </div>
        );
      })}
    </div>
  );
};

const BigNumberScene = () => {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [0, 45], [0, 128], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );
  const p = useEnter(0);
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 420,
          fontWeight: 700,
          color: C.accent,
          lineHeight: 1,
          transform: `scale(${0.6 + p * 0.4})`,
        }}
      >
        {value}k
      </div>
      <div style={{ fontSize: 64, marginTop: 40, opacity: p }}>tokens ahorrados por ejecución</div>
    </div>
  );
};

const QuoteScene = () => {
  const frame = useCurrentFrame();
  const text = "Si tarda, puede fallar o tiene hora: va al worker.";
  const chars = Math.floor(interpolate(frame, [0, 70], [0, text.length], { extrapolateRight: "clamp" }));
  return (
    <div>
      <div style={{ fontFamily: DISPLAY, fontSize: 260, color: C.accent, lineHeight: 0.6 }}>“</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 96, fontWeight: 600, lineHeight: 1.12 }}>
        {text.slice(0, chars)}
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: C.accent }}>|</span>
      </div>
    </div>
  );
};

const ClosingScene = () => {
  const frame = useCurrentFrame();
  const p = useEnter(0);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 60, alignItems: "center" }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 120, fontWeight: 700, opacity: p }}>Seguí aprendiendo</div>
      <div
        style={{
          background: C.accent,
          color: C.bg,
          fontSize: 60,
          fontWeight: 700,
          padding: "36px 70px",
          borderRadius: 999,
          transform: `scale(${p * pulse})`,
        }}
      >
        @radev
      </div>
    </div>
  );
};
