// AI providers (claude-code, openrouter), per-task routing and usage limits.
export { type BrandContext, buildBrandClaudeMd } from "./brand-instructions";
export {
  CLAUDE_CREDENTIAL_VARS,
  type ClaudeCodeOptions,
  type ClaudeCredential,
  claudeCredential,
  createClaudeCodeProvider,
  resolveClaudeBin,
} from "./claude-code";
export {
  type AIError,
  isRetryable,
  providerError,
  rateLimited,
  validationError,
} from "./errors";
export { createFakeProvider, type FakeAnswer } from "./fake";
export {
  dropRepeatedIdeas,
  hasFigures,
  type IdeaProposal,
  type IdeaProposals,
  type IdeaSchemaOptions,
  ideaProposalsSchema,
  normalizeIdeaTitle,
} from "./ideas";
export {
  createOpenRouterProvider,
  OPENROUTER_URL,
  type OpenRouterOptions,
} from "./openrouter";
export {
  createRouter,
  type RouteAttempt,
  type RoutedResult,
  type Router,
  shouldFallback,
} from "./router";
export { formatIssues, parseJsonText, parseOutput, toJsonSchema } from "./schema";
export type { AIProvider, GenerationResult, GenerationTask, Usage } from "./types";
export {
  assertOutsideProjects,
  createWorkspace,
  defaultWorkspaceRoot,
  isSafeFileName,
  type Workspace,
  withWorkspace,
} from "./workspace";
