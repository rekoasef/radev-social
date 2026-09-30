import type { PostStatus } from "@radev/core";
import type { TallyState } from "@/components/console/tally";

/** How each post status shows on the console: lamp and short label. */
export const STATUS_DISPLAY: Record<PostStatus, { tally: TallyState; label: string }> = {
  generating: { tally: "standby", label: "Generando" },
  rendering: { tally: "standby", label: "Renderizando" },
  in_review: { tally: "cued", label: "En revisión" },
  rejected: { tally: "off", label: "Rechazado" },
  approved: { tally: "ready", label: "Aprobado" },
  scheduled: { tally: "timed", label: "Programado" },
  publishing: { tally: "standby", label: "Publicando" },
  published: { tally: "ready", label: "Publicado" },
  publish_failed: { tally: "live", label: "Falló la publicación" },
  failed: { tally: "live", label: "Falló" },
  archived: { tally: "off", label: "Descartado" },
};
