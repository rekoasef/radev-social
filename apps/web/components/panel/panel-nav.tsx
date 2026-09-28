"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type PanelSection, panelSections } from "./sections";

function isCurrent(section: PanelSection, pathname: string) {
  if (!section.href) return false;
  return section.href === "/" ? pathname === "/" : pathname.startsWith(section.href);
}

/** Pending counts per section href (the review queue), shown next to its label. */
export type NavBadges = Readonly<Record<string, number>>;

function Badge({ count, className }: { count: number | undefined; className: string }) {
  if (!count) return null;
  return (
    <span className={className}>
      {count}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}

/** Desktop: a row of console keys under the top bar. */
export function PanelNav({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="hidden md:block">
      <ul className="flex items-stretch gap-1">
        {panelSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <>
              <Icon className="size-3.5" aria-hidden="true" />
              {section.label}
              <Badge
                count={section.href ? badges[section.href] : undefined}
                className="nav-badge"
              />
              {section.phase !== undefined && (
                <span className="nav-phase" title={`Llega en la Fase ${section.phase}`}>
                  F{section.phase}
                </span>
              )}
            </>
          );
          return (
            <li key={section.label}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="nav-key"
                  aria-current={isCurrent(section, pathname) ? "page" : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span className="nav-key" aria-disabled="true">
                  {content}
                  <span className="sr-only">(próximamente)</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone: fixed dock at the bottom, within thumb reach. */
export function PanelDock({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="dock md:hidden">
      <ul className="grid grid-cols-7">
        {panelSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <>
              <Icon className="size-5" aria-hidden="true" />
              <span className="dock-label">{section.short}</span>
              <Badge
                count={section.href ? badges[section.href] : undefined}
                className="dock-badge"
              />
              {section.phase !== undefined && (
                <span className="dock-phase">
                  F{section.phase}
                  <span className="sr-only"> · próximamente</span>
                </span>
              )}
            </>
          );
          return (
            <li key={section.label}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="dock-key"
                  aria-current={isCurrent(section, pathname) ? "page" : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span className="dock-key" aria-disabled="true">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
