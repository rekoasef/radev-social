import { describeQaIssue, QA_KINDS, type QaIssue } from "@radev/slides/qa";

export type RenderIssue = { slide: number; text: string };

/**
 * A version's render problems, described for the operator. The same problem can be reported by a
 * text and by its box: shown once.
 */
export function describeRenderIssues(stored: unknown): RenderIssue[] {
  const issues = Array.isArray(stored)
    ? (stored as { slide: number; kind: string; text: string }[])
    : [];
  return [
    ...new Map(
      issues.map((issue) => {
        const text = (QA_KINDS as readonly string[]).includes(issue.kind)
          ? describeQaIssue(issue as QaIssue)
          : issue.text || "Error al renderizar.";
        return [`${issue.slide}|${text}`, { slide: issue.slide, text }];
      }),
    ).values(),
  ];
}
