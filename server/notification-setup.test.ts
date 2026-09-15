import { describe, expect, it } from "vitest";
import type { IStorage } from "./storage";
import {
  loadNotificationSetup,
  saveNotificationSetup,
  toPublicNotificationSetup,
} from "./notification-setup";

function createMemoryStorage() {
  const values = new Map<string, { key: string; value: string; category: string }>();
  return {
    async getSystemConfig(key: string) {
      return values.get(key);
    },
    async setSystemConfig(config: { key: string; value: string; category: string }) {
      values.set(config.key, config);
      return config;
    },
  } as unknown as IStorage;
}

describe("notification setup", () => {
  it("provides the event catalog with email, WhatsApp, and SMS routes", async () => {
    const setup = await loadNotificationSetup(createMemoryStorage());
    expect(setup.events.length).toBeGreaterThan(0);
    expect(setup.events[0].routes.map((route) => route.channel)).toEqual(["EMAIL", "WHATSAPP", "SMS"]);
    const resetEvent = setup.events.find((event) => event.id === "PASSWORD_RESET_OTP");
    expect(resetEvent?.routes.find((route) => route.channel === "EMAIL")).toMatchObject({
      enabled: true,
      valueKeys: ["firstName", "otp", "expiresAt"],
    });
  });

  it("encrypts provider secrets and redacts them from the public setup", async () => {
    const storage = createMemoryStorage();
    await saveNotificationSetup(storage, {
      providers: [{
        id: "waba-1",
        name: "Library WhatsApp",
        channel: "WHATSAPP",
        provider: "META_WABA",
        enabled: true,
        settings: { phoneNumberId: "phone-1" },
        secrets: { accessToken: "do-not-return-this" },
      }],
      events: [],
      defaultProviders: {},
    });

    const stored = await storage.getSystemConfig("notification_providers_v1");
    expect(stored?.value).not.toContain("do-not-return-this");
    const loaded = await loadNotificationSetup(storage);
    const whatsappProvider = loaded.providers.find((provider) => provider.id === "waba-1");
    expect(whatsappProvider?.secrets?.accessToken).toBe("do-not-return-this");
    const publicSetup = toPublicNotificationSetup(loaded);
    const publicWhatsappProvider = publicSetup.providers.find((provider) => provider.id === "waba-1");
    expect(publicWhatsappProvider).not.toHaveProperty("secrets");
    expect(publicWhatsappProvider?.secretKeys).toEqual(["accessToken"]);
  });

  it("preserves an existing secret when the admin saves without replacing it", async () => {
    const storage = createMemoryStorage();
    const base = {
      id: "sms-1",
      name: "SMS",
      channel: "SMS" as const,
      provider: "HTTP_SMS",
      enabled: true,
      settings: { endpoint: "https://sms.example.test/send" },
    };
    await saveNotificationSetup(storage, { providers: [{ ...base, secrets: { apiToken: "keep-me" } }], events: [], defaultProviders: {} });
    await saveNotificationSetup(storage, { providers: [{ ...base, secrets: { apiToken: "••••••••" } }], events: [], defaultProviders: {} });
    const loaded = await loadNotificationSetup(storage);
    expect(loaded.providers.find((provider) => provider.id === "sms-1")?.secrets?.apiToken).toBe("keep-me");
  });

  it("persists linked email providers and keeps them selectable as the default", async () => {
    const storage = createMemoryStorage();
    const linkedEmail = {
      id: "google-account",
      name: "Workspace account",
      channel: "EMAIL" as const,
      provider: "GOOGLE_GMAIL",
      enabled: true,
      settings: { accountId: "google-user", username: "admin@example.test" },
      secrets: { accessToken: "access", refreshToken: "refresh" },
    };
    await saveNotificationSetup(storage, {
      providers: [linkedEmail],
      events: [{
        id: "TEST",
        label: "Test",
        description: "Test",
        enabled: true,
        routes: [{
          channel: "EMAIL",
          providerId: "default-email-provider",
          enabled: true,
          valueKeys: [],
          allowOverride: true,
        }],
      }],
      defaultProviders: { EMAIL: linkedEmail.id },
    });

    const loaded = await loadNotificationSetup(storage);
    expect(loaded.providers.find((provider) => provider.id === linkedEmail.id)).toMatchObject({
      provider: "GOOGLE_GMAIL",
      settings: linkedEmail.settings,
      secrets: linkedEmail.secrets,
    });
    expect(loaded.defaultProviders.EMAIL).toBe(linkedEmail.id);
    expect(loaded.events[0].routes[0].providerId).toBe(linkedEmail.id);
    expect(toPublicNotificationSetup(loaded).providers.find((provider) => provider.id === linkedEmail.id)).not.toHaveProperty("secrets");
  });
});