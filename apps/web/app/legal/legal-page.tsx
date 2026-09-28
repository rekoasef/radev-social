import Link from "next/link";
import type { ReactNode } from "react";

// Public legal pages (phase 5, T1): TikTok asks for terms and a privacy policy to register the app.
// No login (see proxy.ts). Spanish first, with an English version for TikTok's reviewers.

export const CONTACT_EMAIL = "radevelopment02@gmail.com";
export const UPDATED_AT = "28 de septiembre de 2026";

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({
  title,
  intro,
  sections,
  english,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  english: { title: string; sections: LegalSection[] };
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-4">
        <nav className="flex gap-4 text-xs font-medium tracking-[0.16em] text-ink-faint uppercase">
          <span>RAdev Social</span>
          <Link href="/legal/terminos" className="hover:text-ink">
            Términos
          </Link>
          <Link href="/legal/privacidad" className="hover:text-ink">
            Privacidad
          </Link>
        </nav>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">{title}</h1>
        <p className="text-sm text-ink-faint">Última actualización: {UPDATED_AT}</p>
        <div className="text-base text-ink-dim">{intro}</div>
      </header>

      <Sections sections={sections} />

      <section lang="en" className="flex flex-col gap-8 border-t border-bezel pt-10">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{english.title}</h2>
        <Sections sections={english.sections} />
      </section>
    </main>
  );
}

function Sections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-dim [&_li]:ml-5 [&_li]:list-disc">
            {section.body}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-4">
      {CONTACT_EMAIL}
    </a>
  );
}
