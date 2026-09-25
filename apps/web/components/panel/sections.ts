import {
  CalendarDays,
  House,
  Layers,
  Lightbulb,
  type LucideIcon,
  Palette,
  Settings,
} from "lucide-react";

export type PanelSection = {
  label: string;
  /** Short label for the phone dock. */
  short: string;
  icon: LucideIcon;
  /** Present only once the section exists. */
  href?: string;
  /** Roadmap phase that builds it, shown while it is off air. */
  phase?: number;
};

// Future sections stay visible but inert: the operator sees where the panel is going
// without landing on empty pages.
export const panelSections: readonly PanelSection[] = [
  { label: "Inicio", short: "Inicio", icon: House, href: "/" },
  { label: "Posts", short: "Posts", icon: Layers, href: "/posts" },
  { label: "Ideas", short: "Ideas", icon: Lightbulb, href: "/ideas" },
  { label: "Calendario", short: "Agenda", icon: CalendarDays, phase: 4 },
  { label: "Marcas", short: "Marcas", icon: Palette, href: "/brands" },
  { label: "Ajustes", short: "Ajustes", icon: Settings, href: "/settings" },
];
