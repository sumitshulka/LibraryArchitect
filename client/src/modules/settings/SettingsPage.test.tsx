import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import SettingsPage from "./SettingsPage";
import {
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

function renderSettings(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router
        hook={() => [path, vi.fn()]}
        searchHook={() => path.slice(path.indexOf("?"))}
      >
        <SettingsPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCategories.mockResolvedValue([]);
    mockedGetConfig.mockResolvedValue([]);
    mockedGetResourceTypes.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
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
    renderSettings("/settings");

    await user.click(
      await screen.findByRole("tab", { name: "Catalog Settings" }),
    );

    expect(
      screen.getByRole("tab", { name: "Catalog Settings" }),
    ).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Resource Types", { exact: true })).toBeInTheDocument();
  });
});