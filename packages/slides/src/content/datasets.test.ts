import { describe, expect, it } from "vitest";
import { chartDatasetSchema } from "./datasets";
import { exampleDatasets } from "./examples";

describe("chartDatasetSchema", () => {
  it("accepts the example datasets", () => {
    for (const dataset of Object.values(exampleDatasets)) {
      expect(chartDatasetSchema.safeParse(dataset).success).toBe(true);
    }
  });

  it("puts the unit before the value by default", () => {
    const parsed = chartDatasetSchema.parse({
      unit: "$",
      points: [
        { label: "A", value: 1 },
        { label: "B", value: 2 },
      ],
    });
    expect(parsed.unitPosition).toBe("before");
  });

  it("rejects a single point and non-finite values", () => {
    expect(chartDatasetSchema.safeParse({ points: [{ label: "A", value: 1 }] }).success).toBe(
      false,
    );
    expect(
      chartDatasetSchema.safeParse({
        points: [
          { label: "A", value: 1 },
          { label: "B", value: Number.NaN },
        ],
      }).success,
    ).toBe(false);
  });
});
