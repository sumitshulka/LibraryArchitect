import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Mail, MessageCircle, Plus, Save, Smartphone, Trash2 } from "lucide-react";
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
type Setup = { providers: Provider[]; events: EventConfig[]; secretMarker: string };

const PROVIDER_OPTIONS: Record<Channel, Array<{ value: string; label: string }>> = {
  EMAIL: [],
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
  const [selectedChannel, setSelectedChannel] = useState<Channel>("WHATSAPP");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setProviders(data.providers || []);
      setEvents(data.events || []);
    }
  }, [data]);

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, events }),
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

  const visibleProviders = useMemo(
    () => providers.filter((provider) => provider.channel === selectedChannel),
    [providers, selectedChannel],
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

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">WhatsApp and SMS provider connections</h3>
              <p className="text-sm text-muted-foreground">Email uses the existing Default Email Provider above. WhatsApp and SMS credentials are encrypted before storage and never returned to the browser.</p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedChannel} onValueChange={(value) => setSelectedChannel(value as Channel)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setProviders((current) => [...current, newProvider(selectedChannel, current.length)])}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {visibleProviders.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No {selectedChannel.toLowerCase()} provider configured.</p>}
          {visibleProviders.map((provider) => (
            <Card key={provider.id} className="border-muted">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">{channelIcon(provider.channel)} {provider.name || "Unnamed provider"} <Badge variant="outline">{provider.provider}</Badge></div>
                  <div className="flex items-center gap-3"><Switch checked={provider.enabled} onCheckedChange={(enabled) => updateProvider(provider.id, { enabled })} /><Button variant="ghost" size="icon" onClick={() => setProviders((current) => current.filter((item) => item.id !== provider.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Connection name</Label><Input value={provider.name} onChange={(event) => updateProvider(provider.id, { name: event.target.value })} placeholder="Organization email" /></div>
                  <div className="grid gap-2"><Label>Provider</Label><Select value={provider.provider} onValueChange={(value) => updateProvider(provider.id, { provider: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROVIDER_OPTIONS[provider.channel].map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {provider.channel === "WHATSAPP" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Graph API base URL</Label><Input value={provider.settings.apiBaseUrl || "https://graph.facebook.com"} onChange={(event) => updateProviderSetting(provider.id, "apiBaseUrl", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>Phone number ID</Label><Input value={provider.settings.phoneNumberId || ""} onChange={(event) => updateProviderSetting(provider.id, "phoneNumberId", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>WABA ID</Label><Input value={provider.settings.wabaId || ""} onChange={(event) => updateProviderSetting(provider.id, "wabaId", event.target.value)} /></div>
                    <div className="grid gap-2"><Label>Access token</Label><Input type="password" value={provider.secrets?.accessToken || ""} onChange={(event) => updateProviderSecret(provider.id, "accessToken", event.target.value)} placeholder={provider.secretKeys?.length ? data?.secretMarker : "Stored encrypted"} /></div>
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
            <h3 className="font-semibold">Event routing and templates</h3>
            <p className="text-sm text-muted-foreground">The event identifier is what application code uses. Each channel can map it to its own provider template and values.</p>
          </div>
          <div className="space-y-4">
            {events.map((notificationEvent) => (
              <Card key={notificationEvent.id} className="border-muted">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><div className="font-medium">{notificationEvent.label}</div><div className="font-mono text-xs text-muted-foreground">{notificationEvent.id}</div><p className="mt-1 text-sm text-muted-foreground">{notificationEvent.description}</p></div>
                    <Switch checked={notificationEvent.enabled} onCheckedChange={(enabled) => setEvents((current) => current.map((item) => item.id === notificationEvent.id ? { ...item, enabled } : item))} />
                  </div>
                  {notificationEvent.routes.map((route) => (
                    <div key={route.channel} className="grid gap-3 rounded-md border p-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-end">
                      <div className="flex items-center gap-2 pb-2 text-sm font-medium">{channelIcon(route.channel)} {route.channel}</div>
                      <div className="grid gap-1"><Label className="text-xs">Provider</Label><Select value={route.providerId || "none"} onValueChange={(value) => updateRoute(notificationEvent.id, route.channel, { providerId: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Not configured" /></SelectTrigger><SelectContent><SelectItem value="none">Not configured</SelectItem>{providers.filter((provider) => provider.channel === route.channel).map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name || provider.provider}</SelectItem>)}</SelectContent></Select></div>
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
    </div>
  );
}