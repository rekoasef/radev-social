import { presets, STYLE_PRESETS } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandForm } from "@/components/brands/brand-form";
import { Plate } from "@/components/console/plate";
import { timezoneOptions } from "@/lib/brand-form";

export const metadata: Metadata = { title: "Nueva marca · RAdev Social" };

export default function NewBrandPage() {
  return (
    <section aria-labelledby="new-brand-heading" className="flex flex-col gap-6">
      <Link href="/brands" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Marcas
      </Link>
      <Plate as="h1" id="new-brand-heading">
        Nueva marca
      </Plate>
      <BrandForm
        values={{
          name: "",
          slug: "",
          codePrefix: "",
          timezone: "America/Argentina/Buenos_Aires",
        }}
        presets={STYLE_PRESETS.map((id) => ({
          id,
          name: presets[id].name,
          description: presets[id].description,
        }))}
        timezones={timezoneOptions()}
      />
    </section>
  );
}
