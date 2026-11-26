import { listVoices } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { NewVideoForm } from "@/components/videos/new-video-form";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nuevo video · RAdev Social" };

// Times measured with a real video (docs/PROGRESS.md, T9). They are only a guide.
const ROUTE = [
  ["1", "Investigación", "~4 min"],
  ["2", "Fuentes", "~10 s"],
  ["3", "Imágenes", "~8 min"],
  ["4", "Guion", "~2 min"],
  ["5", "Verificación", "~2 min"],
  ["", "Tu escritorio: aprobar el guion", "a los ~16 min"],
  ["6", "Locución", "~15 s"],
  ["7", "Render", "~9 min"],
  ["8", "Publicación", "~1 min"],
  ["", "Tu escritorio: aprobar el video", "~10 min después"],
] as const;

export default async function NewVideoPage() {
  const [{ brands }, voices] = await Promise.all([getBrandContext(), listVoices(db)]);

  return (
    <section aria-labelledby="new-video-heading" className="flex flex-col gap-6">
      <Link href="/videos" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Estudio
      </Link>
      <Plate as="h1" id="new-video-heading" aside="va a Recepción">
        Nuevo video
      </Plate>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <NewVideoForm
          brands={brands
            .filter((brand) => brand.archivedAt === null)
            .map(({ id, name, codePrefix }) => ({ id, name, codePrefix }))}
          voices={voices
            .filter((voice) => voice.provider === "elevenlabs" && voice.language === "es")
            .map(({ id, name, use, isDefault, previewUrl }) => ({
              id,
              name,
              use,
              isDefault,
              previewUrl,
            }))}
        />
        <aside className="flex flex-col gap-4">
          <Plate>Qué pasa después</Plate>
          <ol className="divide-y divide-bezel">
            {ROUTE.map(([n, name, time]) => (
              <li
                key={name}
                className={`grid grid-cols-[1.6rem_1fr_auto] py-2.5 text-sm ${n ? "text-ink" : "text-tally-amber"}`}
              >
                <span className="timecode text-xs text-ink-faint">{n || "▲"}</span>
                <span>{name}</span>
                <span className="timecode text-xs">{time}</span>
              </li>
            ))}
          </ol>
          <dl className="flex flex-col gap-2 rounded-md border border-bezel bg-panel p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-dim">Claude, hasta el guion</dt>
              <dd className="timecode text-ink">~350.000 tokens</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-dim">Voz, al aprobar el guion</dt>
              <dd className="timecode text-ink">~1.900 créditos</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
