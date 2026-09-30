// Publishing adapters (manual; tiktok in phase 5) and TikTok's metrics (phase 6).
export { confirmManualPublication, manualPublisher } from "./manual/manual";
export {
  cleanShareUrl,
  fetchTiktokStats,
  listTiktokVideos,
  type TikTokAccountStats,
  type TikTokVideo,
  tiktokIdFromUrl,
} from "./tiktok/display";
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
export {
  fetchPostState,
  fitUtf16,
  initPhotoPost,
  isTiktokAuthError,
  isTiktokPermanentError,
  postIdsFrom,
  TIKTOK_DESCRIPTION_MAX,
  TIKTOK_MAX_PHOTOS,
  TIKTOK_TITLE_MAX,
  type TikTokPostMode,
  type TikTokPostState,
} from "./tiktok/posting";
export type { PublisherAdapter, PublishInput, PublishResult } from "./types";
