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
    });

    const stored = await storage.getSystemConfig("notification_providers_v1");
    expect(stored?.value).not.toContain("do-not-return-this");
    const loaded = await loadNotificationSetup(storage);
    expect(loaded.providers[0].secrets?.accessToken).toBe("do-not-return-this");
    const publicSetup = toPublicNotificationSetup(loaded);
    expect(publicSetup.providers[0]).not.toHaveProperty("secrets");
    expect(publicSetup.providers[0].secretKeys).toEqual(["accessToken"]);
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
    await saveNotificationSetup(storage, { providers: [{ ...base, secrets: { apiToken: "keep-me" } }], events: [] });
    await saveNotificationSetup(storage, { providers: [{ ...base, secrets: { apiToken: "••••••••" } }], events: [] });
    const loaded = await loadNotificationSetup(storage);
    expect(loaded.providers[0].secrets?.apiToken).toBe("keep-me");
  });
});