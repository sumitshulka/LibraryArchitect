import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import SettingsPage from "./SettingsPage";
import {
  bookCopyIdentifiersApi,
  categoriesApi,
  configApi,
  resourceTypesApi,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  categoriesApi: {
    getAll: vi.fn(),
  },
  configApi: {
    getAll: vi.fn(),
    set: vi.fn(),
  },
  resourceTypesApi: {
    getAll: vi.fn(),
  },
  erpIntegrationsApi: {},
  paymentMethodsApi: {},
  resourceTypeSettingsApi: {},
  circulationPolicyApi: {},
  fineCalculationModeApi: {},
  bookCopyIdentifiersApi: {
    audit: vi.fn(),
    history: vi.fn(),
    remediate: vi.fn(),
  },
}));

const { authState } = vi.hoisted(() => ({
  authState: {
    user: {
      id: 1,
      username: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      category: "STAFF",
      isLocalUser: true,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({
    currency: { code: "USD", symbol: "$" },
    format: (amount: number) => `$${amount}`,
  }),
}));

vi.mock("@/modules/catalog/Z3950Search", () => ({
  Z3950Search: () => <div data-testid="z3950-search" />,
}));

const mockedGetCategories = vi.mocked(categoriesApi.getAll);
const mockedGetConfig = vi.mocked(configApi.getAll);
const mockedGetResourceTypes = vi.mocked(resourceTypesApi.getAll);
const mockedAuditIdentifiers = vi.mocked(bookCopyIdentifiersApi.audit);
const mockedIdentifierHistory = vi.mocked(bookCopyIdentifiersApi.history);
const mockedRemediateIdentifier = vi.mocked(bookCopyIdentifiersApi.remediate);

function renderSettings(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const setLocation = vi.fn();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <Router
        hook={() => [path, setLocation]}
        searchHook={() => path.slice(path.indexOf("?"))}
      >
        <SettingsPage />
      </Router>
    </QueryClientProvider>,
  );

  return { ...view, setLocation };
}

function renderSettingsWithBrowserHistory(path: string) {
  window.history.replaceState(null, "", path);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <SettingsPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user.role = "ADMIN";
    authState.user.isLocalUser = true;
    mockedGetCategories.mockResolvedValue([]);
    mockedGetConfig.mockResolvedValue([]);
    mockedGetResourceTypes.mockResolvedValue([]);
    mockedAuditIdentifiers.mockResolvedValue({
      collisions: [],
      collisionCount: 0,
      affectedCopyIds: [],
    });
    mockedIdentifierHistory.mockResolvedValue([]);
    mockedRemediateIdentifier.mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("selects Catalog Settings when opened with the catalog section query", async () => {
    renderSettings("/settings?section=catalog");

    expect(await screen.findByText("Resource Types", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Catalog Settings" }),
    ).toHaveAttribute("data-state", "active");
    expect(
      screen.getByRole("tab", { name: "General" }),
    ).toHaveAttribute("data-state", "inactive");
  });

  it("keeps General selected when opened without a section query", async () => {
    renderSettings("/settings");

    expect(await screen.findByText("Library Information", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "General" }),
    ).toHaveAttribute("data-state", "active");
    expect(
      screen.getByRole("tab", { name: "Catalog Settings" }),
    ).toHaveAttribute("data-state", "inactive");
  });

  it("still switches settings tabs normally", async () => {
    const user = userEvent.setup();
    const { setLocation } = renderSettings("/settings");

    await user.click(
      await screen.findByRole("tab", { name: "Catalog Settings" }),
    );

    expect(
      screen.getByRole("tab", { name: "Catalog Settings" }),
    ).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Resource Types", { exact: true })).toBeInTheDocument();
    expect(setLocation.mock.calls[0]?.[0]).toBe("/settings?section=catalog");
  });

  it("opens any selected settings section from its query", async () => {
    renderSettings("/settings?section=digital-resources");

    expect(await screen.findByRole("tab", { name: "Digital Resources" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("data-state", "inactive");
  });

  it("falls back to General settings for an unsupported section query", async () => {
    renderSettingsWithBrowserHistory("/settings?section=unknown");

    expect(await screen.findByText("Library Information", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "Catalog Settings" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    expect(window.location.pathname + window.location.search).toBe(
      "/settings?section=unknown",
    );
  });

  it("restores settings tabs and content through browser back and forward navigation", async () => {
    const user = userEvent.setup();
    renderSettingsWithBrowserHistory("/settings");

    expect(await screen.findByText("Library Information", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "data-state",
      "active",
    );

    await user.click(screen.getByRole("tab", { name: "Catalog Settings" }));

    expect(window.location.pathname + window.location.search).toBe(
      "/settings?section=catalog",
    );
    expect(screen.getByRole("tab", { name: "Catalog Settings" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText("Resource Types", { exact: true })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe("/settings");
      expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
        "data-state",
        "active",
      );
      expect(screen.getByText("Library Information", { exact: true })).toBeInTheDocument();
    });

    window.history.forward();
    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe(
        "/settings?section=catalog",
      );
      expect(screen.getByRole("tab", { name: "Catalog Settings" })).toHaveAttribute(
        "data-state",
        "active",
      );
      expect(screen.getByText("Resource Types", { exact: true })).toBeInTheDocument();
    });
  });

  it.each([
    ["a librarian", "LIBRARIAN", true],
    ["a remote administrator", "ADMIN", false],
  ])("hides the identifier collision panel from %s", async (_label, role, isLocalUser) => {
    authState.user.role = role;
    authState.user.isLocalUser = isLocalUser;

    renderSettings("/settings?section=catalog");

    expect(await screen.findByText("Resource Types", { exact: true })).toBeInTheDocument();
    expect(screen.queryByTestId("card-book-copy-identifier-audit")).not.toBeInTheDocument();
    expect(screen.queryByText("Identifier collisions", { exact: true })).not.toBeInTheDocument();
    expect(mockedAuditIdentifiers).not.toHaveBeenCalled();
    expect(mockedIdentifierHistory).not.toHaveBeenCalled();
  });

  it("shows collision occurrences and submits a safe clear or replacement", async () => {
    const user = userEvent.setup();
    mockedAuditIdentifiers.mockResolvedValue({
      collisionCount: 1,
      affectedCopyIds: [101, 102],
      collisions: [{
        identifier: "shared-id",
        copyIds: [101, 102],
        occurrences: [
          { copyId: 101, field: "barcode", value: "shared-id" },
          { copyId: 102, field: "internalSSN", value: "SHARED-ID" },
        ],
      }],
    });

    renderSettings("/settings?section=catalog");

    expect((await screen.findAllByText("Stored value:", { exact: false })).length).toBe(2);
    expect(screen.getByText("Copies 101, 102")).toBeInTheDocument();
    expect(screen.getByText("SHARED-ID")).toBeInTheDocument();

    await user.click(screen.getByTestId("button-clear-identifier-102-internalSSN"));
    await waitFor(() => {
      expect(mockedRemediateIdentifier).toHaveBeenCalledWith({
        copyId: 102,
        field: "internalSSN",
        expectedValue: "SHARED-ID",
        replacement: null,
      });
    });

    const replacementInput = screen.getByRole("textbox", {
      name: "Replacement for Barcode on copy 101",
    });
    await user.clear(replacementInput);
    await user.type(replacementInput, "new-barcode");
    await user.click(screen.getByTestId("button-replace-identifier-101-barcode"));

    await waitFor(() => {
      expect(mockedRemediateIdentifier).toHaveBeenCalledWith({
        copyId: 101,
        field: "barcode",
        expectedValue: "shared-id",
        replacement: "new-barcode",
      });
    });
  });

  it("shows identifier remediation history after collisions are cleared", async () => {
    mockedIdentifierHistory.mockResolvedValue([{
      id: 7,
      copyId: 102,
      field: "internalSSN",
      previousValue: "SHARED-ID",
      replacement: null,
      actor: "Admin",
      actorId: 1,
      timestamp: "2026-09-15T12:34:56.000Z",
    }]);

    renderSettings("/settings?section=catalog");

    expect(await screen.findByTestId("identifier-remediation-event-7")).toHaveTextContent("102");
    expect(screen.getByTestId("identifier-remediation-event-7")).toHaveTextContent("Internal SSN");
    expect(screen.getByTestId("identifier-remediation-event-7")).toHaveTextContent("SHARED-ID");
    expect(screen.getByTestId("identifier-remediation-event-7")).toHaveTextContent("(cleared)");
    expect(screen.getByTestId("identifier-remediation-event-7")).toHaveTextContent("Admin");
  });

  it("explains identifier conflicts and stale audits", async () => {
    const user = userEvent.setup();
    mockedAuditIdentifiers.mockResolvedValue({
      collisionCount: 1,
      affectedCopyIds: [101, 102],
      collisions: [{
        identifier: "shared-id",
        copyIds: [101, 102],
        occurrences: [
          { copyId: 101, field: "barcode", value: "shared-id" },
          { copyId: 102, field: "userDefinedSSN", value: "SHARED-ID" },
        ],
      }],
    });
    mockedRemediateIdentifier.mockRejectedValueOnce(Object.assign(
      new Error("Replacement identifier is already used by another copy"),
      { code: "IDENTIFIER_CONFLICT", conflictingCopyIds: [203] },
    ));

    renderSettings("/settings?section=catalog");
    await screen.findAllByText("Stored value:", { exact: false });

    await user.click(screen.getByTestId("button-replace-identifier-101-barcode"));

    expect(await screen.findByTestId("alert-identifier-conflict")).toHaveTextContent(
      "already used by another copy",
    );
    expect(screen.getByTestId("alert-identifier-conflict")).toHaveTextContent("203");

    mockedRemediateIdentifier.mockRejectedValueOnce(Object.assign(
      new Error("Book copy changed since the audit"),
      { code: "STALE_AUDIT" },
    ));
    await user.click(screen.getByTestId("button-replace-identifier-101-barcode"));

    expect(await screen.findByTestId("alert-identifier-stale")).toHaveTextContent(
      "Audit is out of date",
    );
  });
});