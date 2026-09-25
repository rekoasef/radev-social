import { postsPerWeek } from "@radev/core";
import { listScheduleSlots } from "@radev/db";
import { ChannelMonitor } from "@/components/console/channel-monitor";
import { Plate } from "@/components/console/plate";
import { Rundown } from "@/components/console/rundown";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";

export default async function Home() {
  const { brands: channels, activeBrand } = await getBrandContext();
  const onAir = channels.filter((brand) => brand.archivedAt === null).length;
  const perWeek = await Promise.all(
    channels.map(async (brand) => postsPerWeek(await listScheduleSlots(db, brand.id))),
  );

  return (
    <>
      <section aria-labelledby="channels-heading">
        <Plate
          as="h1"
          id="channels-heading"
          aside={`${onAir} ${onAir === 1 ? "activo" : "activos"}`}
        >
          Canales
        </Plate>

        {channels.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-2">
            {channels.map((brand, index) => (
              <ChannelMonitor
                key={brand.id}
                brand={brand}
                index={index}
                postsPerWeek={perWeek[index] ?? 0}
                selected={brand.id === activeBrand?.id}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-dashed border-bezel px-5 py-10">
            <p className="text-base text-ink">No hay canales todavía.</p>
            <p className="mt-1 text-sm text-ink-dim">
              Cargá las marcas iniciales con <code className="timecode text-ink">pnpm db:seed</code>
              .
            </p>
          </div>
        )}
      </section>

      <Rundown />
    </>
  );
}
