import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { librariesApi, type LibraryDashboardStats } from "@/lib/api";
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
