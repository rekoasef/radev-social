import { z } from "zod";
import { plainText } from "./fields";

// Data behind `chart` slides. The AI only names a dataset (`datasetRef`); the code injects its
// points (CLAUDE.md, rule 9). Datasets come from the brand's data (phase 5: Bluelytics → data.json).

export const chartDatasetSchema = z.object({
  /** Shown next to values, e.g. "$" or "%". */
  unit: plainText(6).optional(),
  /** Where the unit goes: "$ 1.200" (before) or "12 %" (after). */
  unitPosition: z.enum(["before", "after"]).default("before"),
  points: z
    .array(z.object({ label: plainText(10), value: z.number().finite() }))
    .min(2)
    .max(60),
});

export type ChartDataset = z.infer<typeof chartDatasetSchema>;

/** Datasets available to a render, by key. */
export type Datasets = Readonly<Record<string, ChartDataset>>;
