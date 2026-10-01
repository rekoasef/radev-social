import { listBrandLinks, listLinksPagePosts, recordLinkEvent } from "@radev/db";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { mediaUrl } from "@/lib/brand-assets";
import { db } from "@/lib/db";
import { getLinksPageBrand, referrerHost } from "@/lib/links-page";

// A brand's public links page (phase 6 T5, RF-40): the one link TikTok allows, in the profile.
// It asks which post brought the visitor, so the WhatsApp message (or the app's link) carries
// that post's reference. Brand colors and logo come from the database (rule 6).

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/l/[brand]">): Promise<Metadata> {
  const brand = await getLinksPageBrand((await params).brand);
  return {
    title: brand ? brand.name : "No existe",
    // A page to reach from TikTok, not to be found on search engines.
    robots: { index: false, follow: false },
  };
}

export default async function LinksPage({ params }: PageProps<"/l/[brand]">) {
  const brand = await getLinksPageBrand((await params).brand);
  if (!brand) notFound();
  const [posts, links, head] = await Promise.all([
    listLinksPagePosts(db, { brandId: brand.id, network: "tiktok" }),
    listBrandLinks(db, brand.id),
    headers(),
  ]);
  await recordLinkEvent(db, {
    brandId: brand.id,
    kind: "view",
    referrer: referrerHost(head.get("referer")),
  });

  const active = links.filter((link) => link.active);
  const primary = active.find((link) => link.primary);
  // Posts are pickable when their tap goes somewhere: WhatsApp, or the primary link.
  const pickable = brand.whatsappNumber !== null || primary !== undefined;
  const go = (query: string) => `/l/${brand.slug}/go?${query}`;
  const style = {
    "--lp-bg": brand.colors.bg,
    "--lp-text": brand.colors.text,
    "--lp-accent": brand.colors.accent,
    "--lp-muted": brand.colors.muted,
  } as CSSProperties;

  return (
    <main style={style} className="links-page min-h-dvh">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-10 px-4 pt-12 pb-16">
        <header className="flex flex-col items-center gap-4 text-center">
          {brand.logoUrl ? (
            // biome-ignore lint/performance/noImgElement: the brand's uploaded logo, local media
            <img src={brand.logoUrl} alt="" className="h-20 w-auto max-w-[220px] object-contain" />
          ) : (
            <span className="lp-mark">{brand.name.slice(0, 2).toUpperCase()}</span>
          )}
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{brand.name}</h1>
        </header>

        {pickable && posts.length > 0 && (
          <section aria-labelledby="posts-heading" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 text-center">
              <h2 id="posts-heading" className="text-lg font-semibold">
                ¿Por qué post venís?
              </h2>
              <p className="lp-muted text-sm">
                Tocalo y{" "}
                {brand.whatsappNumber
                  ? "te abro WhatsApp con el mensaje listo"
                  : "seguís desde ahí"}
                .
              </p>
            </div>
            <ul className="grid grid-cols-3 gap-2.5">
              {posts.map((post) => (
                <li key={post.id}>
                  <a
                    href={go(`post=${post.id}`)}
                    className="lp-post"
                    aria-label={`${post.ref}: ${post.caption.slice(0, 80)}`}
                  >
                    {post.coverPath ? (
                      // biome-ignore lint/performance/noImgElement: TikTok covers saved in local media
                      <img src={mediaUrl(post.coverPath)} alt="" loading="lazy" />
                    ) : (
                      <span className="lp-post-text">{post.caption.slice(0, 70)}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Links" className="flex flex-col gap-3">
          {brand.whatsappNumber && (
            <a href={go("to=whatsapp")} className="lp-button lp-button-primary">
              Escribime por WhatsApp
            </a>
          )}
          {active.map((link) => (
            <a
              key={link.id}
              href={go(`link=${link.id}`)}
              className={`lp-button ${!brand.whatsappNumber && link.primary ? "lp-button-primary" : ""}`}
            >
              {link.title}
            </a>
          ))}
        </nav>
      </div>
    </main>
  );
}
