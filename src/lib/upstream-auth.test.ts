import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { IronSession } from "iron-session";
import { server } from "@/test/msw/server";
import { withUpstreamAuth } from "@/lib/upstream-auth";
import { UpstreamError } from "@/lib/http";
import type { SessionData } from "@/types/session";

/** A minimal in-memory stand-in for the iron-session object. */
function fakeSession(overrides: Partial<SessionData> = {}) {
  const data = {
    accessToken: "old-access",
    refreshToken: "refresh-1",
    orgToken: "old-org",
    expiresAt: Date.now() + 3_600_000,
    csrfToken: "csrf",
    user: {} as SessionData["user"],
    ...overrides,
  };
  return Object.assign(data, {
    save: vi.fn(async () => {}),
    destroy: vi.fn(() => {}),
  }) as unknown as IronSession<SessionData> & { save: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
}

/** Mock the refresh + profile endpoints used by the recovery path. */
function mockRefreshAndProfile(newOrgToken = "new-org") {
  server.use(
    http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
      HttpResponse.json({ access_token: "new-access", refresh_token: "refresh-2", expires_in: 3600 }),
    ),
    http.get("https://api.test/membership-service/1.0.0/users/me", () =>
      HttpResponse.json({
        data: { userId: "u1", memberships: [{ token: newOrgToken, organisationId: "o1" }] },
      }),
    ),
  );
}

describe("withUpstreamAuth", () => {
  it("returns the result directly when the call succeeds", async () => {
    const session = fakeSession();
    const result = await withUpstreamAuth(session, async (auth) => auth.accessToken);
    expect(result).toBe("old-access");
    expect(session.save).not.toHaveBeenCalled();
  });

  it("refreshes tokens and retries once on a 401, then succeeds", async () => {
    mockRefreshAndProfile("new-org");
    const session = fakeSession();
    let attempt = 0;

    const result = await withUpstreamAuth(session, async (auth) => {
      attempt += 1;
      if (attempt === 1) throw new UpstreamError(401, "revoked");
      return auth; // second attempt uses refreshed creds
    });

    expect(attempt).toBe(2);
    expect(result).toEqual({ accessToken: "new-access", orgToken: "new-org" });
    expect(session.accessToken).toBe("new-access");
    expect(session.refreshToken).toBe("refresh-2");
    expect(session.orgToken).toBe("new-org");
    expect(session.save).toHaveBeenCalledOnce();
  });

  it("destroys the session and throws 401 when the refresh itself fails", async () => {
    server.use(
      http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );
    const session = fakeSession();

    await expect(
      withUpstreamAuth(session, async () => {
        throw new UpstreamError(401, "revoked");
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("does not attempt refresh when there is no refresh token", async () => {
    const session = fakeSession({ refreshToken: undefined });
    await expect(
      withUpstreamAuth(session, async () => {
        throw new UpstreamError(401, "revoked");
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(session.save).not.toHaveBeenCalled();
  });

  it("propagates non-401 upstream errors without refreshing", async () => {
    const session = fakeSession();
    await expect(
      withUpstreamAuth(session, async () => {
        throw new UpstreamError(500, "boom");
      }),
    ).rejects.toMatchObject({ status: 500 });
    expect(session.save).not.toHaveBeenCalled();
  });
});
