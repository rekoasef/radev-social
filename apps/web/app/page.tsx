import { listBrands } from "@radev/db";
import { connection } from "next/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChannelMonitor } from "@/components/console/channel-monitor";
import { ConsoleClock } from "@/components/console/console-clock";
import { Plate } from "@/components/console/plate";
import { Rundown } from "@/components/console/rundown";
import { Tally } from "@/components/console/tally";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export default async function Home() {
  await connection();
  const { user } = await requireOperator();
  const channels = await listBrands(db);
  const onAir = channels.filter((brand) => brand.archivedAt === null).length;

  return (
    <>
      <header className="console-bar sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              RAdev Social
            </span>
            <Tally state="ready">Base en línea</Tally>
          </div>
          <div className="flex items-center gap-6">
            <ConsoleClock />
            <div className="hidden flex-col items-end gap-1.5 md:flex">
              <span className="text-sm text-ink">{user.name}</span>
              <span className="plate-text text-ink-faint">Operador</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-14 px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
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
                <ChannelMonitor key={brand.id} brand={brand} index={index} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-dashed border-bezel px-5 py-10">
              <p className="text-base text-ink">No hay canales todavía.</p>
              <p className="mt-1 text-sm text-ink-dim">
                Cargá las marcas iniciales con{" "}
                <code className="timecode text-ink">pnpm db:seed</code>.
              </p>
            </div>
          )}
        </section>

        <Rundown />
      </main>
    </>
  );
}
