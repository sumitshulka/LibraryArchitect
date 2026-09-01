import { useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { Library, BookOpen, LayoutDashboard } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { librariesApi, orgUnitsApi } from "@/lib/api";

export default function LibrariesPage() {
  const {
    data: libraries = [],
    isLoading: loadingLibraries,
    error,
    refetch: refetchLibraries,
  } = useQuery({
    queryKey: ["libraries"],
    queryFn: librariesApi.getAll,
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {libraries.map((library) => {
                      const orgUnit = orgUnits.find((unit) => unit.id === library.orgUnitId);

                      return (
                        <TableRow key={library.id} data-testid={`row-library-${library.id}`}>
                          <TableCell className="font-mono text-sm">{library.code}</TableCell>
                          <TableCell>
                            <Link
                              href={`/organizations/libraries/${library.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                              data-testid={`link-library-name-${library.id}`}
                            >
                              {library.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {orgUnit?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={library.isActive ? "default" : "secondary"}
                              className={library.isActive ? "bg-green-100 text-green-800" : ""}
                            >
                              {library.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/organizations/libraries/${library.id}/resources`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View Resources"
                                data-testid={`button-library-resources-${library.id}`}
                              >
                                <BookOpen className="h-4 w-4 text-green-600" />
                              </Button>
                            </Link>
                            <Link href={`/organizations/libraries/${library.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View Dashboard"
                                data-testid={`button-library-dashboard-${library.id}`}
                              >
                                <LayoutDashboard className="h-4 w-4 text-blue-500" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}