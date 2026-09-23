"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronsUpDown } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setActiveBrand } from "@/app/(panel)/actions";

export type SwitcherBrand = { slug: string; name: string; codePrefix: string };

/** Which channel the panel is tuned to. Always visible: the active brand is never in doubt. */
export function BrandSwitcher({
  brands,
  activeSlug,
}: {
  brands: SwitcherBrand[];
  activeSlug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticSlug, setOptimisticSlug] = useOptimistic(activeSlug);
  const active = brands.find((brand) => brand.slug === optimisticSlug) ?? brands[0];
  if (!active) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        className="switcher"
        aria-label={`Marca activa: ${active.name}. Cambiar marca`}
        data-pending={pending || undefined}
      >
        <span className="callsign">{active.codePrefix}</span>
        <span className="max-w-[9rem] truncate text-sm text-ink">{active.name}</span>
        <ChevronsUpDown className="size-3.5 text-ink-faint" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={6} align="start">
          <Menu.Popup className="console-popup min-w-56">
            <Menu.Group>
              <Menu.GroupLabel className="plate-text px-3 pt-2 pb-2.5 text-ink-faint">
                Trabajar en
              </Menu.GroupLabel>
              <Menu.RadioGroup
                value={active.slug}
                onValueChange={(slug: string) => {
                  if (slug === active.slug) return;
                  startTransition(async () => {
                    setOptimisticSlug(slug);
                    await setActiveBrand({ slug });
                  });
                }}
              >
                {brands.map((brand) => (
                  <Menu.RadioItem key={brand.slug} value={brand.slug} className="console-item">
                    <span className="callsign">{brand.codePrefix}</span>
                    <span className="flex-1 text-sm">{brand.name}</span>
                    <Menu.RadioItemIndicator>
                      <Check className="size-4 text-ink" aria-hidden="true" />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
