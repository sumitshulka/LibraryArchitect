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
}

const PROVIDERS_KEY = "notification_providers_v1";
const EVENTS_KEY = "notification_events_v1";
const SECRET_MARKER = "••••••••";

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
  return NOTIFICATION_EVENT_CATALOG.map((event) => ({
    ...event,
    routes: DEFAULT_ROUTES.map((route) => ({ ...route, valueKeys: [] })),
  }));
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
  const storedProviders = parseJson<Array<NotificationProvider & { encryptedSecrets?: string }>>(providersConfig?.value, []);
  const providers = storedProviders.map(({ encryptedSecrets, secrets, ...provider }) => ({
    ...provider,
    secrets: { ...decryptSecrets(encryptedSecrets), ...(secrets || {}) },
  }));
  const storedEvents = parseJson<NotificationEvent[]>(eventsConfig?.value, []);
  const events = storedEvents.length ? storedEvents : defaultEvents();
  return { providers, events };
}

export async function saveNotificationSetup(storage: IStorage, setup: NotificationSetup) {
  const existing = await loadNotificationSetup(storage);
  const existingById = new Map(existing.providers.map((provider) => [provider.id, provider]));
  const storedProviders = setup.providers.map(({ secrets = {}, ...provider }) => {
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

  await storage.setSystemConfig({
    key: PROVIDERS_KEY,
    value: JSON.stringify(storedProviders),
    category: "notifications",
    description: "Notification provider connections",
  });
  await storage.setSystemConfig({
    key: EVENTS_KEY,
    value: JSON.stringify(setup.events),
    category: "notifications",
    description: "Event-based notification routes",
  });
}

export function toPublicNotificationSetup(setup: NotificationSetup) {
  return {
    providers: setup.providers.map(({ secrets, ...provider }) => ({
      ...provider,
      secretKeys: Object.keys(secrets || {}),
    })),
    events: setup.events,
    eventCatalog: NOTIFICATION_EVENT_CATALOG,
    secretMarker: SECRET_MARKER,
  };
}