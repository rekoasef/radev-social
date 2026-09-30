// Publishing adapters (manual; tiktok in phase 5).
export { confirmManualPublication, manualPublisher } from "./manual/manual";
export {
  exchangeTiktokCode,
  fetchTiktokUser,
  parseScopes,
  refreshTiktokToken,
  revokeTiktokToken,
  TIKTOK_PUBLISH_SCOPES,
  TIKTOK_SCOPES,
  type TikTokClient,
  TikTokError,
  type TikTokTokens,
  type TikTokUser,
  tiktokAuthorizeUrl,
} from "./tiktok/oauth";
export type { PublisherAdapter, PublishInput, PublishResult } from "./types";
