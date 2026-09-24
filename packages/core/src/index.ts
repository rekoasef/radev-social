// Pure domain: types, post state machine, rules. No I/O and no dependencies on other workspace packages.
export {
  isEmailAllowed,
  isOperator,
  type OperatorIdentity,
  parseAllowedEmails,
} from "./auth/allowlist";
export { pickActiveBrand, type SelectableBrand } from "./brands/active-brand";
export {
  ASSET_ROLES,
  ASSET_TYPES,
  type AssetCheck,
  type AssetMime,
  type AssetRole,
  type AssetType,
  checkAssetFile,
  detectAssetType,
  findAssetReferences,
  MAX_ASSET_BYTES,
} from "./brands/assets";
