import { describe, expect, it } from "vitest";
import { parseBluelytics } from "./data-refresh";

const latest = {
  oficial: { value_avg: 1512, value_sell: 1538, value_buy: 1486 },
  blue: { value_avg: 1543.5, value_sell: 1560, value_buy: 1527 },
  oficial_euro: { value_avg: 1643.5, value_sell: 1672, value_buy: 1615 },
  last_update: "2026-09-25T10:45:51.077358-03:00",
};

const history = [
  { date: "2026-09-25", source: "Oficial", value_sell: 1538, value_buy: 1486 },
  { date: "2026-09-25", source: "Blue", value_sell: 1560, value_buy: 1527 },
  { date: "2026-09-24", source: "Blue", value_sell: 1560, value_buy: 1513 },
  { date: "2026-09-24", source: "Oficial Euro", value_sell: 1600, value_buy: 1500 },
  // Older than the history a snapshot keeps.
  { date: "2011-01-03", source: "Blue", value_sell: 4, value_buy: 4 },
];

describe("parseBluelytics", () => {
  it("keeps today's rates and the recent history of blue and official, oldest first", () => {
    expect(parseBluelytics(latest, history)).toEqual({
      lastUpdate: "2026-09-25T10:45:51.077358-03:00",
      latest: { blue: { buy: 1527, sell: 1560 }, oficial: { buy: 1486, sell: 1538 } },
      history: [
        { date: "2026-09-24", kind: "blue", buy: 1513, sell: 1560 },
        { date: "2026-09-25", kind: "blue", buy: 1527, sell: 1560 },
        { date: "2026-09-25", kind: "oficial", buy: 1486, sell: 1538 },
      ],
    });
  });

  it("fails with a clear message when the API changes shape", () => {
    expect(() => parseBluelytics({ blue: {} }, history)).toThrow(/latest cambió de forma/);
    expect(() => parseBluelytics(latest, { data: [] })).toThrow(/evolution cambió de forma/);
  });
});
