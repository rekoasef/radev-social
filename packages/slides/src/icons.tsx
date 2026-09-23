import type { LucideIcon } from "lucide-react";
import * as lucide from "lucide-react";

// Icons by their kebab-case Lucide name (the one stored in slide content). Every name in
// content/icon-names.json, aliases included, is exported by lucide-react in PascalCase.
// Not lucide-react/dynamic: it is a "use client" module (see scripts/sync-icon-names.mjs).

const components = lucide as unknown as Record<string, LucideIcon | undefined>;

const pascalCase = (name: string) =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export function iconComponent(name: string): LucideIcon | undefined {
  return components[pascalCase(name)];
}

export function SlideIcon({
  name,
  size,
  color = "currentColor",
  strokeWidth = 1.75,
}: {
  name: string;
  size: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = iconComponent(name);
  // Content is validated against icon-names.json, so this only happens with stale data.
  if (!Icon) throw new Error(`Ícono desconocido: ${name}`);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />;
}
