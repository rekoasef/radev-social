"use client";

import { Menu } from "@base-ui/react/menu";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null | undefined;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Menu.Root>
      <Menu.Trigger className="operator-badge" aria-label={`Operador: ${name}. Abrir menú`}>
        {image ? (
          // GitHub avatar: tiny and remote, next/image would need extra config for nothing.
          // biome-ignore lint/performance/noImgElement: see above
          <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="timecode text-xs text-ink">{initials(name)}</span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={6} align="end">
          <Menu.Popup className="console-popup min-w-60">
            <div className="flex flex-col gap-1 border-b border-bezel px-3 pt-2.5 pb-3">
              <span className="plate-text text-ink-faint">Operador</span>
              <span className="mt-1 text-sm text-ink">{name}</span>
              <span className="truncate text-xs text-ink-dim">{email}</span>
            </div>
            <div className="p-1">
              <Menu.Item
                className="console-item"
                disabled={pending}
                closeOnClick={false}
                onClick={async () => {
                  setPending(true);
                  await authClient.signOut();
                  router.replace("/login");
                  router.refresh();
                }}
              >
                <LogOut className="size-4 text-ink-dim" aria-hidden="true" />
                <span className="text-sm">{pending ? "Saliendo…" : "Salir"}</span>
              </Menu.Item>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
