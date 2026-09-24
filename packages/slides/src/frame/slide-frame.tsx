import type { ReactNode } from "react";
import { BoldFrame } from "../presets/bold/frame";
import type { BrandTheme } from "../presets/registry";
import { SoftFrame } from "../presets/soft/frame";
import type { FrameProps } from "./types";

export type SlideFrameProps = Omit<FrameProps<unknown>, "tokens"> & {
  theme: BrandTheme;
  children?: ReactNode;
};

/** The frame of the brand's preset, at the exact render size (1080×1350). */
export function SlideFrame({ theme, children, ...props }: SlideFrameProps) {
  switch (theme.preset) {
    case "bold":
      return (
        <BoldFrame tokens={theme.tokens} {...props}>
          {children}
        </BoldFrame>
      );
    case "soft":
      return (
        <SoftFrame tokens={theme.tokens} {...props}>
          {children}
        </SoftFrame>
      );
  }
}
