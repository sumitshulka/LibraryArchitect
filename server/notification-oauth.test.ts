import { beforeEach, describe, expect, it } from "vitest";
import {
  createNotificationOAuthState,
  getNotificationOAuthUrl,
  verifyNotificationOAuthState,
} from "./notification-oauth";

describe("notification OAuth", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "notification-oauth-test-secret";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    process.env.MICROSOFT_OAUTH_CLIENT_ID = "microsoft-client";
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET = "microsoft-secret";
    process.env.META_OAUTH_APP_ID = "meta-app";
    process.env.META_OAUTH_APP_SECRET = "meta-secret";
  });

  it("binds OAuth state to the administrator and provider", () => {
    const state = createNotificationOAuthState("GOOGLE_GMAIL", 42);
    expect(() => verifyNotificationOAuthState(state, "GOOGLE_GMAIL", 42)).not.toThrow();
    expect(() => verifyNotificationOAuthState(state, "GOOGLE_GMAIL", 43)).toThrow();
    expect(() => verifyNotificationOAuthState(state, "META_WABA", 42)).toThrow();
  });

  it("builds provider-specific authorization URLs without exposing the client secret", () => {
    const googleUrl = getNotificationOAuthUrl("GOOGLE_GMAIL", "https://library.example.test/callback", "signed-state");
    const microsoftUrl = getNotificationOAuthUrl("MICROSOFT_365", "https://library.example.test/callback", "signed-state");
    const metaUrl = getNotificationOAuthUrl("META_WABA", "https://library.example.test/callback", "signed-state");
    expect(googleUrl).toContain("accounts.google.com");
    expect(googleUrl).toContain("mail.google.com");
    expect(microsoftUrl).toContain("login.microsoftonline.com");
    expect(microsoftUrl).toContain("outlook.office.com%2FSMTP.Send");
    expect(metaUrl).toContain("facebook.com");
    expect(`${googleUrl}${microsoftUrl}${metaUrl}`).not.toContain("google-secret");
    expect(`${googleUrl}${microsoftUrl}${metaUrl}`).not.toContain("microsoft-secret");
    expect(`${googleUrl}${microsoftUrl}${metaUrl}`).not.toContain("meta-secret");
  });
});