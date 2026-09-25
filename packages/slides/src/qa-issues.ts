// Kinds of render QA issue and their Spanish descriptions, apart from checkRender (qa.ts) so code
// without the DOM types (the worker) can describe them too.

export const QA_KINDS = ["overflow", "outside-box", "safe-area", "tiktok", "overlap"] as const;

export type QaIssue = {
  kind: (typeof QA_KINDS)[number];
  /** Start of the offending text, to find it. */
  text: string;
};

/** Spanish description of an issue, for the panel and the capture script. */
export function describeQaIssue(issue: QaIssue): string {
  // For overlaps the text already names both layers ("Título y Elemento gráfico").
  if (issue.kind === "overlap") return `${issue.text}: quedan uno encima del otro`;
  const what = {
    overflow: "El texto no entra en su caja",
    "outside-box": "El texto se sale de su tarjeta",
    "safe-area": "Queda fuera del área segura",
    tiktok: "Queda debajo de los botones de TikTok",
  }[issue.kind];
  return `${what}: “${issue.text}”`;
}
