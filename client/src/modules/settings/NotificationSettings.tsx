import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Link2, Mail, MessageCircle, Plus, RefreshCw, RotateCcw, Save, Send, Smartphone, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Channel = "EMAIL" | "WHATSAPP" | "SMS";
type Provider = {
  id: string;
  name: string;
  channel: Channel;
  provider: string;
  enabled: boolean;
  settings: Record<string, string>;
  secretKeys?: string[];
  secrets?: Record<string, string>;
};
type Route = {
  channel: Channel;
  providerId: string;
  enabled: boolean;
  templateId?: string;
  language?: string;
  subject?: string;
  bodyTemplate?: string;
  valueKeys: string[];
  allowOverride: boolean;
};
type EventConfig = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  routes: Route[];
};
type Setup = {
  providers: Provider[];
  events: EventConfig[];
  defaultProviders: Partial<Record<Channel, string>>;
  configuredChannels: Channel[];
  secretMarker: string;
  allowErpUserNotifications: boolean;
};
type DeliveryHistoryItem = {
  id: number;
  channel: Channel;
  providerId: string;
  status: "SENT" | "FAILED";
  providerMessageId?: string | null;
  errorReason?: string | null;
  retryOfAttemptId?: number | null;
  createdAt: string;
  event: {
    eventId: string;
    recipientRedacted: string;
    valuesRedacted: Record<string, string>;
    createdAt: string;
  };
};
type DeliveryHistoryFilters = {
  eventId: string;
  channel: "ALL" | Channel;
  providerId: string;
  status: "ALL" | "SENT" | "FAILED";
  startDate: string;
  endDate: string;
};

const PROVIDER_OPTIONS: Record<Channel, Array<{ value: string; label: string }>> = {
  EMAIL: [
    { value: "GOOGLE_GMAIL", label: "Google Workspace / Gmail" },
    { value: "MICROSOFT_365", label: "Microsoft 365" },
  ],
  WHATSAPP: [{ value: "META_WABA", label: "Meta WhatsApp Business" }],
  SMS: [{ value: "HTTP_SMS", label: "Generic HTTP SMS provider" }],
};

const channelIcon = (channel: Channel) =>
  channel === "EMAIL" ? <Mail className="h-4 w-4" /> :
  channel === "WHATSAPP" ? <MessageCircle className="h-4 w-4" /> :
  <Smartphone className="h-4 w-4" />;

function newProvider(channel: Channel, index: number): Provider {
  return {
    id: `${channel.toLowerCase()}-${Date.now()}-${index}`,
    name: "",
    channel,
    provider: PROVIDER_OPTIONS[channel][0].value,
    enabled: true,
    settings: {},
    secrets: {},
  };
}

function parseSettingsList<T>(provider: Provider, key: string): T[] {
  try {
    const value = JSON.parse(provider.settings[key] || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function NotificationDeliveryHistory({ providers, events }: { providers: Provider[]; events: EventConfig[] }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DeliveryHistoryFilters>({
    eventId: "ALL",
    channel: "ALL",
    providerId: "ALL",
    status: "ALL",
    startDate: "",
    endDate: "",
  });
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const query = useQuery<{ attempts: DeliveryHistoryItem[]; total: number }>({
    queryKey: ["notification-delivery-history", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "ALL") params.set(key, value);
      });
      const response = await fetch(`/api/notifications/history?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load delivery history");
      return response.json();
    },
  });

  const updateFilter = <K extends keyof DeliveryHistoryFilters>(key: K, value: DeliveryHistoryFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const retry = async (attemptId: number) => {
    setRetryingId(attemptId);
    try {
      const response = await fetch(`/api/notifications/history/${attemptId}/retry`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to retry notification");
      toast[result.success ? "success" : "error"](result.success ? "Notification retry sent" : "Notification retry failed");
      queryClient.invalidateQueries({ queryKey: ["notification-delivery-history"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry notification");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Delivery History</CardTitle>
            <CardDescription>Review redacted delivery outcomes and safely retry failed provider attempts. Message content and credentials are never shown here.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="grid gap-1"><Label className="text-xs">Event</Label><Select value={filters.eventId} onValueChange={(value) => updateFilter("eventId", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All events</SelectItem>{events.map((event) => <SelectItem key={event.id} value={event.id}>{event.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">Channel</Label><Select value={filters.channel} onValueChange={(value) => updateFilter("channel", value as DeliveryHistoryFilters["channel"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All channels</SelectItem><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem><SelectItem value="SMS">SMS</SelectItem></SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">Provider</Label><Select value={filters.providerId} onValueChange={(value) => updateFilter("providerId", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All providers</SelectItem>{providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name || provider.id}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">Status</Label><Select value={filters.status} onValueChange={(value) => updateFilter("status", value as DeliveryHistoryFilters["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="SENT">Sent</SelectItem><SelectItem value="FAILED">Failed</SelectItem></SelectContent></Select></div>
          <div className="grid gap-1"><Label className="text-xs">From</Label><Input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></div>
          <div className="grid gap-1"><Label className="text-xs">To</Label><Input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></div>
        </div>
        {query.isError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Failed to load delivery history"}</p>}
        {!query.isLoading && !query.data?.attempts.length && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No delivery attempts match these filters.</p>}
        {!!query.data?.attempts.length && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Event</th><th className="p-3 font-medium">Channel</th><th className="p-3 font-medium">Provider</th><th className="p-3 font-medium">Recipient / values</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Details</th><th className="p-3 font-medium"></th></tr></thead>
              <tbody>
                {query.data.attempts.map((attempt) => {
                  const event = events.find((item) => item.id === attempt.event.eventId);
                  const provider = providers.find((item) => item.id === attempt.providerId);
                  return <tr key={attempt.id} className="border-t align-top">
                    <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{new Date(attempt.createdAt).toLocaleString()}</td>
                    <td className="p-3"><div className="font-medium">{event?.label || attempt.event.eventId}</div><div className="font-mono text-xs text-muted-foreground">{attempt.event.eventId}</div></td>
                    <td className="p-3"><span className="flex items-center gap-2">{channelIcon(attempt.channel)} {attempt.channel}</span></td>
                    <td className="p-3">{provider?.name || attempt.providerId}</td>
                    <td className="p-3 text-xs"><div>{attempt.event.recipientRedacted}</div><div className="mt-1 text-muted-foreground">{Object.keys(attempt.event.valuesRedacted || {}).join(", ") || "No values"}</div></td>
                    <td className="p-3"><Badge variant={attempt.status === "SENT" ? "default" : "destructive"}>{attempt.status === "SENT" ? "Sent" : "Failed"}</Badge></td>
                    <td className="max-w-xs p-3 text-xs text-muted-foreground">{attempt.status === "FAILED" ? attempt.errorReason || "Provider delivery failed" : attempt.providerMessageId ? `Provider message: ${attempt.providerMessageId}` : "Accepted by provider"}</td>
                    <td className="p-3">{attempt.status === "FAILED" && <Button variant="outline" size="sm" className="gap-1" onClick={() => retry(attempt.id)} disabled={retryingId === attempt.id}><RotateCcw className={`h-3.5 w-3.5 ${retryingId === attempt.id ? "animate-spin" : ""}`} /> Retry</Button>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!query.data?.total && <p className="text-xs text-muted-foreground">Showing {query.data.attempts.length} of {query.data.total} attempts.</p>}
      </CardContent>
    </Card>
  );
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Setup>({
    queryKey: ["notification-setup"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/setup");
      if (!response.ok) throw new Error("Failed to load notification setup");
      return response.json();
    },
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [defaultProviders, setDefaultProviders] = useState<Partial<Record<Channel, string>>>({});
  const [selectedChannel, setSelectedChannel] = useState<Channel>("WHATSAPP");
  const [isSaving, setIsSaving] = useState(false);
  const [allowErpUserNotifications, setAllowErpUserNotifications] = useState(false);

  useEffect(() => {
    if (data) {
      setProviders(data.providers || []);
      setEvents(data.events || []);
      setDefaultProviders(data.defaultProviders || {});
      setAllowErpUserNotifications(data.allowErpUserNotifications === true);
    }
  }, [data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("notificationOAuth");
    if (!result) return;
    if (result === "success") {
      toast.success(`${params.get("provider") === "META_WABA" ? "Meta WhatsApp" : "Email"} account linked`);
    } else {
      toast.error(params.get("message") || "Provider authorization failed");
    }
    window.history.replaceState({}, "", `${window.location.pathname}?section=notifications`);
  }, []);

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, events, defaultProviders, allowErpUserNotifications }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save notification setup");
      toast.success("Notification setup saved");
      queryClient.invalidateQueries({ queryKey: ["notification-setup"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save notification setup");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProvider = (id: string, update: Partial<Provider>) => {
    setProviders((current) => current.map((provider) => provider.id === id ? { ...provider, ...update } : provider));
  };
  const updateProviderSetting = (id: string, key: string, value: string) => {
    setProviders((current) => current.map((provider) => provider.id === id
      ? { ...provider, settings: { ...provider.settings, [key]: value } }
      : provider));
  };
  const updateProviderSecret = (id: string, key: string, value: string) => {
    setProviders((current) => current.map((provider) => provider.id === id
      ? { ...provider, secrets: { ...provider.secrets, [key]: value } }
      : provider));
  };
  const updateRoute = (eventId: string, channel: Channel, update: Partial<Route>) => {
    setEvents((current) => current.map((event) => event.id !== eventId ? event : {
      ...event,
      routes: event.routes.map((route) => route.channel === channel ? { ...route, ...update } : route),
    }));
  };

  const startOAuth = (provider: "GOOGLE_GMAIL" | "MICROSOFT_365" | "META_WABA") => {
    window.location.assign(`/api/notifications/oauth/${provider}/start`);
  };

  const providerAction = async (providerId: string, action: "verify" | "test") => {
    try {
      if (action === "verify") {
        const response = await fetch(`/api/notifications/providers/${providerId}/verify`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Provider verification failed");
        toast.success(result.message || "Provider verified");
        return;
      }
      const recipient = window.prompt("Enter a recipient for the test notification");
      if (!recipient) return;
      const provider = providers.find((item) => item.id === providerId);
      const templateId = provider?.channel === "WHATSAPP"
        ? window.prompt("WhatsApp template name", parseSettingsList<{ name?: string }>(provider, "templates")[0]?.name || "") || undefined
        : undefined;
      const response = await fetch(`/api/notifications/providers/${providerId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, templateId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Provider test failed");
      toast.success("Test notification sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider action failed");
    }
  };

  const configureMeta = async (provider: Provider) => {
    const wabaId = provider.settings.wabaId;
    const phoneNumberId = provider.settings.phoneNumberId;
    if (!wabaId || !phoneNumberId) {
      toast.error("Select a WhatsApp Business Account and phone number first");
      return;
    }
    try {
      const response = await fetch(`/api/notifications/providers/${provider.id}/meta-configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wabaId, phoneNumberId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to configure WhatsApp");
      setProviders(result.setup.providers || []);
      setDefaultProviders(result.setup.defaultProviders || {});
      toast.success("WhatsApp account configured and templates loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to configure WhatsApp");
    }
  };

  const loadMetaPhones = async (provider: Provider) => {
    const wabaId = provider.settings.wabaId;
    if (!wabaId) {
      toast.error("Select a WhatsApp Business Account first");
      return;
    }
    try {
      const response = await fetch(`/api/notifications/providers/${provider.id}/meta-phones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wabaId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load phone numbers");
      setProviders(result.setup.providers || []);
      toast.success("Phone numbers loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load phone numbers");
    }
  };

  const refreshMeta = async (provider: Provider) => {
    try {
      const response = await fetch(`/api/notifications/providers/${provider.id}/meta-refresh`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to refresh WhatsApp templates");
      setProviders(result.setup.providers || []);
      toast.success("WhatsApp templates refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh WhatsApp templates");
    }
  };

  const visibleProviders = useMemo(
    () => providers.filter((provider) => provider.channel === selectedChannel),
    [providers, selectedChannel],
  );
  const configuredChannels = useMemo(
    () => {
      const configured = new Set<Channel>(data?.configuredChannels || []);
      providers.filter((provider) => provider.enabled).forEach((provider) => configured.add(provider.channel));
      return (["EMAIL", "WHATSAPP", "SMS"] as Channel[]).filter((channel) => configured.has(channel));
    },
    [data?.configuredChannels, providers],
  );

  if (isLoading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading notification setup…</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications Setup</CardTitle>
              <CardDescription>
                Configure provider connections and event-based delivery routes. Application features use message identifiers; provider template IDs stay here.
              </CardDescription>
            </div>
            <Button onClick={save} disabled={isSaving} className="gap-2"><Save className="h-4 w-4" />{isSaving ? "Saving…" : "Save Setup"}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            WhatsApp and SMS routes can require provider template IDs and ordered or named values. Configure those mappings per event below.
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <h3 className="font-semibold">Allow notifications for ERP-managed users</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Local users can always use notification actions. ERP users are hidden from those actions by default because their ERP/SSO system owns communication. Enable this only when local staff should also be able to contact ERP users.
              </p>
            </div>
            <Switch
              checked={allowErpUserNotifications}
              onCheckedChange={setAllowErpUserNotifications}
              aria-label="Allow notifications for ERP-managed users"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Provider connections</h3>
              <p className="text-sm text-muted-foreground">Link Google, Microsoft, or Meta accounts with OAuth. Access and refresh tokens are encrypted on the server and never returned to the browser.</p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as Channel)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setProviders((current) => [...current, newProvider(selectedChannel, current.length)])} disabled={selectedChannel === "EMAIL"}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {selectedChannel === "EMAIL" && (
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-4">
              <span className="mr-2 self-center text-sm text-muted-foreground">Link an account:</span>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => startOAuth("GOOGLE_GMAIL")}><Link2 className="h-4 w-4" /> Google Workspace / Gmail</Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => startOAuth("MICROSOFT_365")}><Link2 className="h-4 w-4" /> Microsoft 365</Button>
            </div>
          )}
          {selectedChannel === "WHATSAPP" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-4">
              <span className="mr-2 text-sm text-muted-foreground">Use OAuth to authorize a WABA, phone number, and templates.</span>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => startOAuth("META_WABA")}><Link2 className="h-4 w-4" /> Link Meta WhatsApp</Button>
            </div>
          )}

          {visibleProviders.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No {selectedChannel.toLowerCase()} provider configured.</p>}
          {visibleProviders.map((provider) => (
            <Card key={provider.id} className="border-muted">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">{channelIcon(provider.channel)} {provider.name || "Unnamed provider"} <Badge variant="outline">{provider.provider}</Badge></div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => providerAction(provider.id, "verify")}><CheckCircle2 className="h-4 w-4" /> Verify</Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => providerAction(provider.id, "test")}><Send className="h-4 w-4" /> Test send</Button>
                    <Switch checked={provider.enabled} onCheckedChange={(enabled) => updateProvider(provider.id, { enabled })} disabled={provider.id === "default-email-provider"} />
                    {provider.id !== "default-email-provider" && <Button variant="ghost" size="icon" onClick={() => setProviders((current) => current.filter((item) => item.id !== provider.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Connection name</Label><Input value={provider.name} onChange={(event) => updateProvider(provider.id, { name: event.target.value })} placeholder="Organization email" /></div>
                  <div className="grid gap-2"><Label>Provider</Label>{provider.id === "default-email-provider" ? <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">SMTP</div> : <Select value={provider.provider} onValueChange={(value) => updateProvider(provider.id, { provider: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROVIDER_OPTIONS[provider.channel].map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>}</div>
                </div>
                {provider.channel === "EMAIL" && provider.id !== "default-email-provider" && (
                  <p className="text-sm text-muted-foreground">Linked account: {provider.settings.username || "account unavailable"}. Relink the account to replace its OAuth credentials.</p>
                )}
                {provider.channel === "WHATSAPP" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Graph API base URL</Label><Input value={provider.settings.apiBaseUrl || "https://graph.facebook.com"} onChange={(event) => updateProviderSetting(provider.id, "apiBaseUrl", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>Phone number ID</Label><Input value={provider.settings.phoneNumberId || ""} onChange={(event) => updateProviderSetting(provider.id, "phoneNumberId", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>WABA ID</Label><Input value={provider.settings.wabaId || ""} onChange={(event) => updateProviderSetting(provider.id, "wabaId", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>Access token</Label><Input type="password" value={provider.secrets?.accessToken || ""} onChange={(event) => updateProviderSecret(provider.id, "accessToken", event.target.value)} placeholder={provider.secretKeys?.length ? data?.secretMarker : "Stored encrypted"} /></div>
                    </div>
                    {provider.provider === "META_WABA" && (
                      <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-2"><Label>WhatsApp Business Account</Label><Select value={provider.settings.wabaId || ""} onValueChange={(value) => updateProviderSetting(provider.id, "wabaId", value)}><SelectTrigger><SelectValue placeholder="Select WABA" /></SelectTrigger><SelectContent>{parseSettingsList<{ id: string; name: string }>(provider, "wabaOptions").map((option) => <SelectItem key={option.id} value={option.id}>{option.name || option.id}</SelectItem>)}</SelectContent></Select></div>
                          <div className="grid gap-2"><Label>Phone number</Label><Select value={provider.settings.phoneNumberId || ""} onValueChange={(value) => updateProviderSetting(provider.id, "phoneNumberId", value)}><SelectTrigger><SelectValue placeholder="Select phone number" /></SelectTrigger><SelectContent>{parseSettingsList<{ id: string; display_phone_number?: string; verified_name?: string }>(provider, "phoneOptions").map((option) => <SelectItem key={option.id} value={option.id}>{option.display_phone_number || option.verified_name || option.id}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => loadMetaPhones(provider)}>Load phone numbers</Button><Button size="sm" onClick={() => configureMeta(provider)}>Save WABA selection</Button><Button variant="outline" size="sm" onClick={() => refreshMeta(provider)}><RefreshCw className="mr-2 h-4 w-4" /> Refresh templates</Button></div>
                        {!!parseSettingsList(provider, "templates").length && <div className="grid gap-2"><Label>Available templates</Label><div className="flex flex-wrap gap-2">{parseSettingsList<{ name?: string; language?: string; status?: string }>(provider, "templates").map((template) => <Badge key={`${template.name}-${template.language}`} variant="secondary">{template.name} · {template.language} · {template.status}</Badge>)}</div></div>}
                      </div>
                    )}
                  </div>
                )}
                {provider.channel === "SMS" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2"><Label>HTTPS endpoint</Label><Input value={provider.settings.endpoint || ""} onChange={(event) => updateProviderSetting(provider.id, "endpoint", event.target.value)} placeholder="https://sms.example.com/send" /></div>
                      <div className="grid gap-2"><Label>HTTP method</Label><Select value={provider.settings.method || "POST"} onValueChange={(value) => updateProviderSetting(provider.id, "method", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="POST">POST</SelectItem><SelectItem value="GET">GET</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid gap-2"><Label>Request body template</Label><Textarea value={provider.settings.bodyTemplate || ""} onChange={(event) => updateProviderSetting(provider.id, "bodyTemplate", event.target.value)} placeholder={'{"to":"{{recipient}}","template_id":"{{templateId}}","values":{{valuesJson}}}'} className="font-mono text-xs" /></div>
                    <div className="grid gap-2"><Label>Bearer/API token</Label><Input type="password" value={provider.secrets?.apiToken || ""} onChange={(event) => updateProviderSecret(provider.id, "apiToken", event.target.value)} placeholder={provider.secretKeys?.length ? data?.secretMarker : "Stored encrypted"} /></div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Separator />
          <div>
            <h3 className="font-semibold">Default providers for events</h3>
            <p className="text-sm text-muted-foreground">Each event uses the selected provider for its channel unless an advanced API caller supplies an explicit override.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {configuredChannels.map((channel) => {
              const defaultProvider = providers.find((provider) => provider.id === defaultProviders[channel]);
              return (
                <Card key={channel} className="border-muted">
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex items-center gap-2 font-medium">{channelIcon(channel)} {channel}</div>
                    {channel === "EMAIL" ? (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <Select
                          value={defaultProviders.EMAIL || "none"}
                          onValueChange={(value) => setDefaultProviders((current) => ({ ...current, EMAIL: value === "none" ? undefined : value }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select default email provider" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No default provider</SelectItem>
                            {providers.filter((provider) => provider.channel === "EMAIL" && provider.enabled).map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>{provider.name || provider.provider}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-2 text-xs text-muted-foreground">SMTP and linked OAuth accounts can both be selected.</div>
                      </div>
                    ) : (
                      <Select
                        value={defaultProviders[channel] || "none"}
                        onValueChange={(value) => setDefaultProviders((current) => ({ ...current, [channel]: value === "none" ? undefined : value }))}
                      >
                        <SelectTrigger><SelectValue placeholder={`Select default ${channel.toLowerCase()} provider`} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No default provider</SelectItem>
                          {providers.filter((provider) => provider.channel === channel && provider.enabled).map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.name || provider.provider}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {defaultProvider && <p className="text-xs text-muted-foreground">Current default: {defaultProvider.name || defaultProvider.provider}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {configuredChannels.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Configure a WhatsApp or SMS provider above to enable event routing for that channel.</p>
          )}

          <div>
            <h3 className="font-semibold">Event routing and templates</h3>
            <p className="text-sm text-muted-foreground">The event identifier is what application code uses. Only configured channels appear here; each one uses its selected default provider.</p>
          </div>
          <div className="space-y-4">
            {events.map((notificationEvent) => (
              <Card key={notificationEvent.id} className="border-muted">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><div className="font-medium">{notificationEvent.label}</div><div className="font-mono text-xs text-muted-foreground">{notificationEvent.id}</div><p className="mt-1 text-sm text-muted-foreground">{notificationEvent.description}</p></div>
                    <Switch checked={notificationEvent.enabled} onCheckedChange={(enabled) => setEvents((current) => current.map((item) => item.id === notificationEvent.id ? { ...item, enabled } : item))} />
                  </div>
                  {notificationEvent.routes.filter((route) => configuredChannels.includes(route.channel)).map((route) => (
                    <div key={route.channel} className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto_1fr_1fr_auto] md:items-end">
                      <div className="flex items-center gap-2 pb-2 text-sm font-medium">{channelIcon(route.channel)} {route.channel}</div>
                      <div className="grid gap-1"><Label className="text-xs">Default provider</Label><div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">{providers.find((provider) => provider.id === defaultProviders[route.channel])?.name || "No default provider selected"}</div></div>
                      <div className="grid gap-1"><Label className="text-xs">Provider template ID</Label><Input value={route.templateId || ""} onChange={(inputEvent) => updateRoute(notificationEvent.id, route.channel, { templateId: inputEvent.target.value })} placeholder={route.channel === "EMAIL" ? "Optional application template" : "Required by provider"} /></div>
                      <div className="grid gap-1"><Label className="text-xs">Value keys</Label><Input value={route.valueKeys.join(", ")} onChange={(inputEvent) => updateRoute(notificationEvent.id, route.channel, { valueKeys: inputEvent.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="firstName, setupLink" /></div>
                      <div className="flex items-center gap-2 pb-2"><Switch checked={route.enabled} onCheckedChange={(enabled) => updateRoute(notificationEvent.id, route.channel, { enabled })} /><span className="text-xs">Active</span></div>
                      <div className="grid gap-1 md:col-start-2"><Label className="text-xs">Language</Label><Input value={route.language || ""} onChange={(inputEvent) => updateRoute(notificationEvent.id, route.channel, { language: inputEvent.target.value })} placeholder={route.channel === "WHATSAPP" ? "en_US" : "en"} /></div>
                      <div className="flex items-center gap-2 pb-2 md:col-span-2"><Switch checked={route.allowOverride} onCheckedChange={(allowOverride) => updateRoute(notificationEvent.id, route.channel, { allowOverride })} /><span className="text-xs">Allow admin per-send override</span></div>
                      {route.channel === "EMAIL" && (
                        <>
                          <div className="grid gap-1 md:col-start-2"><Label className="text-xs">Subject template</Label><Input value={route.subject || ""} onChange={(inputEvent) => updateRoute(notificationEvent.id, route.channel, { subject: inputEvent.target.value })} placeholder="Your account setup link" /></div>
                          <div className="grid gap-1 md:col-span-3"><Label className="text-xs">HTML/body template</Label><Textarea value={route.bodyTemplate || ""} onChange={(inputEvent) => updateRoute(notificationEvent.id, route.channel, { bodyTemplate: inputEvent.target.value })} placeholder="Hello {{firstName}}, use {{setupLink}} to set your password." className="font-mono text-xs" /></div>
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      <NotificationDeliveryHistory providers={providers} events={events} />
    </div>
  );
}