import { findAssetReferences } from "@radev/core";
import { listBrandAssets } from "@radev/db";
import type { Metadata } from "next";
import { AssetActions, AssetUploadForm } from "@/components/brands/asset-forms";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { getBrandContext } from "@/lib/active-brand";
import { formatBytes, mediaUrl, ROLE_LABELS, tokenLabel } from "@/lib/brand-assets";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Assets · RAdev Social" };

// Files of the brand the panel is tuned to (brand switcher). Which token uses each file is
// chosen in the visual identity editor (phase 1, T10); the seed links Lumus's orb and logo.
export default async function BrandAssetsPage() {
  const { activeBrand: brand } = await getBrandContext();
  if (!brand) {
    return (
      <section>
        <Plate as="h1">Assets</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }

  const assets = await listBrandAssets(db, brand.id);

  return (
    <>
      <section aria-labelledby="upload-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="upload-heading" aside={brand.name}>
          Assets
        </Plate>
        <p className="max-w-[62ch] text-sm text-ink-dim">
          Logos y elementos gráficos que usan las plantillas de {brand.name}. Reemplazar un archivo
          lo cambia en todas las slides que lo usan.
        </p>
        <AssetUploadForm slug={brand.slug} roleLabels={ROLE_LABELS} />
      </section>

      <section aria-labelledby="files-heading" className="flex flex-col gap-6">
        <Plate
          id="files-heading"
          aside={`${assets.length} ${assets.length === 1 ? "archivo" : "archivos"}`}
        >
          Archivos
        </Plate>
        {assets.length === 0 ? (
          <div className="rounded-md border border-dashed border-bezel px-5 py-10">
            <p className="text-base text-ink">{brand.name} no tiene archivos todavía.</p>
            <p className="mt-1 text-sm text-ink-dim">Subí el logo o un elemento gráfico arriba.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const usedBy = findAssetReferences(brand.themeTokens, asset.id).map((path) =>
                tokenLabel(brand.stylePreset, path),
              );
              const format = asset.mime.replace("image/", "").replace("+xml", "").toUpperCase();
              const size =
                asset.width && asset.height ? `${asset.width}×${asset.height}` : "sin tamaño";
              const name = `${ROLE_LABELS[asset.role]} · ${format} ${size}`;
              return (
                <li key={asset.id} className="asset-card">
                  <div className="asset-preview">
                    {/* biome-ignore lint/performance/noImgElement: files come from /media as is; next/image would re-encode them. */}
                    <img src={mediaUrl(asset.path)} alt={name} loading="lazy" />
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">
                        {ROLE_LABELS[asset.role]}
                      </span>
                      {usedBy.length > 0 ? (
                        <Tally state="ready">En uso · {usedBy.join(", ")}</Tally>
                      ) : (
                        <Tally state="off">Sin usar</Tally>
                      )}
                    </div>
                    <p className="timecode text-xs text-ink-faint">
                      {format} · {size} · {formatBytes(asset.sizeBytes)}
                    </p>
                    <AssetActions
                      slug={brand.slug}
                      assetId={asset.id}
                      name={name}
                      usedBy={usedBy}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
