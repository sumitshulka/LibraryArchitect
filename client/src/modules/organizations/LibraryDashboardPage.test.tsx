import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router } from "wouter";
import { LibraryDashboardPage } from "./LibraryDashboardPage";

const authState = vi.hoisted(() => ({
  user: { id: 1, name: "Test Admin", role: "ADMIN" },
}));

const apiMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getById: vi.fn(),
  getStaff: vi.fn(),
  update: vi.fn(),
  getPolicy: vi.fn(),
  history: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({ currency: { code: "INR", symbol: "₹" } }),
}));

vi.mock("@/lib/api", () => ({
  librariesApi: {
    getDashboard: apiMocks.getDashboard,
    getById: apiMocks.getById,
    getStaff: apiMocks.getStaff,
    update: apiMocks.update,
  },
  circulationPolicyApi: {
    get: apiMocks.getPolicy,
    history: apiMocks.history,
  },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const dashboard = {
  libraryName: "Central Library",
  libraryCode: "LIB-1",
  orgUnitName: "University",
  totalCopies: 10,
  physicalBooks: 8,
  ebooks: 1,
  audiobooks: 1,
  availableCopies: 8,
  checkedOutCopies: 2,
  reservedCopies: 0,
  inTransitCopies: 0,
  lostCopies: 0,
  damagedCopies: 0,
  activeCirculations: 2,
  overdueItems: 0,
  totalFinesOutstanding: 0,
  totalFinesPaid: 0,
  totalFinesWaived: 0,
  pendingTransfersIn: 0,
  pendingTransfersOut: 0,
  totalMembers: 5,
};

const library = {
  id: 1,
  name: "Central Library",
  code: "LIB-1",
  orgUnitId: 1,
  address: null,
  contactEmail: null,
  contactPhone: null,
  openingHours: null,
  isActive: true,
  isMainLibrary: false,
  policies: { loanPeriodDays: 21 },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/organizations/libraries/1", vi.fn()]}>
        <Route path="/organizations/libraries/:libraryId">
          <LibraryDashboardPage />
        </Route>
      </Router>
    </QueryClientProvider>,
  );
}

describe("LibraryDashboardPage policy overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 1, name: "Test Admin", role: "ADMIN" };
    apiMocks.getDashboard.mockResolvedValue(dashboard);
    apiMocks.getById.mockResolvedValue(library);
    apiMocks.getStaff.mockResolvedValue([]);
    apiMocks.getPolicy.mockResolvedValue({
      loanPeriodDays: 14,
      maxBooksPerUser: 4,
      renewalLimit: 2,
      reservationDays: 2,
      finePerDay: 10,
      gracePeriodDays: 1,
      maxFineCap: 200,
      allowRenewals: true,
      enableLateFines: true,
    });
    apiMocks.history.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps admins in view mode until the edit icon is clicked", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("value-lib-policy-loanPeriodDays")).toHaveTextContent("21");
    });
    expect(screen.getByTestId("button-edit-library-policy")).toBeInTheDocument();
    expect(screen.queryByTestId("input-lib-policy-loanPeriodDays")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("button-edit-library-policy"));

    expect(screen.getByTestId("input-lib-policy-loanPeriodDays")).toHaveValue(21);
    expect(screen.getByTestId("button-save-library-policy")).toBeInTheDocument();
    expect(screen.getByTestId("button-cancel-library-policy-edit")).toBeInTheDocument();

    apiMocks.update.mockResolvedValue(library);
    await userEvent.click(screen.getByTestId("button-save-library-policy"));
    await userEvent.type(
      screen.getByTestId("textarea-policy-reason"),
      "Board approved new loan period",
    );
    await userEvent.click(screen.getByTestId("button-policy-confirm"));

    await waitFor(() => expect(apiMocks.update).toHaveBeenCalledTimes(1));
    expect(apiMocks.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        policies: expect.objectContaining({ loanPeriodDays: 21 }),
        policyReason: "Board approved new loan period",
        policyEffectiveFrom: expect.any(String),
      }),
    );
  });

  it("keeps librarians in view-only mode without an edit action", async () => {
    authState.user = { id: 2, name: "Test Librarian", role: "LIBRARIAN" };

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("value-lib-policy-loanPeriodDays")).toHaveTextContent("21");
    });
    expect(screen.queryByTestId("button-edit-library-policy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-lib-policy-loanPeriodDays")).not.toBeInTheDocument();
    expect(screen.getByText("View only. Only system admins can edit policy overrides.")).toBeInTheDocument();
  });
});