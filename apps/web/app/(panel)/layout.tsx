import { countPostsInReview } from "@radev/db";
import Image from "next/image";
import Link from "next/link";
import { ConsoleClock } from "@/components/console/console-clock";
import { Tally } from "@/components/console/tally";
import appMark from "@/components/panel/app-mark.png";
import { BrandSwitcher } from "@/components/panel/brand-switcher";
import { PanelDock, PanelNav } from "@/components/panel/panel-nav";
import { UserMenu } from "@/components/panel/user-menu";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

// One gate for every panel page: pages below can assume a valid operator session.
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const [{ user }, { brands, activeBrand }, inReview] = await Promise.all([
    requireOperator(),
    getBrandContext(),
    countPostsInReview(db),
  ]);
  const badges = { "/review": inReview };
  const switchable = brands
    .filter((brand) => brand.archivedAt === null)
    .map(({ slug, name, codePrefix }) => ({ slug, name, codePrefix }));

  return (
    <>
      <header className="console-bar sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 pt-3 pb-3 sm:px-8 md:pb-2.5">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src={appMark}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-lg ring-1 ring-white/10"
              />
              <span className="flex flex-col gap-1.5">
                <span className="text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap text-ink">
                  RAdev Social
                </span>
                <Tally state="ready" className="hidden sm:inline-flex">
                  Base en línea
                </Tally>
              </span>
            </Link>
            {activeBrand ? (
              <BrandSwitcher brands={switchable} activeSlug={activeBrand.slug} />
            ) : (
              <Tally state="off">Sin marcas activas</Tally>
            )}
          </div>
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="hidden sm:block">
              <ConsoleClock />
            </div>
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </div>
        </div>
        <div className="mx-auto hidden max-w-[1400px] px-4 sm:px-8 md:block">
          <PanelNav badges={badges} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-14 px-4 pt-8 pb-28 sm:px-8 sm:pt-12 md:pb-16">
        {children}
      </main>

      <PanelDock badges={badges} />
    </>
  );
}
