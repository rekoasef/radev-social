import type { Brand } from "@radev/db";
import type { CSSProperties } from "react";
import { brandFontClass } from "@/lib/brand-fonts";
import { readColor, readColors, readFont } from "@/lib/brand-tokens";
import { cityOf, offsetOf } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Tally } from "./tally";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 border-t border-bezel py-2.5 first:border-t-0">
      <dt className="plate-text text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function ChannelMonitor({
  brand,
  index,
  selected,
}: {
  brand: Brand;
  index: number;
  /** The brand the panel is tuned to (brand switcher). */
  selected: boolean;
}) {
  const colors = readColors(brand.themeTokens);
  const display = readFont(brand.themeTokens, "display");
  const screen = {
    "--screen-bg": readColor(brand.themeTokens, "bg") ?? "var(--color-console)",
    "--screen-ink": readColor(brand.themeTokens, "text") ?? "var(--color-ink)",
    "--screen-accent": readColor(brand.themeTokens, "accent") ?? "var(--color-ink-dim)",
    "--screen-muted": readColor(brand.themeTokens, "muted") ?? "var(--color-ink-dim)",
    animationDelay: `${index * 140}ms`,
  } as CSSProperties;
  const archived = brand.archivedAt !== null;
  const headingId = `channel-${brand.slug}`;

  return (
    <article aria-labelledby={headingId} className="channel flex min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 pb-3">
        <span className="flex items-center gap-3">
          <span className="callsign">{brand.codePrefix}</span>
          {selected && <Tally state="cued">Activa</Tally>}
        </span>
        {archived ? (
          <Tally state="off">Archivada</Tally>
        ) : (
          <Tally state="standby">En espera · sin posts</Tally>
        )}
      </header>

      <div className={cn("monitor", selected && "monitor-selected")} style={screen}>
        <div className="monitor-screen">
          <span className="monitor-meta">
            {brand.slug} · preset {brand.stylePreset}
          </span>
          <h2
            id={headingId}
            className={cn("monitor-name", brandFontClass(display?.family))}
            style={{ fontWeight: display?.weight }}
          >
            {brand.name}
            <span className="monitor-accent" aria-hidden="true" />
          </h2>
          <span className="monitor-meta timecode">{brand.codePrefix}-0001</span>
        </div>
      </div>

      {colors.length > 0 ? (
        <figure className="mt-4">
          <div className="bars" role="img" aria-label={`Colores de ${brand.name}`}>
            {colors.map((swatch) => (
              <span
                key={swatch.name}
                className="bar"
                style={{ background: swatch.value }}
                title={`${swatch.name} ${swatch.value}`}
              />
            ))}
          </div>
          <figcaption className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3">
            {colors.map((swatch) => (
              <span key={swatch.name} className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-[2px] ring-1 ring-white/15"
                  style={{ background: swatch.value }}
                  aria-hidden="true"
                />
                <span className="truncate text-xs text-ink-dim">{swatch.name}</span>
                <span className="timecode ml-auto text-xs text-ink-faint">
                  {swatch.value.toUpperCase()}
                </span>
              </span>
            ))}
          </figcaption>
        </figure>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">Sin colores cargados.</p>
      )}

      <dl className="mt-5 border-t border-bezel">
        <Row label="Títulos">
          {display ? (
            <>
              {display.family}
              {display.weight && <span className="timecode text-ink-dim"> · {display.weight}</span>}
            </>
          ) : (
            <span className="text-ink-faint">Sin definir</span>
          )}
        </Row>
        <Row label="Zona">
          {cityOf(brand.timezone)}{" "}
          <span className="timecode text-ink-dim">{offsetOf(brand.timezone)}</span>
        </Row>
        <Row label="Posts por día">
          <span className="timecode">{brand.postsPerDayTarget}</span>
        </Row>
        <Row label="WhatsApp">
          {brand.whatsappNumber ? (
            <span className="timecode">{brand.whatsappNumber}</span>
          ) : (
            <span className="text-ink-faint">Sin definir</span>
          )}
        </Row>
      </dl>
    </article>
  );
}
