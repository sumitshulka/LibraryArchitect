import crypto from "crypto";
import type { IStorage } from "./storage";
import {
  loadNotificationSetup,
  saveNotificationSetup,
  type NotificationProvider,
} from "./notification-setup";

export type NotificationOAuthProvider = "GOOGLE_GMAIL" | "MICROSOFT_365" | "META_WABA";

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type MetaOption = { id: string; name: string };

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API_URL = "https://graph.facebook.com";
const GRAPH_API_VERSION = "v20.0";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getOAuthClient(provider: NotificationOAuthProvider) {
  if (provider === "GOOGLE_GMAIL") {
    return {
      clientId: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    };
  }
  if (provider === "MICROSOFT_365") {
    return {
      clientId: requiredEnv("MICROSOFT_OAUTH_CLIENT_ID"),
      clientSecret: requiredEnv("MICROSOFT_OAUTH_CLIENT_SECRET"),
    };
  }
  return {
    clientId: requiredEnv("META_OAUTH_APP_ID"),
    clientSecret: requiredEnv("META_OAUTH_APP_SECRET"),
  };
}

function stateKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for notification OAuth");
  return crypto.createHash("sha256").update(secret).digest();
}

export function createNotificationOAuthState(provider: NotificationOAuthProvider, userId: number) {
  const payload = Buffer.from(JSON.stringify({
    provider,
    userId,
    nonce: crypto.randomBytes(18).toString("base64url"),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyNotificationOAuthState(value: string, expectedProvider: NotificationOAuthProvider, expectedUserId: number) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Invalid OAuth state");
  const expectedSignature = crypto.createHmac("sha256", stateKey()).update(payload).digest("base64url");
  if (
    signature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error("Invalid OAuth state");
  }
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    provider: NotificationOAuthProvider;
    userId: number;
    expiresAt: number;
  };
  if (decoded.provider !== expectedProvider || decoded.userId !== expectedUserId || decoded.expiresAt < Date.now()) {
    throw new Error("Expired or mismatched OAuth state");
  }
}

export function getNotificationOAuthUrl(
  provider: NotificationOAuthProvider,
  redirectUri: string,
  state: string,
) {
  const client = getOAuthClient(provider);
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (provider === "GOOGLE_GMAIL") {
    params.set("scope", "openid email https://mail.google.com/");
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }
  if (provider === "MICROSOFT_365") {
    params.set("scope", "openid profile email offline_access User.Read https://outlook.office.com/SMTP.Send");
    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  }
  params.set("scope", "business_management,whatsapp_business_management,whatsapp_business_messaging");
  params.set("auth_type", "rerequest");
  return `${new URL("/" + GRAPH_API_VERSION + "/dialog/oauth", "https://www.facebook.com").toString()}?${params.toString()}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message || result?.error_description || `Provider request failed (${response.status})`;
    throw new Error(message);
  }
  return result;
}

async function fetchGraph(path: string, accessToken: string, init: RequestInit = {}) {
  return fetchJson(`${GRAPH_API_URL}/${GRAPH_API_VERSION}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function tokenExpiry(expiresIn?: number) {
  return String(Date.now() + Math.max(Number(expiresIn || 3600) - 60, 60) * 1000);
}

function providerId(provider: NotificationOAuthProvider, accountId: string) {
  const key = crypto.createHash("sha256").update(`${provider}:${accountId}`).digest("hex").slice(0, 20);
  return `oauth-${provider.toLowerCase()}-${key}`;
}

function parseOptions(value?: string): MetaOption[] {
  if (!value) return [];
  try {
    const options = JSON.parse(value);
    return Array.isArray(options) ? options : [];
  } catch {
    return [];
  }
}

async function exchangeCode(
  provider: NotificationOAuthProvider,
  code: string,
  redirectUri: string,
): Promise<OAuthTokenResponse> {
  const client = getOAuthClient(provider);
  const body = new URLSearchParams({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenUrl = provider === "GOOGLE_GMAIL"
    ? GOOGLE_TOKEN_URL
    : provider === "MICROSOFT_365"
      ? MICROSOFT_TOKEN_URL
      : `${GRAPH_API_URL}/${GRAPH_API_VERSION}/oauth/access_token`;
  const result = await fetchJson(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }) as OAuthTokenResponse;
  if (!result.access_token) throw new Error("OAuth provider did not return an access token");

  if (provider === "META_WABA") {
    const longLived = await fetchJson(`${GRAPH_API_URL}/${GRAPH_API_VERSION}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: client.clientId,
      client_secret: client.clientSecret,
      fb_exchange_token: result.access_token,
    }).toString()}`);
    return {
      ...result,
      ...longLived,
      refresh_token: result.refresh_token,
      expires_in: longLived.expires_in || result.expires_in,
    };
  }
  return result;
}

async function saveProvider(storage: IStorage, provider: NotificationProvider, accountId: string) {
  const setup = await loadNotificationSetup(storage);
  const existing = setup.providers.find((item) => item.provider === provider.provider && item.settings.accountId === accountId);
  const savedProvider = { ...provider, id: existing?.id || providerId(provider.provider as NotificationOAuthProvider, accountId), enabled: existing?.enabled ?? provider.enabled };
  setup.providers = setup.providers.filter((item) => item.id !== savedProvider.id);
  setup.providers.push(savedProvider);
  if (savedProvider.channel === "EMAIL" && !setup.defaultProviders.EMAIL) {
    setup.defaultProviders = { ...setup.defaultProviders, EMAIL: savedProvider.id };
  }
  await saveNotificationSetup(storage, setup);
  return savedProvider.id;
}

export async function completeNotificationOAuth(
  storage: IStorage,
  provider: NotificationOAuthProvider,
  code: string,
  redirectUri: string,
) {
  const token = await exchangeCode(provider, code, redirectUri);
  if (provider === "GOOGLE_GMAIL") {
    const profile = await fetchJson(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }) as { sub?: string; email?: string; name?: string };
    if (!profile.sub || !profile.email) throw new Error("Google did not return an email account");
    const savedId = await saveProvider(storage, {
      id: "",
      name: profile.name || profile.email,
      channel: "EMAIL",
      provider,
      enabled: true,
      settings: {
        accountId: profile.sub,
        username: profile.email,
        from: profile.email,
        host: "smtp.gmail.com",
        port: "465",
        secure: "true",
      },
      secrets: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || "",
        expiresAt: tokenExpiry(token.expires_in),
      },
    }, profile.sub);
    return { providerId: savedId, kind: provider };
  }
  if (provider === "MICROSOFT_365") {
    const profile = await fetchJson("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }) as { id?: string; displayName?: string; mail?: string; userPrincipalName?: string };
    const email = profile.mail || profile.userPrincipalName;
    if (!profile.id || !email) throw new Error("Microsoft did not return an email account");
    const savedId = await saveProvider(storage, {
      id: "",
      name: profile.displayName || email,
      channel: "EMAIL",
      provider,
      enabled: true,
      settings: {
        accountId: profile.id,
        username: email,
        from: email,
        host: "smtp.office365.com",
        port: "587",
        secure: "false",
        requireTLS: "true",
      },
      secrets: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || "",
        expiresAt: tokenExpiry(token.expires_in),
      },
    }, profile.id);
    return { providerId: savedId, kind: provider };
  }

  const profile = await fetchGraph("me?fields=id,name", token.access_token) as { id?: string; name?: string };
  if (!profile.id) throw new Error("Meta did not return an administrator account");
  const businesses = await fetchGraph("me/businesses?fields=id,name&limit=100", token.access_token) as { data?: MetaOption[] };
  const wabaOptions: MetaOption[] = [];
  for (const business of businesses.data || []) {
    const accounts = await fetchGraph(`${encodeURIComponent(business.id)}/owned_whatsapp_business_accounts?fields=id,name&limit=100`, token.access_token) as { data?: MetaOption[] };
    wabaOptions.push(...(accounts.data || []));
  }
  const uniqueWabas = Array.from(new Map(wabaOptions.map((item) => [item.id, item])).values());
  if (!uniqueWabas.length) throw new Error("No WhatsApp Business Accounts are available for this Meta account");
  const savedId = await saveProvider(storage, {
    id: "",
    name: profile.name ? `WhatsApp - ${profile.name}` : "Meta WhatsApp Business",
    channel: "WHATSAPP",
    provider,
    enabled: false,
    settings: {
      apiBaseUrl: GRAPH_API_URL,
      accountId: profile.id,
      wabaOptions: JSON.stringify(uniqueWabas),
    },
    secrets: {
      accessToken: token.access_token,
      expiresAt: tokenExpiry(token.expires_in),
    },
  }, profile.id);
  return { providerId: savedId, kind: provider, wabaOptions: uniqueWabas };
}

export async function configureMetaWaba(
  storage: IStorage,
  providerId: string,
  wabaId: string,
  phoneNumberId: string,
) {
  const setup = await loadNotificationSetup(storage);
  const provider = setup.providers.find((item) => item.id === providerId);
  if (!provider || provider.provider !== "META_WABA") throw new Error("Meta WhatsApp provider was not found");
  const token = provider.secrets?.accessToken;
  if (!token) throw new Error("Meta WhatsApp connection has no access token");
  const waba = parseOptions(provider.settings.wabaOptions).find((item) => item.id === wabaId);
  if (!waba) throw new Error("Selected WhatsApp Business Account is not available to this connection");
  const baseUrl = (provider.settings.apiBaseUrl || GRAPH_API_URL).replace(/\/$/, "");
  const phoneResult = await fetchJson(`${baseUrl}/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  }) as { data?: Array<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }> };
  const phone = (phoneResult.data || []).find((item) => item.id === phoneNumberId);
  if (!phone) throw new Error("Selected phone number is not available for this WABA");
  const templateResult = await fetchJson(`${baseUrl}/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  }) as { data?: Array<Record<string, string>> };
  provider.enabled = true;
  provider.name = `${waba.name} (${phone.display_phone_number || phone.id})`;
  provider.settings = {
    ...provider.settings,
    wabaId,
    wabaName: waba.name,
    phoneNumberId,
    phoneOptions: JSON.stringify(phoneResult.data || []),
    templates: JSON.stringify(templateResult.data || []),
    configuredAt: new Date().toISOString(),
  };
  await saveNotificationSetup(storage, setup);
  return provider;
}

export async function loadMetaWabaPhones(
  storage: IStorage,
  providerId: string,
  wabaId: string,
) {
  const setup = await loadNotificationSetup(storage);
  const provider = setup.providers.find((item) => item.id === providerId);
  if (!provider || provider.provider !== "META_WABA") throw new Error("Meta WhatsApp provider was not found");
  const token = provider.secrets?.accessToken;
  if (!token) throw new Error("Meta WhatsApp connection has no access token");
  const waba = parseOptions(provider.settings.wabaOptions).find((item) => item.id === wabaId);
  if (!waba) throw new Error("Selected WhatsApp Business Account is not available to this connection");
  const baseUrl = (provider.settings.apiBaseUrl || GRAPH_API_URL).replace(/\/$/, "");
  const phoneResult = await fetchJson(`${baseUrl}/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  }) as { data?: Array<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }> };
  provider.settings = {
    ...provider.settings,
    wabaId,
    wabaName: waba.name,
    phoneNumberId: "",
    phoneOptions: JSON.stringify(phoneResult.data || []),
  };
  await saveNotificationSetup(storage, setup);
  return provider;
}

export async function refreshMetaCatalog(storage: IStorage, providerId: string) {
  const setup = await loadNotificationSetup(storage);
  const provider = setup.providers.find((item) => item.id === providerId);
  if (!provider || provider.provider !== "META_WABA") throw new Error("Meta WhatsApp provider was not found");
  const token = provider.secrets?.accessToken;
  const wabaId = provider.settings.wabaId;
  if (!token || !wabaId) throw new Error("Select a WhatsApp Business Account first");
  const baseUrl = (provider.settings.apiBaseUrl || GRAPH_API_URL).replace(/\/$/, "");
  const templateResult = await fetchJson(`${baseUrl}/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,category&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  }) as { data?: Array<Record<string, string>> };
  provider.settings = { ...provider.settings, templates: JSON.stringify(templateResult.data || []) };
  await saveNotificationSetup(storage, setup);
  return provider;
}

export function parseProviderSettingOptions(provider: NotificationProvider, key: string) {
  return parseOptions(provider.settings[key]);
}