import type { SlideOf } from "../../../content/slides";
import { cardGridRows } from "../../shared/layout";
import { SOFT_CONTENT_BOX } from "../frame";
import { glassStyle, IconBadge, Support, TemplateLayout } from "../parts";

// `cardGrid`: glass cards without order. Icon badge, light lead and label below, centered. Rows
// follow the shared split (3 → 3 · 4 → 2+2 · 5 → 3+2 · 6 → 3+3).

type Card = SlideOf<"cardGrid">["cards"][number];

const GAP = 20;

function GridCard({ card }: { card: Card }) {
  return (
    <div
      data-qa="content"
      style={{
        ...glassStyle("var(--radius-card)"),
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: "32px 20px 30px",
        textAlign: "center",
      }}
    >
      <IconBadge name={card.icon} />
      <div
        data-qa="text"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 28,
          lineHeight: 1.25,
          textWrap: "balance",
        }}
      >
        {card.lead && <div style={{ color: "var(--muted)" }}>{card.lead}</div>}
        <div style={{ fontWeight: 600, color: "var(--text)" }}>{card.label}</div>
      </div>
    </div>
  );
}

export function CardGridTemplate({ slide }: { slide: SlideOf<"cardGrid"> }) {
  const rows: Card[][] = [];
  let next = 0;
  for (const size of cardGridRows(slide.cards.length)) {
    rows.push(slide.cards.slice(next, next + size));
    next += size;
  }

  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      {slide.intro && <Support text={slide.intro} />}
      <div
        style={{
          width: SOFT_CONTENT_BOX.width,
          display: "flex",
          flexDirection: "column",
          gap: GAP,
          marginTop: slide.intro ? -24 : 0,
        }}
      >
        {rows.map((row) => (
          <div key={row.map((card) => card.label).join("|")} style={{ display: "flex", gap: GAP }}>
            {row.map((card) => (
              <GridCard key={card.label} card={card} />
            ))}
          </div>
        ))}
      </div>
      {slide.footer && <Support text={slide.footer} size={34} />}
    </TemplateLayout>
  );
}
