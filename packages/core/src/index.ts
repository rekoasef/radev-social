// Pure domain: types, post state machine, rules. No I/O and no dependencies on other workspace packages.
export {
  isEmailAllowed,
  isOperator,
  type OperatorIdentity,
  parseAllowedEmails,
} from "./auth/allowlist";
