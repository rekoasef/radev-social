import { getBrandBySlug, getSocialAccount } from "@radev/db";
import { TIKTOK_SCOPES } from "@radev/publishers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { DisconnectTiktok } from "@/components/brands/disconnect-tiktok";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { db } from "@/lib/db";
import { isTiktokOutcome, TIKTOK_OUTCOMES, tiktokClient } from "@/lib/tiktok";
import { formatDate, formatDateTime } from "@/lib/time";
import { connectTiktokAction } from "./actions";

export const metadata: Metadata = { title: "Canales · RAdev Social" };

/** What each scope lets the app do, in the operator's words. */
const SCOPE_LABELS: Record<string, string> = {
  "user.info.basic": "Ver el nombre de la cuenta",
  "video.upload": "Mandar borradores a la bandeja",
  "video.publish": "Publicar directo",
  "video.list": "Leer las métricas de cada post",
  "user.info.stats": "Leer seguidores y likes totales",
};

// Where each brand publishes (phase 5 T4): its TikTok account, connected by OAuth.
export default async function BrandChannelsPage({
  params,
  searchParams,
}: PageProps<"/brands/[slug]/channels">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const brand = await getBrandBySlug(db, slug);
  if (!brand) notFound();
  const account = await getSocialAccount(db, brand.id, "tiktok");
  const configured = tiktokClient() !== undefined;
  const readOnly = brand.archivedAt !== null;
  const outcome = isTiktokOutcome(query.tiktok) ? query.tiktok : undefined;
  // Drafts to the inbox need video.upload; direct posting (after TikTok's audit), video.publish.
  const scopeWarning = !account
    ? null
    : !account.scopes.includes("video.upload")
      ? "Sin «Mandar borradores a la bandeja» la app no puede publicar nada."
      : !account.scopes.includes("video.publish")
        ? "Sin «Publicar directo» la app solo puede mandar borradores; para publicar directo cuando TikTok lo apruebe, hay que tenerlo."
        : null;

  const connectForm = (label: string) => (
    <form action={connectTiktokAction}>
      <input type="hidden" name="slug" value={brand.slug} />
      <button
        type="submit"
        className="console-button console-button-primary"
        disabled={!configured}
      >
        {label}
      </button>
    </form>
  );

  return (
    <>
      <BrandTabs brand={brand} current="channels" />
      <section aria-labelledby="channels-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="channels-heading" aside={brand.name}>
          Canales
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          Las cuentas donde publica {brand.name}. Conectar te lleva a TikTok para autorizar la app y
          te trae de vuelta acá. Los tokens se guardan cifrados.
        </p>

        {outcome && (
          <p
            role={outcome === "connected" ? "status" : "alert"}
            className={`max-w-3xl text-sm ${outcome === "connected" ? "text-tally-green" : "text-tally-red"}`}
          >
            {TIKTOK_OUTCOMES[outcome]}
          </p>
        )}

        <article className="flex max-w-3xl flex-col gap-5 rounded-md border border-bezel bg-panel p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">TikTok</h2>
            {!account ? (
              <Tally state="off">Sin conectar</Tally>
            ) : account.status === "active" ? (
              <Tally state="ready">Conectada</Tally>
            ) : (
              <Tally state="cued">Hay que reconectar</Tally>
            )}
          </header>

          {!configured && (
            <p className="text-sm text-ink-faint">
              {TIKTOK_OUTCOMES.not_configured} Se cargan con las claves de la app de TikTok for
              Developers.
            </p>
          )}

          {account ? (
            <>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="plate-text text-ink-faint">Cuenta</dt>
                <dd className="text-ink">{account.displayName ?? "Sin nombre visible"}</dd>
                <dt className="plate-text text-ink-faint">Id de TikTok</dt>
                <dd className="timecode break-all text-ink-dim">{account.externalId}</dd>
                <dt className="plate-text text-ink-faint">Actualizada</dt>
                <dd className="text-ink-dim">
                  {formatDateTime(account.updatedAt, brand.timezone)}
                </dd>
                {account.refreshExpiresAt && (
                  <>
                    <dt className="plate-text text-ink-faint">Reconectar antes del</dt>
                    <dd className="text-ink-dim">
                      {formatDate(account.refreshExpiresAt, brand.timezone)}
                    </dd>
                  </>
                )}
              </dl>

              {account.status === "reauth_required" && (
                <p role="alert" className="text-sm text-tally-amber">
                  TikTok rechazó el acceso{account.lastError ? ` (${account.lastError})` : ""}.
                  Reconectala para volver a publicar.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <h3 className="plate-text text-ink-faint">Permisos</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {TIKTOK_SCOPES.map((scope) => {
                    const granted = account.scopes.includes(scope);
                    return (
                      <li key={scope} className="flex items-baseline gap-2">
                        <span
                          aria-hidden="true"
                          className={granted ? "text-tally-green" : "text-ink-faint"}
                        >
                          {granted ? "✓" : "—"}
                        </span>
                        <span className={granted ? "text-ink" : "text-ink-faint"}>
                          {SCOPE_LABELS[scope]}
                          <span className="sr-only">
                            {granted ? " (otorgado)" : " (no otorgado)"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {scopeWarning && (
                  <p className="text-sm text-tally-amber">
                    {scopeWarning} Reconectá y dejá todo tildado en la pantalla de TikTok.
                  </p>
                )}
              </div>

              {!readOnly && (
                <div className="flex flex-wrap items-start gap-2">
                  {connectForm("Reconectar")}
                  <DisconnectTiktok brandSlug={brand.slug} brandName={brand.name} />
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-ink">
                {brand.name} todavía no tiene TikTok conectado: sus posts se publican a mano.
              </p>
              {!readOnly && <div>{connectForm("Conectar TikTok")}</div>}
            </>
          )}
        </article>
      </section>
    </>
  );
}
