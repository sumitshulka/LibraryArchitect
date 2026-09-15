import { afterEach, describe, expect, it, vi } from "vitest";
import type { IStorage } from "./storage";
import { emitNotification } from "./notification-service";

function createMemoryStorage(config: Record<string, string>) {
  return {
    async getSystemConfig(key: string) {
      const value = config[key];
      return value === undefined ? undefined : { key, value, category: "notifications" };
    },
  } as unknown as IStorage;
}

describe("notification service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the channel-specific recipient for configured SMS routes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200, headers: { "x-message-id": "sms-123" } }),
    );
    const storage = createMemoryStorage({
      notification_providers_v1: JSON.stringify([{
        id: "sms-1",
        name: "Library SMS",
        channel: "SMS",
        provider: "HTTP_SMS",
        enabled: true,
        settings: { endpoint: "https://sms.example.test/send" },
      }]),
      notification_events_v1: JSON.stringify([{
        id: "PASSWORD_RESET_OTP",
        label: "Password reset OTP",
        description: "Reset",
        enabled: true,
        routes: [{
          channel: "SMS",
          providerId: "sms-1",
          enabled: true,
          templateId: "password-reset",
          valueKeys: ["otp"],
          allowOverride: true,
        }],
      }]),
      notification_default_providers_v1: JSON.stringify({ SMS: "sms-1" }),
    });

    const attempts = await emitNotification(storage, {
      eventId: "PASSWORD_RESET_OTP",
      recipient: "fallback@example.test",
      recipientsByChannel: { SMS: "+15551234567" },
      values: { otp: "123456" },
    });

    expect(attempts).toEqual([expect.objectContaining({ status: "SENT", providerMessageId: "sms-123" })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://sms.example.test/send");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("+15551234567");
  });
});