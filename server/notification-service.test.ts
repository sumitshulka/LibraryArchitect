import { afterEach, describe, expect, it, vi } from "vitest";
import type { IStorage } from "./storage";
import { emitNotification, retryNotificationAttempt } from "./notification-service";

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

  it("persists redacted delivery metadata and retries a failed attempt idempotently", async () => {
    const events: any[] = [];
    const attempts: any[] = [];
    const storage = {
      async getSystemConfig(key: string) {
        const config: Record<string, string> = {
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
            routes: [{ channel: "SMS", providerId: "sms-1", enabled: true, templateId: "reset", valueKeys: ["otp"], allowOverride: true }],
          }]),
          notification_default_providers_v1: JSON.stringify({ SMS: "sms-1" }),
        };
        return config[key] === undefined ? undefined : { key, value: config[key], category: "notifications" };
      },
      async getNotificationDeliveryEventByIdempotencyKey(key: string) {
        return events.find((event) => event.idempotencyKey === key);
      },
      async createNotificationDeliveryEvent(event: any) {
        const created = { ...event, id: events.length + 1, createdAt: new Date() };
        events.push(created);
        return created;
      },
      async getNotificationDeliveryAttempts(eventRecordId: number) {
        return attempts.filter((attempt) => attempt.eventRecordId === eventRecordId);
      },
      async createNotificationDeliveryAttempt(attempt: any) {
        const created = { ...attempt, id: attempts.length + 1, createdAt: new Date() };
        attempts.push(created);
        return created;
      },
      async getNotificationDeliveryRetry(attemptId: number) {
        return attempts.find((attempt) => attempt.retryOfAttemptId === attemptId);
      },
      async getNotificationDeliveryAttempt(id: number) {
        const attempt = attempts.find((item) => item.id === id);
        const event = events.find((item) => item.id === attempt?.eventRecordId);
        return attempt && event ? { ...attempt, event } : undefined;
      },
    } as unknown as IStorage;

    process.env.SESSION_SECRET = "test-session-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("provider rejected otp 123456 for +15551234567"))
      .mockResolvedValueOnce(new Response("", { status: 200, headers: { "x-message-id": "retry-1" } }));

    const first = await emitNotification(storage, {
      eventId: "PASSWORD_RESET_OTP",
      recipient: "fallback@example.test",
      recipientsByChannel: { SMS: "+15551234567" },
      values: { otp: "123456" },
      idempotencyKey: "test-delivery-1",
    });

    expect(first[0]).toMatchObject({ status: "FAILED", error: expect.not.stringContaining("123456") });
    expect(events[0].recipientRedacted).not.toContain("fallback@example.test");
    expect(JSON.stringify(events[0].valuesRedacted)).not.toContain("123456");
    expect(events[0].encryptedPayload).not.toContain("123456");

    const retried = await retryNotificationAttempt(storage, first[0].id!);
    const retriedAgain = await retryNotificationAttempt(storage, first[0].id!);
    expect(retried).toMatchObject({ status: "SENT", providerMessageId: "retry-1" });
    expect(retriedAgain).toEqual(retried);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(attempts).toHaveLength(2);
  });
});