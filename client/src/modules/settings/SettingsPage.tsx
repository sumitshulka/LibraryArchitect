import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Building2, Lock, Globe, Mail, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure library rules, integrations, and preferences.</p>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <div className="grid md:grid-cols-[250px_1fr] gap-6">
          <div className="flex flex-col">
            <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 space-y-1">
              <TabsTrigger 
                value="general" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Building2 className="mr-2 h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger 
                value="circulation" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Globe className="mr-2 h-4 w-4" />
                Circulation Rules
              </TabsTrigger>
              <TabsTrigger 
                value="integration" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Database className="mr-2 h-4 w-4" />
                Integrations (ERP)
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Mail className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Lock className="mr-2 h-4 w-4" />
                Security & Access
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1">
            <TabsContent value="general" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Library Information</CardTitle>
                  <CardDescription>Basic details about your library instance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lib-name">Library Name</Label>
                    <Input id="lib-name" defaultValue="Central University Library" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lib-code">Branch Code</Label>
                    <Input id="lib-code" defaultValue="MAIN-01" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="utc-5">
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="utc-5">Eastern Time (US & Canada)</SelectItem>
                        <SelectItem value="utc-8">Pacific Time (US & Canada)</SelectItem>
                        <SelectItem value="gmt">London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="circulation" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Loan Policies</CardTitle>
                  <CardDescription>Set default borrowing durations and limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="student-days">Student Loan Period (Days)</Label>
                      <Input id="student-days" type="number" defaultValue="14" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="staff-days">Staff Loan Period (Days)</Label>
                      <Input id="staff-days" type="number" defaultValue="30" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Renewals</Label>
                      <p className="text-xs text-muted-foreground">Patrons can renew items online</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Late Fines</Label>
                      <p className="text-xs text-muted-foreground">Automatically calculate fines for overdue items</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fine-amount">Fine per Day ($)</Label>
                    <Input id="fine-amount" type="number" defaultValue="0.50" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integration" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>ERP Integration</CardTitle>
                  <CardDescription>Configure connection to external Education ERP systems.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="auth-mode">Authentication Mode</Label>
                    <Select defaultValue="erp">
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Database Only</SelectItem>
                        <SelectItem value="erp">ERP / SSO Integration</SelectItem>
                        <SelectItem value="hybrid">Hybrid (Local + ERP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="erp-endpoint">ERP API Endpoint</Label>
                      <Input id="erp-endpoint" placeholder="https://api.university-erp.com/v1" defaultValue="https://api.mock-erp.edu/v1" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="api-key">API Key / Secret</Label>
                      <Input id="api-key" type="password" value="sk_live_xxxxxxxxxxxx" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-600">Connection Verified</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </MainLayout>
  );
}
