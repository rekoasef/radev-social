import {
  DM_Sans,
  Geist,
  Geist_Mono,
  Hanken_Grotesk,
  Inter,
  Inter_Tight,
  JetBrains_Mono,
  Manrope,
  Space_Grotesk,
} from "next/font/google";

// Curated brand typefaces (docs/DESIGN-SYSTEM.md §2), self-hosted by next/font.
const interTight = Inter_Tight({ subsets: ["latin"], display: "swap" });
const inter = Inter({ subsets: ["latin"], display: "swap" });
const hankenGrotesk = Hanken_Grotesk({ subsets: ["latin"], display: "swap" });
const geist = Geist({ subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap" });
const manrope = Manrope({ subsets: ["latin"], display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap" });

const byFamily: Record<string, string> = {
  "Inter Tight": interTight.className,
  Inter: inter.className,
  "Hanken Grotesk": hankenGrotesk.className,
  "Geist Sans": geist.className,
  Geist: geist.className,
  "Geist Mono": geistMono.className,
  "Space Grotesk": spaceGrotesk.className,
  Manrope: manrope.className,
  "DM Sans": dmSans.className,
  "JetBrains Mono": jetBrainsMono.className,
};

/** Class that applies a curated brand typeface; falls back to the panel face. */
export function brandFontClass(family: string | undefined): string | undefined {
  return family ? byFamily[family] : undefined;
}
