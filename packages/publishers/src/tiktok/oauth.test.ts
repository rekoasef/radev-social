import { describe, expect, it, vi } from "vitest";
import {
  exchangeTiktokCode,
  fetchTiktokUser,
  parseScopes,
  refreshTiktokToken,
  revokeTiktokToken,
  TIKTOK_SCOPES,
  TikTokError,
  tiktokAuthorizeUrl,
} from "./oauth";

const client = { clientKey: "key123", clientSecret: "secret456" };
const now = new Date("2026-09-30T12:00:00Z");

function fakeFetch(status: number, body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

const tokenBody = {
  access_token: "act.ACCESS",
  expires_in: 86400,
  open_id: "open-1",
  refresh_token: "rft.REFRESH",
  refresh_expires_in: 31536000,
  scope: "user.info.basic,video.upload",
  token_type: "Bearer",
};

describe("tiktokAuthorizeUrl", () => {
  it("builds the Login Kit URL with every scope, comma-separated", () => {
    const url = new URL(
      tiktokAuthorizeUrl({
        clientKey: "key123",
        redirectUri: "https://app.example/api/tiktok/callback",
        state: "st4te",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_key: "key123",
      response_type: "code",
      scope: TIKTOK_SCOPES.join(","),
      redirect_uri: "https://app.example/api/tiktok/callback",
      state: "st4te",
    });
  });
});

describe("parseScopes", () => {
  it("splits, trims and drops empty and repeated ones", () => {
    expect(parseScopes("a, b,,a ,c")).toEqual(["a", "b", "c"]);
    expect(parseScopes("")).toEqual([]);
  });
});

describe("exchangeTiktokCode", () => {
  it("posts the code as a form and returns tokens with absolute expiries", async () => {
    const fetchImpl = fakeFetch(200, tokenBody);
    const tokens = await exchangeTiktokCode(
      client,
      { code: "c0de", redirectUri: "https://app.example/cb" },
      { now, fetchImpl },
    );
    expect(tokens).toEqual({
      openId: "open-1",
      accessToken: "act.ACCESS",
      accessExpiresAt: new Date("2026-10-01T12:00:00Z"),
      refreshToken: "rft.REFRESH",
      refreshExpiresAt: new Date("2027-09-30T12:00:00Z"),
      scopes: ["user.info.basic", "video.upload"],
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(init?.method).toBe("POST");
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      client_key: "key123",
      client_secret: "secret456",
      code: "c0de",
      grant_type: "authorization_code",
      redirect_uri: "https://app.example/cb",
    });
  });

  it("turns TikTok's error into a TikTokError with its code", async () => {
    const fetchImpl = fakeFetch(400, {
      error: "invalid_grant",
      error_description: "Authorization code is expired.",
      log_id: "L1",
    });
    const error = await exchangeTiktokCode(
      client,
      { code: "old", redirectUri: "https://app.example/cb" },
      { fetchImpl },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TikTokError);
    expect(error).toMatchObject({ code: "invalid_grant", logId: "L1" });
    expect((error as Error).message).toContain("expired");
  });

  it("rejects an unexpected body without echoing it", async () => {
    const fetchImpl = fakeFetch(200, { access_token: "act.LEAK" });
    const error = await exchangeTiktokCode(
      client,
      { code: "c", redirectUri: "https://app.example/cb" },
      { fetchImpl },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TikTokError);
    expect((error as Error).message).not.toContain("LEAK");
  });

  it("rejects a body that is not JSON", async () => {
    const fetchImpl = fakeFetch(502, "<html>Bad gateway</html>");
    await expect(
      exchangeTiktokCode(client, { code: "c", redirectUri: "https://x/cb" }, { fetchImpl }),
    ).rejects.toThrow(/HTTP 502/);
  });
});

describe("refreshTiktokToken", () => {
  it("uses grant_type refresh_token and returns the new refresh token", async () => {
    const fetchImpl = fakeFetch(200, { ...tokenBody, refresh_token: "rft.NEW" });
    const tokens = await refreshTiktokToken(client, "rft.OLD", { now, fetchImpl });
    expect(tokens.refreshToken).toBe("rft.NEW");
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      client_key: "key123",
      client_secret: "secret456",
      grant_type: "refresh_token",
      refresh_token: "rft.OLD",
    });
  });
});

describe("revokeTiktokToken", () => {
  it("accepts an empty success response", async () => {
    const fetchImpl = fakeFetch(200, "");
    await expect(revokeTiktokToken(client, "act.X", { fetchImpl })).resolves.toBeUndefined();
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new URLSearchParams(init?.body as URLSearchParams).get("token")).toBe("act.X");
  });

  it("fails with TikTok's error", async () => {
    const fetchImpl = fakeFetch(400, { error: "invalid_request", log_id: "L2" });
    await expect(revokeTiktokToken(client, "act.X", { fetchImpl })).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
});

describe("fetchTiktokUser", () => {
  it("asks for open_id and display_name with the bearer token", async () => {
    const fetchImpl = fakeFetch(200, {
      data: { user: { open_id: "open-1", display_name: "RAdev" } },
      error: { code: "ok", message: "", log_id: "L3" },
    });
    expect(await fetchTiktokUser("act.X", { fetchImpl })).toEqual({
      openId: "open-1",
      displayName: "RAdev",
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id%2Cdisplay_name",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer act.X");
  });

  it("fails when TikTok answers an error code", async () => {
    const fetchImpl = fakeFetch(401, {
      data: {},
      error: { code: "access_token_invalid", message: "The access token is invalid." },
    });
    await expect(fetchTiktokUser("act.X", { fetchImpl })).rejects.toMatchObject({
      code: "access_token_invalid",
    });
  });

  it("returns null for an empty display name", async () => {
    const fetchImpl = fakeFetch(200, {
      data: { user: { open_id: "o", display_name: "" } },
      error: { code: "ok" },
    });
    expect((await fetchTiktokUser("act.X", { fetchImpl })).displayName).toBeNull();
  });
});
