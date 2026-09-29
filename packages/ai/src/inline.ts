import type { GenerationTask } from "./types";

// How a task travels to a model when everything goes in the messages: the brand's instructions
// (the `CLAUDE.md` file) as the system prompt, the other files inside the user message under their
// names, since the instructions refer to them by name. Both providers use it: claude-code runs
// without tools, so nothing is left for the model to read (and every extra turn resent the
// whole context).

/** The file that holds the brand's instructions: it goes as the system prompt. */
export const INSTRUCTIONS_FILE = "CLAUDE.md";

export function inlineTask(task: GenerationTask<unknown>): { system: string | null; user: string } {
  const { [INSTRUCTIONS_FILE]: instructions, ...rest } = task.files;
  const files = Object.entries(rest).map(
    ([name, content]) => `### Archivo \`${name}\`\n\n\`\`\`\n${content}\n\`\`\``,
  );
  const user = [
    task.prompt,
    files.length > 0
      ? `Los archivos que mencionan las instrucciones están acá:\n\n${files.join("\n\n")}`
      : "",
  ].filter(Boolean);
  return { system: instructions ?? null, user: user.join("\n\n") };
}
