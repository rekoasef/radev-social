import { canChangeCodePrefix, canDeleteBrand } from "@radev/core";
import { countBrandPosts, getBrandAiUsage, getBrandBySlug } from "@radev/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiLimitsForm } from "@/components/brands/ai-limits-form";
import { BrandDangerZone } from "@/components/brands/brand-danger-zone";
import { BrandForm } from "@/components/brands/brand-form";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { ContactForm } from "@/components/brands/contact-form";
import { DataSourcesForm } from "@/components/brands/data-sources-form";
import { Plate } from "@/components/console/plate";
import { timezoneOptions } from "@/lib/brand-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Marca · RAdev Social" };

export default async function BrandPage({ params }: PageProps<"/brands/[slug]">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const [posts, usage] = await Promise.all([
    countBrandPosts(db, brand.id),
    getBrandAiUsage(db, brand),
  ]);
  const prefixRule = canChangeCodePrefix(posts);
  const deleteRule = canDeleteBrand(posts);

  return (
    <>
      <BrandTabs brand={brand} current="general" />
      <section aria-labelledby="general-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="general-heading">
          General
        </Plate>
        <BrandForm
          // A new key after saving a new slug resets the form to the stored values.
          key={brand.updatedAt.toISOString()}
          values={{
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            codePrefix: brand.codePrefix,
            timezone: brand.timezone,
          }}
          timezones={timezoneOptions(brand.timezone)}
          prefixLocked={prefixRule.ok ? undefined : prefixRule.reason}
        />
      </section>
      <section aria-labelledby="contact-heading" className="flex flex-col gap-6">
        <Plate id="contact-heading">Contacto</Plate>
        <ContactForm
          key={brand.updatedAt.toISOString()}
          id={brand.id}
          codePrefix={brand.codePrefix}
          website={brand.website}
          number={brand.whatsappNumber}
          message={brand.whatsappMessageTemplate}
          readOnly={brand.archivedAt !== null}
        />
      </section>
      <section aria-labelledby="data-sources-heading" className="flex flex-col gap-6">
        <Plate id="data-sources-heading">Fuentes de datos</Plate>
        <DataSourcesForm
          key={brand.updatedAt.toISOString()}
          id={brand.id}
          sources={brand.dataSources}
          readOnly={brand.archivedAt !== null}
        />
      </section>
      <section aria-labelledby="ai-limits-heading" className="flex flex-col gap-6">
        <Plate id="ai-limits-heading">Topes de IA</Plate>
        <AiLimitsForm
          key={brand.updatedAt.toISOString()}
          id={brand.id}
          daily={brand.aiDailyLimit}
          monthly={brand.aiMonthlyLimit}
          usage={usage}
          readOnly={brand.archivedAt !== null}
        />
      </section>
      <section aria-labelledby="danger-heading" className="flex flex-col gap-6">
        <Plate id="danger-heading">Archivar o borrar</Plate>
        <BrandDangerZone
          id={brand.id}
          name={brand.name}
          archived={brand.archivedAt !== null}
          deleteBlocked={deleteRule.ok ? undefined : deleteRule.reason}
        />
      </section>
    </>
  );
}
