import crypto from "crypto";
import type { IStorage } from "./storage";

export type NotificationChannel = "EMAIL" | "WHATSAPP" | "SMS";

export interface NotificationProvider {
  id: string;
  name: string;
  channel: NotificationChannel;
  provider: string;
  enabled: boolean;
  settings: Record<string, string>;
  secrets?: Record<string, string>;
}

export interface NotificationRoute {
  channel: NotificationChannel;
  providerId: string;
  enabled: boolean;
  templateId?: string;
  language?: string;
  subject?: string;
  bodyTemplate?: string;
  valueKeys: string[];
  allowOverride: boolean;
}

export interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  routes: NotificationRoute[];
}

export interface NotificationSetup {
  providers: NotificationProvider[];
  events: NotificationEvent[];
  defaultProviders: Partial<Record<NotificationChannel, string>>;
  allowErpUserNotifications: boolean;
}

const PROVIDERS_KEY = "notification_providers_v1";
const EVENTS_KEY = "notification_events_v1";
const DEFAULT_PROVIDERS_KEY = "notification_default_providers_v1";
const SECRET_MARKER = "••••••••";
export const DEFAULT_EMAIL_PROVIDER_ID = "default-email-provider";

export const NOTIFICATION_EVENT_CATALOG: Omit<NotificationEvent, "routes">[] = [
  { id: "USER_PASSWORD_SETUP", label: "User password setup", description: "Send a one-time link when a local account needs a password.", enabled: true },
  { id: "PASSWORD_RESET_OTP", label: "Password reset OTP", description: "Send the one-time code used to reset a password.", enabled: true },
  { id: "ACCOUNT_ACTIVATED", label: "Account activated", description: "Notify a user when their account becomes active.", enabled: false },
  { id: "ACCOUNT_SUSPENDED", label: "Account suspended", description: "Notify a user when access is suspended.", enabled: false },
  { id: "LOAN_DUE", label: "Loan due reminder", description: "Remind a patron that a borrowed item is due.", enabled: false },
  { id: "LOAN_OVERDUE", label: "Loan overdue", description: "Notify a patron when a loan becomes overdue.", enabled: false },
  { id: "RESERVATION_READY", label: "Reservation ready", description: "Notify a patron that a reserved item is ready.", enabled: false },
  { id: "FINE_CREATED", label: "Fine created", description: "Notify a patron when a fine is assessed.", enabled: false },
];

const DEFAULT_ROUTES: NotificationRoute[] = [
  { channel: "EMAIL", providerId: "", enabled: false, templateId: "", language: "en", subject: "", bodyTemplate: "", valueKeys: [], allowOverride: true },
  { channel: "WHATSAPP", providerId: "", enabled: false, templateId: "", language: "en_US", valueKeys: [], allowOverride: true },
  { channel: "SMS", providerId: "", enabled: false, templateId: "", language: "", valueKeys: [], allowOverride: true },
];

function encryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to protect notification credentials");
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecrets(secrets: Record<string, string>) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(secrets), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecrets(value?: string): Record<string, string> {
  if (!value) return {};
  try {
    const [ivText, tagText, encryptedText] = value.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8"));
  } catch {
    return {};
  }
}

function defaultEvents(): NotificationEvent[] {
  return NOTIFICATION_EVENT_CATALOG.map((event) => {
    const routes: NotificationRoute[] = DEFAULT_ROUTES.map((route) => ({ ...route, valueKeys: [] }));
    if (event.id === "USER_PASSWORD_SETUP") {
      routes[0] = {
        ...routes[0],
        providerId: DEFAULT_EMAIL_PROVIDER_ID,
        enabled: true,
        subject: "Set up your SC24Lib password",
        bodyTemplate: [
          "<p>Hello {{firstName}},</p>",
          "<p>Your SC24Lib account is ready. Use the secure link below to set your password:</p>",
          "<p><a href=\"{{setupLink}}\">Set up your password</a></p>",
          "<p>This link expires at {{expiresAt}} and can only be used once.</p>",
        ].join(""),
        valueKeys: ["firstName", "setupLink", "expiresAt"],
      };
    } else if (event.id === "PASSWORD_RESET_OTP") {
      routes[0] = {
        ...routes[0],
        providerId: DEFAULT_EMAIL_PROVIDER_ID,
        enabled: true,
        subject: "Your SC24Lib password reset code",
        bodyTemplate: [
          "<p>Hello {{firstName}},</p>",
          "<p>Use this one-time code to reset your SC24Lib password:</p>",
          "<p style=\"font-size: 28px; font-weight: bold; letter-spacing: 8px;\">{{otp}}</p>",
          "<p>This code expires at {{expiresAt}} and can only be used once.</p>",
        ].join(""),
        valueKeys: ["firstName", "otp", "expiresAt"],
      };
    }
    return { ...event, routes };
  });
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function loadNotificationSetup(storage: IStorage): Promise<NotificationSetup> {
  const providersConfig = await storage.getSystemConfig(PROVIDERS_KEY);
  const eventsConfig = await storage.getSystemConfig(EVENTS_KEY);
  const defaultProvidersConfig = await storage.getSystemConfig(DEFAULT_PROVIDERS_KEY);
  const erpUserNotificationsConfig = await storage.getSystemConfig("allow_erp_user_notifications");
  const storedProviders = parseJson<Array<NotificationProvider & { encryptedSecrets?: string }>>(providersConfig?.value, []);
  const providers = storedProviders.map(({ encryptedSecrets, secrets, ...provider }) => ({
    ...provider,
    secrets: { ...decryptSecrets(encryptedSecrets), ...(secrets || {}) },
  }));
  const [smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom] = await Promise.all([
    storage.getSystemConfig("smtp_host"),
    storage.getSystemConfig("smtp_port"),
    storage.getSystemConfig("smtp_secure"),
    storage.getSystemConfig("smtp_user"),
    storage.getSystemConfig("smtp_pass"),
    storage.getSystemConfig("smtp_from"),
  ]);
  const defaultEmailProvider: NotificationProvider = {
    id: DEFAULT_EMAIL_PROVIDER_ID,
    name: "Default Email Provider",
    channel: "EMAIL",
    provider: "SMTP",
    enabled: Boolean(smtpHost?.value && smtpUser?.value && smtpPass?.value),
    settings: {
      host: smtpHost?.value || "",
      port: smtpPort?.value || "587",
      secure: smtpSecure?.value || "false",
      username: smtpUser?.value || "",
      from: smtpFrom?.value || smtpUser?.value || "",
    },
    secrets: smtpPass?.value ? { password: smtpPass.value } : {},
  };
  const storedEmailProviders = providers.filter((provider) => provider.channel === "EMAIL");
  const publicProviders = [defaultEmailProvider, ...storedEmailProviders, ...providers.filter((provider) => provider.channel !== "EMAIL")];
  const storedEvents = parseJson<NotificationEvent[]>(eventsConfig?.value, []);
  const rawEvents = storedEvents.length ? storedEvents : defaultEvents();
  const events = rawEvents.map((event) => ({ ...event, routes: event.routes.map((route) => ({ ...route })) }));
  const storedDefaults = parseJson<Partial<Record<NotificationChannel, string>>>(defaultProvidersConfig?.value, {});
  const enabledProviders = publicProviders.filter((provider) => provider.enabled);
  const configuredProviderIds = new Set(enabledProviders.map((provider) => provider.id));
  const defaultProviders: Partial<Record<NotificationChannel, string>> = {
    EMAIL: storedDefaults.EMAIL && configuredProviderIds.has(storedDefaults.EMAIL)
      ? storedDefaults.EMAIL
      : defaultEmailProvider.enabled
        ? DEFAULT_EMAIL_PROVIDER_ID
        : enabledProviders.find((provider) => provider.channel === "EMAIL")?.id,
    WHATSAPP: configuredProviderIds.has(storedDefaults.WHATSAPP || "") ? storedDefaults.WHATSAPP : undefined,
    SMS: configuredProviderIds.has(storedDefaults.SMS || "") ? storedDefaults.SMS : undefined,
  };
  return {
    providers: publicProviders,
    events,
    defaultProviders,
    allowErpUserNotifications: erpUserNotificationsConfig?.value === "true",
  };
}

export async function saveNotificationSetup(storage: IStorage, setup: NotificationSetup) {
  const existing = await loadNotificationSetup(storage);
  const configuredDefaults = setup.defaultProviders || {};
  const existingById = new Map(existing.providers.map((provider) => [provider.id, provider]));
  const storedProviders = setup.providers
    .filter((provider) => provider.id !== DEFAULT_EMAIL_PROVIDER_ID)
    .map(({ secrets = {}, ...provider }) => {
    const previous = existingById.get(provider.id);
    const keptSecrets = Object.fromEntries(
      Object.entries(secrets).filter(([, value]) => value && value !== SECRET_MARKER),
    );
    const mergedSecrets = { ...(previous?.secrets || {}), ...keptSecrets };
    return {
      ...provider,
      encryptedSecrets: Object.keys(mergedSecrets).length ? encryptSecrets(mergedSecrets) : undefined,
    };
  });
  const events = setup.events.map((event) => ({
    ...event,
    routes: event.routes.map((route) => route.channel === "EMAIL"
      && route.providerId === DEFAULT_EMAIL_PROVIDER_ID
      && configuredDefaults.EMAIL
      ? { ...route, providerId: configuredDefaults.EMAIL }
      : route),
  }));

  await storage.setSystemConfig({
    key: PROVIDERS_KEY,
    value: JSON.stringify(storedProviders),
    category: "notifications",
    description: "Notification provider connections",
  });
  await storage.setSystemConfig({
    key: EVENTS_KEY,
    value: JSON.stringify(events),
    category: "notifications",
    description: "Event-based notification routes",
  });
  const providerIds = new Set(setup.providers.filter((provider) => provider.enabled).map((provider) => provider.id));
  const defaultProviders: Partial<Record<NotificationChannel, string>> = {
    EMAIL: configuredDefaults.EMAIL && providerIds.has(configuredDefaults.EMAIL)
      ? configuredDefaults.EMAIL
      : existing.defaultProviders.EMAIL && providerIds.has(existing.defaultProviders.EMAIL)
        ? existing.defaultProviders.EMAIL
        : providerIds.has(DEFAULT_EMAIL_PROVIDER_ID) ? DEFAULT_EMAIL_PROVIDER_ID : undefined,
    WHATSAPP: configuredDefaults.WHATSAPP && providerIds.has(configuredDefaults.WHATSAPP)
      ? configuredDefaults.WHATSAPP
      : undefined,
    SMS: configuredDefaults.SMS && providerIds.has(configuredDefaults.SMS)
      ? configuredDefaults.SMS
      : undefined,
  };
  await storage.setSystemConfig({
    key: DEFAULT_PROVIDERS_KEY,
    value: JSON.stringify(defaultProviders),
    category: "notifications",
    description: "Default notification providers by channel",
  });
  await storage.setSystemConfig({
    key: "allow_erp_user_notifications",
    value: String(setup.allowErpUserNotifications ?? existing.allowErpUserNotifications),
    category: "notifications",
    description: "Allow local staff to send notifications to ERP-managed users",
  });
}

export function toPublicNotificationSetup(setup: NotificationSetup) {
  return {
    providers: setup.providers.map(({ secrets, ...provider }) => ({
      ...provider,
      secretKeys: Object.keys(secrets || {}),
    })),
    events: setup.events,
    defaultProviders: setup.defaultProviders || {},
    allowErpUserNotifications: setup.allowErpUserNotifications,
    configuredChannels: (Object.keys(setup.defaultProviders || {}) as NotificationChannel[]).filter((channel) => Boolean(setup.defaultProviders?.[channel])),
    eventCatalog: NOTIFICATION_EVENT_CATALOG,
    secretMarker: SECRET_MARKER,
  };
}