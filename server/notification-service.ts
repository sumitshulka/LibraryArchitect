import crypto from "crypto";
import nodemailer from "nodemailer";
import type { IStorage } from "./storage";
import { DEFAULT_EMAIL_PROVIDER_ID, loadNotificationSetup, type NotificationChannel, type NotificationRoute, type NotificationProvider } from "./notification-setup";
import { getOAuthClient } from "./notification-oauth";

export interface NotificationRequest {
  eventId: string;
  channel?: NotificationChannel;
  providerId?: string;
  recipient: string;
  recipientsByChannel?: Partial<Record<NotificationChannel, string>>;
  values: Record<string, string | number>;
  templateIdOverride?: string;
  idempotencyKey?: string;
  retryOfAttemptId?: number;
}

export interface NotificationAttempt {
  id?: number;
  channel: NotificationChannel;
  providerId: string;
  providerMessageId?: string;
  status: "SENT" | "FAILED";
  error?: string;
}

export function redactNotificationRecipient(recipient: string): string {
  const value = recipient.trim();
  if (value.includes("@")) {
    const [local, domain] = value.split("@", 2);
    return `${local.slice(0, 1)}***@${domain}`;
  }
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function redactNotificationValues(values: Record<string, string | number>): Record<string, string> {
  return Object.fromEntries(Object.keys(values).map((key) => [key, "[redacted]"]));
}

function encryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to protect notification retry data");
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptPayload(request: NotificationRequest): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({
    eventId: request.eventId,
    channel: request.channel,
    providerId: request.providerId,
    recipient: request.recipient,
    recipientsByChannel: request.recipientsByChannel,
    values: request.values,
    templateIdOverride: request.templateIdOverride,
  }), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptPayload(value: string): NotificationRequest {
  const [ivText, tagText, encryptedText] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as NotificationRequest;
}

function safeError(error: unknown, request: NotificationRequest): string {
  let message = error instanceof Error ? error.message : "Notification failed";
  const sensitiveValues = [
    request.recipient,
    ...Object.values(request.recipientsByChannel || {}),
    ...Object.values(request.values).map(String),
  ].filter((value) => value.length > 2).sort((a, b) => b.length - a.length);
  for (const value of sensitiveValues) message = message.split(value).join("[redacted]");
  message = message.replace(/bearer\s+[^\s]+/gi, "Bearer [redacted]");
  return message.slice(0, 500);
}

async function persistEvent(storage: IStorage, request: NotificationRequest, idempotencyKey: string) {
  if (typeof storage.createNotificationDeliveryEvent !== "function") return undefined;
  const existing = await storage.getNotificationDeliveryEventByIdempotencyKey(idempotencyKey);
  if (existing) {
    const existingAttempts = await storage.getNotificationDeliveryAttempts(existing.id);
    return { event: existing, attempts: existingAttempts, duplicate: true };
  }
  const event = await storage.createNotificationDeliveryEvent({
    eventId: request.eventId,
    idempotencyKey,
    recipientRedacted: redactNotificationRecipient(request.recipient),
    valuesRedacted: redactNotificationValues(request.values),
    encryptedPayload: encryptPayload(request),
    retryOfAttemptId: request.retryOfAttemptId,
  });
  const attempts = await storage.getNotificationDeliveryAttempts(event.id);
  return { event, attempts, duplicate: attempts.length > 0 };
}

async function persistAttempt(
  storage: IStorage,
  eventRecordId: number | undefined,
  request: NotificationRequest,
  attempt: NotificationAttempt,
) {
  if (!eventRecordId || typeof storage.createNotificationDeliveryAttempt !== "function") return attempt;
  const stored = await storage.createNotificationDeliveryAttempt({
    eventRecordId,
    channel: attempt.channel,
    providerId: attempt.providerId,
    status: attempt.status,
    providerMessageId: attempt.providerMessageId,
    errorReason: attempt.error,
    retryOfAttemptId: request.retryOfAttemptId,
  });
  return { ...attempt, id: stored.id };
}

function render(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    if (key === "valuesJson") return JSON.stringify(values);
    if (key.startsWith("value.")) return String(values[key.slice("value.".length)] ?? "");
    return String(values[key] ?? "");
  });
}

function requiredValues(route: NotificationRoute, values: Record<string, string | number>) {
  const missing = route.valueKeys.filter((key) => values[key] === undefined || values[key] === null);
  if (missing.length) throw new Error(`Missing notification values: ${missing.join(", ")}`);
}

function assertSafeHttpEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Notification HTTP endpoints must use HTTPS");
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
    || hostname.startsWith("172.16.")
  ) {
    throw new Error("Notification HTTP endpoint cannot target a private network address");
  }
  return url;
}

function createEmailTransport(provider: NotificationProvider) {
  const host = provider.settings.host;
  if (!host || !provider.settings.username) {
    throw new Error("Email provider requires a host and account username");
  }
  if (provider.provider === "GOOGLE_GMAIL" || provider.provider === "MICROSOFT_365") {
    const accessToken = provider.secrets?.accessToken;
    const refreshToken = provider.secrets?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new Error("Linked email provider is missing its OAuth tokens. Relink the account.");
    }
    const oauthClient = getOAuthClient(provider.provider);
    return nodemailer.createTransport({
      host,
      port: Number(provider.settings.port || 587),
      secure: provider.settings.secure === "true",
      requireTLS: provider.settings.requireTLS === "true",
      auth: {
        type: "OAuth2",
        user: provider.settings.username,
        clientId: oauthClient.clientId,
        clientSecret: oauthClient.clientSecret,
        accessToken,
        refreshToken,
      },
    });
  }
  const password = provider.secrets?.password;
  if (!password) throw new Error("Email provider requires a password or app password");
  return nodemailer.createTransport({
    host,
    port: Number(provider.settings.port || 587),
    secure: provider.settings.secure === "true",
    auth: { user: provider.settings.username, pass: password },
  });
}

async function sendEmail(provider: NotificationProvider, route: NotificationRoute, request: NotificationRequest): Promise<string | undefined> {
  const transporter = createEmailTransport(provider);
  const body = route.bodyTemplate
    ? render(route.bodyTemplate, request.values)
    : String(request.values.message || "");
  if (!body) throw new Error("Email route requires a body template or message value");
  await transporter.sendMail({
    from: provider.settings.from || provider.settings.username,
    to: request.recipient,
    subject: render(route.subject || request.eventId, request.values),
    html: body,
  });
  return undefined;
}

export async function verifyNotificationProvider(provider: NotificationProvider) {
  if (provider.channel === "EMAIL") {
    const transporter = createEmailTransport(provider);
    await transporter.verify();
    return { verified: true, message: "Email provider authenticated successfully" };
  }
  if (provider.channel === "WHATSAPP") {
    const token = provider.secrets?.accessToken;
    const phoneNumberId = provider.settings.phoneNumberId;
    if (!token || !phoneNumberId) throw new Error("WhatsApp provider requires an OAuth token and phone number");
    const baseUrl = (provider.settings.apiBaseUrl || "https://graph.facebook.com").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v20.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message || "WhatsApp provider authentication failed");
    return { verified: true, message: `WhatsApp number ${result.display_phone_number || phoneNumberId} is ready` };
  }
  const endpoint = provider.settings.endpoint;
  if (!endpoint) throw new Error("SMS provider requires an HTTPS endpoint");
  assertSafeHttpEndpoint(endpoint);
  return { verified: true, message: "SMS endpoint is valid" };
}

export async function sendProviderTest(provider: NotificationProvider, recipient: string, templateId?: string) {
  const route: NotificationRoute = {
    channel: provider.channel,
    providerId: provider.id,
    enabled: true,
    templateId,
    language: provider.settings.defaultLanguage || "en_US",
    subject: "LibraTech notification test",
    bodyTemplate: "<p>This is a test notification from LibraTech.</p>",
    valueKeys: [],
    allowOverride: false,
  };
  const request: NotificationRequest = {
    eventId: "NOTIFICATION_PROVIDER_TEST",
    channel: provider.channel,
    providerId: provider.id,
    recipient,
    values: { message: "This is a test notification from LibraTech." },
  };
  if (provider.channel === "EMAIL") {
    await sendEmail(provider, route, request);
  } else if (provider.channel === "WHATSAPP") {
    await sendWhatsApp(provider, route, request);
  } else {
    await sendSms(provider, route, request);
  }
  return { sent: true };
}

async function sendWhatsApp(provider: NotificationProvider, route: NotificationRoute, request: NotificationRequest): Promise<string | undefined> {
  const token = provider.secrets?.accessToken;
  const phoneNumberId = provider.settings.phoneNumberId;
  const templateId = request.templateIdOverride || route.templateId;
  if (!token || !phoneNumberId || !templateId) {
    throw new Error("WhatsApp route requires an access token, phone number ID, and template ID");
  }
  const baseUrl = (provider.settings.apiBaseUrl || "https://graph.facebook.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: request.recipient,
      type: "template",
      template: {
        name: templateId,
        language: { code: route.language || "en_US" },
        components: [{
          type: "body",
          parameters: route.valueKeys.map((key) => ({ type: "text", text: String(request.values[key]) })),
        }],
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || "WhatsApp provider rejected the message");
  return result?.messages?.[0]?.id;
}

async function sendSms(provider: NotificationProvider, route: NotificationRoute, request: NotificationRequest): Promise<string | undefined> {
  const endpoint = provider.settings.endpoint;
  if (!endpoint) throw new Error("SMS provider requires an HTTPS endpoint");
  const url = assertSafeHttpEndpoint(endpoint);
  const method = (provider.settings.method || "POST").toUpperCase();
  const templateId = request.templateIdOverride || route.templateId || "";
  const bodyTemplate = provider.settings.bodyTemplate || JSON.stringify({
    to: "{{recipient}}",
    template_id: "{{templateId}}",
    values: "{{valuesJson}}",
  });
  const rendered = render(bodyTemplate, { ...request.values, recipient: request.recipient, templateId });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.secrets?.apiToken) headers.Authorization = `Bearer ${provider.secrets.apiToken}`;
  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : rendered,
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`SMS provider rejected the message (${response.status})`);
  return response.headers.get("x-message-id") || crypto.createHash("sha256").update(responseText).digest("hex").slice(0, 16);
}

export async function emitNotification(storage: IStorage, request: NotificationRequest): Promise<NotificationAttempt[]> {
  const setup = await loadNotificationSetup(storage);
  const event = setup.events.find((item) => item.id === request.eventId);
  if (!event || !event.enabled) throw new Error(`Notification event "${request.eventId}" is not enabled`);
  const idempotencyKey = request.idempotencyKey || crypto.randomUUID();
  const deliveryEvent = await persistEvent(storage, request, idempotencyKey);
  if (deliveryEvent?.duplicate) {
    return deliveryEvent.attempts.map((attempt) => ({
      id: attempt.id,
      channel: attempt.channel,
      providerId: attempt.providerId,
      providerMessageId: attempt.providerMessageId || undefined,
      status: attempt.status,
      error: attempt.errorReason || undefined,
    }));
  }
  const providers = new Map(setup.providers.map((provider) => [provider.id, provider]));
  const routes = event.routes.filter((route) =>
    route.enabled
    && (!request.channel || route.channel === request.channel)
    && (!request.providerId || (route.providerId || setup.defaultProviders[route.channel]) === request.providerId)
  );
  if (!routes.length) throw new Error(`No active notification route is configured for "${request.eventId}"`);

  const attempts: NotificationAttempt[] = [];
  for (const route of routes) {
    const providerId = route.providerId || setup.defaultProviders[route.channel] || (route.channel === "EMAIL" ? DEFAULT_EMAIL_PROVIDER_ID : "");
    const provider = providers.get(providerId);
    if (!provider || !provider.enabled) {
      attempts.push(await persistAttempt(storage, deliveryEvent?.event.id, request, {
        channel: route.channel, providerId, status: "FAILED", error: "Provider is missing or disabled",
      }));
      continue;
    }
    try {
      const recipient = request.recipientsByChannel?.[route.channel] ?? request.recipient;
      if (!recipient) throw new Error(`No recipient is configured for ${route.channel}`);
      const routeRequest = { ...request, recipient };
      requiredValues(route, request.values);
      const providerMessageId = route.channel === "EMAIL"
        ? await sendEmail(provider, route, routeRequest)
        : route.channel === "WHATSAPP"
          ? await sendWhatsApp(provider, route, routeRequest)
          : await sendSms(provider, route, routeRequest);
      attempts.push(await persistAttempt(storage, deliveryEvent?.event.id, request, {
        channel: route.channel, providerId: provider.id, providerMessageId, status: "SENT",
      }));
    } catch (error) {
      attempts.push(await persistAttempt(storage, deliveryEvent?.event.id, request, {
        channel: route.channel, providerId: provider.id, status: "FAILED", error: safeError(error, request),
      }));
    }
  }
  return attempts;
}

export async function retryNotificationAttempt(storage: IStorage, attemptId: number): Promise<NotificationAttempt> {
  if (typeof storage.getNotificationDeliveryAttempt !== "function") {
    throw new Error("Notification delivery history is unavailable");
  }
  const existingRetry = await storage.getNotificationDeliveryRetry(attemptId);
  if (existingRetry) {
    return {
      id: existingRetry.id,
      channel: existingRetry.channel,
      providerId: existingRetry.providerId,
      providerMessageId: existingRetry.providerMessageId || undefined,
      status: existingRetry.status,
      error: existingRetry.errorReason || undefined,
    };
  }
  const failedAttempt = await storage.getNotificationDeliveryAttempt(attemptId);
  if (!failedAttempt) throw new Error("Notification delivery attempt was not found");
  if (failedAttempt.status !== "FAILED") throw new Error("Only failed notification attempts can be retried");
  const request = decryptPayload(failedAttempt.event.encryptedPayload);
  const attempts = await emitNotification(storage, {
    ...request,
    channel: failedAttempt.channel,
    providerId: failedAttempt.providerId,
    idempotencyKey: `notification-retry:${attemptId}`,
    retryOfAttemptId: attemptId,
  });
  const retry = attempts.find((attempt) => attempt.channel === failedAttempt.channel && attempt.providerId === failedAttempt.providerId);
  if (!retry) throw new Error("Notification retry did not produce an attempt");
  return retry;
}