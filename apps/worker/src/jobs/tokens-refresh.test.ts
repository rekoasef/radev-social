import { TikTokError } from "@radev/publishers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { refreshTokens, type TokensRefreshDeps } from "./tokens-refresh";

const db = {
  listActiveSocialAccounts: vi.fn(),
  getBrandById: vi.fn(),
  renewSocialAccountTokens: vi.fn(),
  markSocialAccountReauth: vi.fn(),
};
vi.mock("@radev/db", () => ({
  listActiveSocialAccounts: (...a: unknown[]) => db.listActiveSocialAccounts(...a),
  getBrandById: (...a: unknown[]) => db.getBrandById(...a),
  renewSocialAccountTokens: (...a: unknown[]) => db.renewSocialAccountTokens(...a),
  markSocialAccountReauth: (...a: unknown[]) => db.markSocialAccountReauth(...a),
}));

const now = new Date("2026-10-01T07:30:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const brands: Record<string, object> = {
  b1: { id: "b1", name: "RAdev", slug: "radev", timezone: "America/Argentina/Buenos_Aires" },
  b2: { id: "b2", name: "Lumus", slug: "lumus", timezone: "America/Argentina/Buenos_Aires" },
};

let refresh: ReturnType<typeof vi.fn>;
let deps: TokensRefreshDeps;

const fresh = (refreshExpiresAt: Date) => ({
  openId: "o",
  accessToken: "act.NEW",
  accessExpiresAt: days(1),
  refreshToken: "rft.NEW",
  refreshExpiresAt,
  scopes: [],
});

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.listActiveSocialAccounts.mockResolvedValue([
    { id: "a1", brandId: "b1" },
    { id: "a2", brandId: "b2" },
  ]);
  db.getBrandById.mockImplementation(async (_db: unknown, id: string) => brands[id]);
  // Like the real one: always due here, renews with the stored refresh token.
  db.renewSocialAccountTokens.mockImplementation(
    async (
      _db: unknown,
      _id: string,
      due: () => boolean,
      renew: (r: string | null) => Promise<unknown>,
    ) => ({ tokens: due() ? await renew("rft.OLD") : null, renewed: true }),
  );
  refresh = vi.fn(async () => fresh(days(300)));
  deps = {
    db: {} as never,
    log: createLogger({}, "error"),
    client: { clientKey: "k", clientSecret: "s" },
    notify: vi.fn(async () => {}),
    appUrl: "https://app.gestorlumus.site",
    refresh: refresh as never,
    now: () => now,
  };
});

describe("tokens.refresh", () => {
  it("renews every active account with its refresh token", async () => {
    expect(await refreshTokens(deps)).toEqual({ renewed: 2, reauth: 0, failed: 0 });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith(deps.client, "rft.OLD", { now });
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("marks a revoked account to reconnect, tells the operator, and goes on with the rest", async () => {
    refresh
      .mockRejectedValueOnce(new TikTokError("revoked", "invalid_grant", null))
      .mockResolvedValueOnce(fresh(days(300)));
    expect(await refreshTokens(deps)).toEqual({ renewed: 1, reauth: 1, failed: 0 });
    expect(db.markSocialAccountReauth).toHaveBeenCalledWith({}, "a1", "invalid_grant");
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({ key: "tiktok-reauth:a1:2026-10-01", kind: "failure" }),
      { urgent: false },
    );
  });

  it("warns when the permission ends within two weeks", async () => {
    refresh.mockResolvedValue(fresh(days(10)));
    await refreshTokens(deps);
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringMatching(/^tiktok-expiring:a1:/) }),
      { urgent: false },
    );
  });

  it("renews the others and then throws (retry) when TikTok is down for one", async () => {
    refresh
      .mockRejectedValueOnce(new TikTokError("down", "internal_error", null))
      .mockResolvedValueOnce(fresh(days(300)));
    await expect(refreshTokens(deps)).rejects.toThrow(/1 cuenta/);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(db.markSocialAccountReauth).not.toHaveBeenCalled();
  });

  it("does nothing without the app's keys", async () => {
    expect(await refreshTokens({ ...deps, client: null })).toEqual({
      renewed: 0,
      reauth: 0,
      failed: 0,
    });
    expect(db.listActiveSocialAccounts).not.toHaveBeenCalled();
  });
});
