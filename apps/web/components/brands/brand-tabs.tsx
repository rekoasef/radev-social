import type { Brand } from "@radev/db";
import Link from "next/link";
import { Tally } from "@/components/console/tally";

type Tab = "general" | "identity" | "slides" | "assets" | "documents";

/** Header of a brand's pages: back to the list, name, status and the brand's sections. */
export function BrandTabs({ brand, current }: { brand: Brand; current: Tab }) {
  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "general", label: "General", href: `/brands/${brand.slug}` },
    { id: "identity", label: "Identidad visual", href: `/brands/${brand.slug}/identity` },
    { id: "slides", label: "Slides", href: `/brands/${brand.slug}/slides` },
    { id: "assets", label: "Assets", href: `/brands/${brand.slug}/assets` },
    { id: "documents", label: "Documentos", href: `/brands/${brand.slug}/documents` },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Link href="/brands" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Marcas
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <span className="callsign">{brand.codePrefix}</span>
        <span className="text-2xl font-semibold tracking-[-0.02em] text-ink">{brand.name}</span>
        {brand.archivedAt && <Tally state="off">Archivada</Tally>}
      </div>
      <nav aria-label={`Secciones de ${brand.name}`} className="border-b border-bezel">
        <ul className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <Link
                href={tab.href}
                className="nav-key"
                aria-current={tab.id === current ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
