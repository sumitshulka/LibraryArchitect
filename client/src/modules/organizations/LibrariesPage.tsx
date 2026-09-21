import { useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import {
  BookOpen,
  Building2,
  FileText,
  LayoutDashboard,
  Library,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { librariesApi, orgUnitsApi } from "@/lib/api";

export default function LibrariesPage() {
  const {
    data: libraries = [],
    isLoading: loadingLibraries,
    error,
    refetch: refetchLibraries,
  } = useQuery({
    queryKey: ["library-summaries"],
    queryFn: librariesApi.getSummaries,
  });

  const {
    data: orgUnits = [],
    isLoading: loadingOrgUnits,
    error: orgUnitsError,
    refetch: refetchOrgUnits,
  } = useQuery({
    queryKey: ["org-units"],
    queryFn: orgUnitsApi.getAll,
    enabled: libraries.length > 1,
  });

  if (!loadingLibraries && !error && libraries.length === 1) {
    return <Redirect to={`/organizations/libraries/${libraries[0].id}`} />;
  }

  const isLoading = loadingLibraries || (libraries.length > 1 && loadingOrgUnits);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Libraries
          </h1>
          <p className="text-muted-foreground">
            Access library dashboards and resources across your organization.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Libraries Summary
            </CardTitle>
            <CardDescription>
              Choose a library to view its dashboard or resources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-libraries">
                Loading libraries...
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive" data-testid="error-libraries">
                <p>Failed to load libraries.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => void refetchLibraries()}
                  data-testid="button-retry-libraries"
                >
                  Try again
                </Button>
              </div>
            ) : libraries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-libraries">
                <p>No libraries configured.</p>
                <Link href="/organizations">
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    data-testid="button-configure-libraries"
                  >
                    Configure libraries
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {orgUnitsError && (
                  <div className="mb-4 flex items-center justify-between gap-4 text-sm text-destructive" data-testid="error-org-units">
                    <span>Organization details could not be loaded.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void refetchOrgUnits()}
                      data-testid="button-retry-org-units"
                    >
                      Try again
                    </Button>
                  </div>
                )}
                <div className="grid gap-4 xl:grid-cols-2">
                  {libraries.map((library) => {
                    const orgUnit = orgUnits.find((unit) => unit.id === library.orgUnitId);
                    const managerNames = library.managerNames ?? [];
                    const manager = managerNames.length > 0
                      ? managerNames.join(", ")
                      : "Unassigned";
                    const managerDetail = library.managerRole === "ADMIN"
                      ? managerNames.length > 1 ? "Assigned administrators" : "Assigned administrator"
                      : library.managerRole === "LIBRARIAN"
                        ? managerNames.length > 1 ? "Assigned librarians" : "Assigned librarian"
                        : library.managerRole === "STAFF"
                          ? managerNames.length > 1 ? "Assigned staff members" : "Assigned staff member"
                          : "No librarian or manager assigned";

                    return (
                      <Card key={library.id} className="border-muted" data-testid={`row-library-${library.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-lg">
                                <Link
                                  href={`/organizations/libraries/${library.id}`}
                                  className="text-primary underline-offset-4 hover:underline"
                                  data-testid={`link-library-name-${library.id}`}
                                >
                                  {library.name}
                                </Link>
                              </CardTitle>
                              <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-mono text-xs">{library.code}</span>
                                <span aria-hidden="true">•</span>
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {orgUnit?.name || "No organization"}
                                </span>
                              </CardDescription>
                            </div>
                            <Badge
                              variant={library.isActive ? "default" : "secondary"}
                              className={library.isActive ? "bg-green-100 text-green-800" : ""}
                            >
                              {library.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <SummaryMetric
                              icon={BookOpen}
                              label="Books"
                              value={library.bookCount}
                              detail={`${library.copyCount} ${library.copyCount === 1 ? "copy" : "copies"}`}
                              testId={`summary-library-${library.id}-books`}
                            />
                            <SummaryMetric
                              icon={FileText}
                              label="Digital resources"
                              value={library.digitalResourceCount}
                              detail={library.digitalResourceCount === 0 ? "None attached" : "Attached"}
                              testId={`summary-library-${library.id}-digital-resources`}
                            />
                            <SummaryMetric
                              icon={UserRound}
                              label="Librarian / manager"
                              value={manager}
                              detail={managerDetail}
                              testId={`summary-library-${library.id}-librarian`}
                            />
                            <SummaryMetric
                              icon={Users}
                              label="Library staff"
                              value={library.staffCount}
                              detail={`${library.staffCount === 1 ? "person" : "people"} managed`}
                              testId={`summary-library-${library.id}-staff`}
                            />
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                            <Link href={`/organizations/libraries/${library.id}/resources`}>
                              <Button
                                variant="outline"
                                size="sm"
                                title="View Resources"
                                data-testid={`button-library-resources-${library.id}`}
                              >
                                <BookOpen className="mr-2 h-4 w-4 text-green-600" />
                                Resources
                              </Button>
                            </Link>
                            <Link href={`/organizations/libraries/${library.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                title="View Dashboard"
                                data-testid={`button-library-dashboard-${library.id}`}
                              >
                                <LayoutDashboard className="mr-2 h-4 w-4 text-blue-500" />
                                Dashboard
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  testId: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 p-3" data-testid={testId}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold" title={String(value)}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}