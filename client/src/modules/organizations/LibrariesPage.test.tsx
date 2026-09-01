import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import type { Library, OrgUnit } from "@shared/schema";
import LibrariesPage from "./LibrariesPage";
import { librariesApi, orgUnitsApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  librariesApi: {
    getAll: vi.fn(),
  },
  orgUnitsApi: {
    getAll: vi.fn(),
  },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockedGetLibraries = vi.mocked(librariesApi.getAll);
const mockedGetOrgUnits = vi.mocked(orgUnitsApi.getAll);
const navigate = vi.fn();

function makeLibrary(id: number, name = `Library ${id}`): Library {
  return {
    id,
    name,
    code: `LIB-${id}`,
    orgUnitId: id,
    address: null,
    contactEmail: null,
    contactPhone: null,
    openingHours: null,
    isActive: true,
    isMainLibrary: false,
    policies: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function makeOrgUnit(id: number): OrgUnit {
  return {
    id,
    name: `Organization ${id}`,
    code: `ORG-${id}`,
    type: "UNIVERSITY",
    parentId: null,
    description: null,
    address: null,
    contactEmail: null,
    contactPhone: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/libraries", navigate]}>
        <LibrariesPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("LibrariesPage landing behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetOrgUnits.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects directly to the dashboard when exactly one library is available", async () => {
    mockedGetLibraries.mockResolvedValue([makeLibrary(7)]);

    renderPage();

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate.mock.calls[0][0]).toBe("/organizations/libraries/7");
    expect(screen.queryByTestId("text-page-title")).not.toBeInTheDocument();
    expect(mockedGetOrgUnits).not.toHaveBeenCalled();
  });

  it("renders the Libraries Summary list when multiple libraries are available", async () => {
    mockedGetLibraries.mockResolvedValue([
      makeLibrary(1, "Central Library"),
      makeLibrary(2, "Science Library"),
    ]);
    mockedGetOrgUnits.mockResolvedValue([makeOrgUnit(1), makeOrgUnit(2)]);

    renderPage();

    expect(await screen.findByTestId("row-library-1")).toBeInTheDocument();
    expect(screen.getByText("Central Library")).toBeInTheDocument();
    expect(screen.getByText("Science Library")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Central Library" })).toHaveAttribute(
      "href",
      "/organizations/libraries/1",
    );
    expect(screen.getByText("Organization 1")).toBeInTheDocument();
    expect(screen.getByTestId("row-library-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-library-2")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps the empty state visible with a link to library configuration", async () => {
    mockedGetLibraries.mockResolvedValue([]);

    renderPage();

    const emptyState = await screen.findByTestId("empty-libraries");
    expect(emptyState).toHaveTextContent("No libraries configured.");
    expect(screen.getByRole("link", { name: "Configure libraries" })).toHaveAttribute(
      "href",
      "/organizations",
    );
  });

  it("keeps the failed state visible and retries library loading", async () => {
    mockedGetLibraries.mockRejectedValue(new Error("network error"));

    renderPage();

    expect(await screen.findByTestId("error-libraries")).toHaveTextContent(
      "Failed to load libraries.",
    );
    await userEvent.click(screen.getByTestId("button-retry-libraries"));

    await waitFor(() => expect(mockedGetLibraries).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("error-libraries")).toBeInTheDocument();
  });
});