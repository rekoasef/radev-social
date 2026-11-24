import { fitSlide } from "@radev/slides/qa";
import { useLayoutEffect, useRef } from "react";
import { continueRender, delayRender } from "remotion";

// V0-5: lo mismo que hacen `preview` y /render antes de sacar la captura, pero dentro de Remotion.
// `delayRender` frena la foto del cuadro hasta que las fuentes de la slide cargaron y `fitSlide`
// achicó lo que no entra. Sin esto, Remotion sacaría la foto con la fuente de reemplazo.
export function useFit<T extends HTMLElement>(key: string, after?: (root: T) => void) {
  const ref = useRef<T>(null);
  const afterRef = useRef(after);
  afterRef.current = after;
  useLayoutEffect(() => {
    const handle = delayRender(`fit ${key}`);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };
    (async () => {
      const root = ref.current;
      if (root) {
        // Forzar el layout hace que el navegador pida las fuentes que usa la slide.
        root.getBoundingClientRect();
        await document.fonts.ready;
        for (const frame of root.querySelectorAll("[data-slide-frame]")) fitSlide(frame);
        afterRef.current?.(root);
      }
      finish();
    })();
    return finish;
  }, [key]);
  return ref;
}
