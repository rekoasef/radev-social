import type { Datasets, Slide } from "@radev/slides";
import type { ReactNode } from "react";
// Piezas internas de `studio`: el índice del paquete no las exporta (por eso la ruta relativa).
// Si V1 sigue este camino, `slides` tendría que exportarlas (o exportar este marco).
import type { Rect } from "../../../../packages/slides/src/frame/geometry";
import {
  lookContext,
  type StudioSlideProps,
} from "../../../../packages/slides/src/presets/studio/frame";
import type { LookContext } from "../../../../packages/slides/src/presets/studio/kit";
import { surfaceVars } from "../../../../packages/slides/src/presets/studio/kit";
import { studioTemplates } from "../../../../packages/slides/src/presets/studio/templates";

export const VERTICAL = { width: 1080, height: 1920 } as const;

// V0-5, variante B: un marco 9:16 propio que reusa las piezas del look (fondo, decoración,
// encabezado, pie y plantillas). Es una copia de `StudioSlide` con otra altura y la caja de
// contenido donde diga `box`. Sin la imagen generada (ArtLayer): no entra en esta prueba.
export function VerticalSlide(props: StudioSlideProps & { box: Rect }) {
  const ctx = lookContext(props);
  const { kit } = ctx;
  const Template = studioTemplates[props.slide.type] as (args: {
    slide: Slide;
    ctx: LookContext;
    datasets: Datasets;
  }) => ReactNode;
  const { box } = props;
  return (
    <div
      data-slide-frame=""
      data-look={ctx.look}
      data-surface={ctx.surface}
      style={{
        position: "absolute",
        inset: 0,
        width: VERTICAL.width,
        height: VERTICAL.height,
        overflow: "hidden",
        WebkitFontSmoothing: "antialiased",
        ...surfaceVars(ctx.tokens, ctx.surface),
        ...kit.vars?.(ctx),
      }}
    >
      {kit.Backdrop?.(ctx)}
      {kit.Decor?.(ctx)}
      {kit.Header(ctx)}
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
        }}
      >
        <div
          data-fit=""
          data-fit-width={box.width}
          data-fit-height={box.height}
          style={{ width: box.width, height: box.height }}
        >
          <Template slide={props.slide} ctx={ctx} datasets={props.datasets ?? {}} />
        </div>
      </div>
      {kit.Footer(ctx)}
    </div>
  );
}
