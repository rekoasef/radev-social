import { describe, expect, it } from "vitest";
import { POST_STATUSES } from "./constants";
import {
  canExport,
  EXPORTABLE_STATUSES,
  exportImageName,
  exportText,
  postDescription,
} from "./export";

describe("canExport", () => {
  const rendered = { slideCount: 2, renderedSlides: [0, 1] };

  it("only exports approved posts or later (rule 3)", () => {
    for (const status of POST_STATUSES) {
      const expected = (EXPORTABLE_STATUSES as readonly string[]).includes(status);
      expect(canExport({ status, ...rendered }).ok).toBe(expected);
    }
    expect(EXPORTABLE_STATUSES).not.toContain("in_review");
  });

  it("refuses when a slide has no PNG", () => {
    expect(canExport({ status: "approved", slideCount: 2, renderedSlides: [0] })).toMatchObject({
      ok: false,
      reason: expect.stringContaining("slide 2"),
    });
  });
});

describe("export text", () => {
  const copy = { hook: "Tu plata, clara", caption: "Mirá esto.", hashtags: ["ahorro", "plata"] };

  it("names images by code and position, from 1", () => {
    expect(exportImageName("LU-0001", 0)).toBe("LU-0001-1.png");
  });

  it("puts the hashtags after the caption", () => {
    expect(postDescription(copy)).toBe("Mirá esto.\n\n#ahorro #plata");
    expect(postDescription({ ...copy, hashtags: [] })).toBe("Mirá esto.");
  });

  it("writes title and description with labels", () => {
    expect(exportText(copy)).toBe(
      "Título\nTu plata, clara\n\nDescripción\nMirá esto.\n\n#ahorro #plata\n",
    );
  });
});
