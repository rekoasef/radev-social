import type { RenderedAsset } from "@radev/db";
import { mediaUrl } from "@/lib/brand-assets";

/** The rendered PNGs of a version, what gets published. Each one opens full size. */
export function RenderedStrip({ assets }: { assets: RenderedAsset[] }) {
  return (
    <ol className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
      {assets.map((asset) => {
        // Re-rendering a version rewrites the same path, which /media caches forever: the checksum
        // gives each render its own URL.
        const url = `${mediaUrl(asset.path)}?v=${asset.checksum.slice(0, 12)}`;
        const label = `Slide ${asset.slideIndex + 1}`;
        return (
          <li key={asset.id} className="min-w-0">
            <a
              href={url}
              target="_blank"
              rel="noopener"
              className="block overflow-hidden rounded-md border border-bezel hover:border-ink-faint"
              title={`${label}: abrir en tamaño real`}
            >
              {/* biome-ignore lint/performance/noImgElement: the PNG as rendered; next/image would re-encode it. */}
              <img
                src={url}
                alt={label}
                width={asset.width}
                height={asset.height}
                loading="lazy"
                className="block h-auto w-full"
              />
            </a>
          </li>
        );
      })}
    </ol>
  );
}
