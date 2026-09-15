import crypto from "crypto";
import nodemailer from "nodemailer";
import type { IStorage } from "./storage";
import { DEFAULT_EMAIL_PROVIDER_ID, loadNotificationSetup, type NotificationChannel, type NotificationRoute, type NotificationProvider } from "./notification-setup";

export interface NotificationRequest {
  eventId: string;
  channel?: NotificationChannel;
  providerId?: string;
  recipient: string;
  recipientsByChannel?: Partial<Record<NotificationChannel, string>>;
  values: Record<string, string | number>;
  templateIdOverride?: string;
}

export interface NotificationAttempt {
  channel: NotificationChannel;
  providerId: string;
  providerMessageId?: string;
  status: "SENT" | "FAILED";
  error?: string;
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

async function sendEmail(provider: NotificationProvider, route: NotificationRoute, request: NotificationRequest): Promise<string | undefined> {
  const host = provider.settings.host;
  const password = provider.secrets?.password;
  if (!host || !provider.settings.username || !password) {
    throw new Error("Email provider requires host, username, and password/app password");
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(provider.settings.port || 587),
    secure: provider.settings.secure === "true",
    auth: { user: provider.settings.username, pass: password },
  });
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
      attempts.push({ channel: route.channel, providerId, status: "FAILED", error: "Provider is missing or disabled" });
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
      attempts.push({ channel: route.channel, providerId: provider.id, providerMessageId, status: "SENT" });
    } catch (error) {
      attempts.push({ channel: route.channel, providerId: provider.id, status: "FAILED", error: error instanceof Error ? error.message : "Notification failed" });
    }
  }
  return attempts;
}