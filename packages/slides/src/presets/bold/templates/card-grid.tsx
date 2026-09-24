import type { SlideOf } from "../../../content/slides";
import { cardGridRows } from "../../shared/layout";
import { BOLD_CONTENT_BOX } from "../frame";
import { boxStyle, IconTile, Support, TemplateLayout } from "../parts";

// `cardGrid` (ref-cardgrid): cards without order. Icon on its tile, light lead and bold label
// below, centered. No card is highlighted (docs/DESIGN-SYSTEM.md §7).

type Card = SlideOf<"cardGrid">["cards"][number];

const GAP = 24;

function GridCard({ card }: { card: Card }) {
  return (
    <div
      data-qa="content"
      style={{
        ...boxStyle(),
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: "30px 20px 28px",
        textAlign: "center",
      }}
    >
      <IconTile name={card.icon} />
      <div
        data-qa="text"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 29,
          lineHeight: 1.18,
          color: "var(--text)",
          textWrap: "balance",
        }}
      >
        {card.lead && <div style={{ fontWeight: "var(--weight-body)" }}>{card.lead}</div>}
        <div style={{ fontWeight: 700 }}>{card.label}</div>
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
          width: BOLD_CONTENT_BOX.width,
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
      {slide.footer && <Support text={slide.footer} size={36} balance />}
    </TemplateLayout>
  );
}
