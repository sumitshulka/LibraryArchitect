import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { librariesApi, circulationPolicyApi, type LibraryDashboardStats, type LibraryStaffMember, type CirculationPolicy } from "@/lib/api";
import { PolicyChangeDialog, PolicyHistoryList } from "@/components/PolicyChangeDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/useCurrency";
import { Settings as SettingsIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Book, 
  BookOpen, 
  Headphones, 
  Users, 
  ArrowLeft,
  Library,
  CheckCircle2,
  BookX,
  AlertTriangle,
  Truck,
  Clock,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle
} from "lucide-react";

function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default",
  testId 
}: { 
  title: string;
  value: number | string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  testId: string;
}) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };

  return (
    <Card className={`${variantStyles[variant]}`} data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <Icon className={`h-8 w-8 ${iconStyles[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function LibraryPoliciesCard({ libraryId }: { libraryId: number }) {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const canEdit = user?.role === "ADMIN";

  const { data: globalDefaults } = useQuery({
    queryKey: ["circulation-policy"],
    queryFn: () => circulationPolicyApi.get(),
  });

  const { data: library } = useQuery({
    queryKey: ["library", libraryId],
    queryFn: () => librariesApi.getById(libraryId),
    enabled: libraryId > 0,
  });

  const [overrides, setOverrides] = useState<CirculationPolicy>({});

  useEffect(() => {
    if (library) {
      setOverrides((library.policies || {}) as CirculationPolicy);
    }
  }, [library]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["circulation-policy-history", "LIBRARY", libraryId],
    queryFn: () => circulationPolicyApi.history({ scope: "LIBRARY", libraryId, limit: 50 }),
    enabled: libraryId > 0,
  });

  const mutation = useMutation({
    mutationFn: (args: { policy: CirculationPolicy; reason: string; effectiveFrom: string }) =>
      librariesApi.update(libraryId, { policies: args.policy as any, policyReason: args.reason, policyEffectiveFrom: args.effectiveFrom } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", libraryId] });
      queryClient.invalidateQueries({ queryKey: ["circulation-policy-history", "LIBRARY", libraryId] });
      refetchHistory();
      toast.success("Library policy version saved");
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields: Array<{
    key: keyof CirculationPolicy;
    label: string;
    type: "number" | "switch";
    step?: string;
    suffix?: string;
  }> = [
    { key: "loanPeriodDays", label: "Loan Period (Days)", type: "number" },
    { key: "maxBooksPerUser", label: "Max Books per User", type: "number" },
    { key: "renewalLimit", label: "Renewal Limit", type: "number" },
    { key: "reservationDays", label: "Reservation Hold (Days)", type: "number" },
    { key: "finePerDay", label: `Fine per Day (${currency.symbol})`, type: "number", step: "0.01" },
    { key: "gracePeriodDays", label: "Grace Period (Days)", type: "number" },
    { key: "maxFineCap", label: `Max Fine Cap (${currency.symbol})`, type: "number", step: "0.01" },
    { key: "allowRenewals", label: "Allow Renewals", type: "switch" },
    { key: "enableLateFines", label: "Enable Late Fines", type: "switch" },
  ];

  const placeholderFor = (k: keyof CirculationPolicy) => {
    const g = globalDefaults?.[k];
    if (g === undefined || g === null) return "Default";
    return `Default: ${g}`;
  };

  const setNum = (k: keyof CirculationPolicy, v: string) => {
    setOverrides((o) => {
      const next = { ...o };
      if (v === "") delete (next as any)[k];
      else (next as any)[k] = Number(v);
      return next;
    });
  };

  const setBoolOverride = (k: keyof CirculationPolicy, hasOverride: boolean, value: boolean) => {
    setOverrides((o) => {
      const next = { ...o };
      if (!hasOverride) delete (next as any)[k];
      else (next as any)[k] = value;
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Library Policy Overrides
        </CardTitle>
        <CardDescription>
          Leave a field blank to inherit the global default. Filled values override the system-wide policy for this library only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.filter(f => f.type === "number").map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={`lib-pol-${f.key}`}>{f.label}</Label>
              <Input
                id={`lib-pol-${f.key}`}
                type="number"
                min={0}
                step={f.step}
                placeholder={placeholderFor(f.key)}
                value={overrides[f.key] === undefined || overrides[f.key] === null ? "" : String(overrides[f.key])}
                onChange={(e) => setNum(f.key, e.target.value)}
                disabled={!canEdit}
                data-testid={`input-lib-policy-${f.key}`}
              />
            </div>
          ))}
        </div>
        <Separator />
        {fields.filter(f => f.type === "switch").map((f) => {
          const hasOverride = overrides[f.key] !== undefined && overrides[f.key] !== null;
          const effective = hasOverride ? Boolean(overrides[f.key]) : Boolean(globalDefaults?.[f.key]);
          return (
            <div key={f.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{f.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {hasOverride ? "Overriding global default" : `Inheriting global default (${String(globalDefaults?.[f.key] ?? "off")})`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hasOverride}
                    onChange={(e) => setBoolOverride(f.key, e.target.checked, effective)}
                    disabled={!canEdit}
                    data-testid={`check-override-${f.key}`}
                  />
                  Override
                </label>
                <Switch
                  checked={effective}
                  onCheckedChange={(c) => setBoolOverride(f.key, true, c)}
                  disabled={!canEdit || !hasOverride}
                  data-testid={`switch-lib-policy-${f.key}`}
                />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between items-center pt-2 gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((s) => !s)}
            data-testid="button-toggle-library-policy-history"
          >
            {showHistory ? "Hide" : "View"} policy history ({history?.length ?? 0})
          </Button>
          {canEdit && (
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={mutation.isPending}
              data-testid="button-save-library-policy"
            >
              Save Overrides…
            </Button>
          )}
        </div>
        {showHistory && (
          <div className="pt-2">
            <PolicyHistoryList versions={(history || []) as any} currencySymbol={currency.symbol} />
          </div>
        )}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">Only system admins can edit policy overrides.</p>
        )}
      </CardContent>
      <PolicyChangeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save Library Policy Overrides"
        description="Record a new version of this library's policy overrides. A reason is required and will be saved to the audit log."
        isSubmitting={mutation.isPending}
        onConfirm={({ reason, effectiveFrom }) => mutation.mutate({ policy: overrides, reason, effectiveFrom })}
      />
    </Card>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function LibraryDashboardPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = parseInt(params.libraryId || "0");

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ["library-dashboard", libraryId],
    queryFn: () => librariesApi.getDashboard(libraryId),
    enabled: libraryId > 0,
  });

  return (
    <MainLayout>
      <div className="flex-1 space-y-6 p-8 overflow-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/organizations">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-library-name">
                {dashboard?.libraryName || "Library Dashboard"}
              </h1>
              {dashboard && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">{dashboard.libraryCode}</Badge>
                  {dashboard.orgUnitName && (
                    <span className="text-sm">{dashboard.orgUnitName}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Link href={`/organizations/libraries/${libraryId}/resources`}>
            <Button data-testid="button-view-resources">
              <Book className="h-4 w-4 mr-2" />
              View Resources
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground" data-testid="loading-state">
            Loading dashboard...
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span data-testid="error-message">Failed to load library dashboard. Please try again.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {dashboard && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Collection"
                value={dashboard.totalCopies}
                description="Total items in library"
                icon={Library}
                testId="metric-total-copies"
              />
              <MetricCard
                title="Physical Books"
                value={dashboard.physicalBooks}
                icon={Book}
                testId="metric-physical-books"
              />
              <MetricCard
                title="E-Books"
                value={dashboard.ebooks}
                icon={BookOpen}
                testId="metric-ebooks"
              />
              <MetricCard
                title="Audiobooks"
                value={dashboard.audiobooks}
                icon={Headphones}
                testId="metric-audiobooks"
              />
            </div>

            <Separator />

            <div>
              <h2 className="text-xl font-semibold mb-4">Inventory Status</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MetricCard
                  title="Available"
                  value={dashboard.availableCopies}
                  icon={CheckCircle2}
                  variant="success"
                  testId="metric-available"
                />
                <MetricCard
                  title="Checked Out"
                  value={dashboard.checkedOutCopies}
                  icon={BookX}
                  variant="info"
                  testId="metric-checked-out"
                />
                <MetricCard
                  title="Reserved"
                  value={dashboard.reservedCopies}
                  icon={Clock}
                  variant="info"
                  testId="metric-reserved"
                />
                <MetricCard
                  title="In Transit"
                  value={dashboard.inTransitCopies}
                  icon={Truck}
                  testId="metric-in-transit"
                />
                <MetricCard
                  title="Lost"
                  value={dashboard.lostCopies}
                  icon={AlertTriangle}
                  variant={dashboard.lostCopies > 0 ? "danger" : "default"}
                  testId="metric-lost"
                />
                <MetricCard
                  title="Damaged"
                  value={dashboard.damagedCopies}
                  icon={AlertTriangle}
                  variant={dashboard.damagedCopies > 0 ? "warning" : "default"}
                  testId="metric-damaged"
                />
              </div>
            </div>

            <LibraryManagersSection libraryId={libraryId} />

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Circulation
                  </CardTitle>
                  <CardDescription>
                    Current circulation activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Active Checkouts</span>
                    <Badge variant="secondary" data-testid="metric-active-circulations">
                      {dashboard.activeCirculations}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Overdue Items</span>
                    <Badge 
                      variant={dashboard.overdueItems > 0 ? "destructive" : "secondary"} 
                      data-testid="metric-overdue"
                    >
                      {dashboard.overdueItems}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Fines Summary
                  </CardTitle>
                  <CardDescription>
                    Outstanding and collected fines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-700">Outstanding</span>
                    <Badge variant="destructive" data-testid="metric-fines-outstanding">
                      {formatCurrency(dashboard.totalFinesOutstanding)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">Paid</span>
                    <Badge className="bg-green-100 text-green-800" data-testid="metric-fines-paid">
                      {formatCurrency(dashboard.totalFinesPaid)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Waived</span>
                    <Badge variant="secondary" data-testid="metric-fines-waived">
                      {formatCurrency(dashboard.totalFinesWaived)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <LibraryPoliciesCard libraryId={libraryId} />

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Pending Transfers
                  </CardTitle>
                  <CardDescription>
                    Inter-library book transfers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">Incoming</span>
                    </div>
                    <Badge variant="secondary" data-testid="metric-transfers-in">
                      {dashboard.pendingTransfersIn}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-700">Outgoing</span>
                    </div>
                    <Badge variant="secondary" data-testid="metric-transfers-out">
                      {dashboard.pendingTransfersOut}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members
                  </CardTitle>
                  <CardDescription>
                    Active library members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Total Members</span>
                    <Badge variant="secondary" data-testid="metric-members">
                      {dashboard.totalMembers}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function LibraryManagersSection({ libraryId }: { libraryId: number }) {
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['library-staff', libraryId],
    queryFn: () => librariesApi.getStaff(libraryId),
    enabled: libraryId > 0,
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Library Managers
        </CardTitle>
        <CardDescription>
          Staff members managing this library
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading staff...</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No managers assigned to this library yet.</p>
        ) : (
          <div className="space-y-3">
            {staff.map((member) => (
              <div 
                key={member.id} 
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
                data-testid={`staff-member-${member.userId}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium" data-testid={`staff-name-${member.userId}`}>
                      {member.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <Badge 
                  variant={member.role === 'Library Admin' ? 'default' : 'secondary'}
                  data-testid={`staff-role-${member.userId}`}
                >
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
