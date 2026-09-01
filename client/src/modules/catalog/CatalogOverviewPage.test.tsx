import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import CatalogOverviewPage from "./CatalogOverviewPage";
import { booksApi, statsApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  booksApi: {
    getAll: vi.fn(),
    delete: vi.fn(),
  },
  statsApi: {
    getDashboard: vi.fn(),
  },
  circulationReportApi: {
    get: vi.fn(),
  },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/SearchAttributesFilter", () => ({
  SearchAttributesFilter: () => null,
}));

vi.mock("./CatalogPage", () => ({
  BookDetailsSheet: () => null,
  EditBookDialog: () => null,
  CatalogAnalyticsDialog: ({ open }: { open: boolean }) => open ? <div data-testid="catalog-analytics-dialog">Analytics</div> : null,
}));

vi.mock("./MarcEditor", () => ({
  MarcEditor: () => null,
}));

const mockedGetBooks = vi.mocked(booksApi.getAll);
const mockedGetStats = vi.mocked(statsApi.getDashboard);

const book = {
  id: 1,
  isbn: "9781250247100",
  title: "The Dichotomy of Leadership",
  author: "Jocko Willink",
  publisher: "Pan Macmillan",
  publishedYear: 2018,
  category: "Soft Skills",
  resourceTypeId: 1,
  format: "PHYSICAL",
  status: "AVAILABLE",
  coverUrl: null,
  shelfLocation: null,
  marcRecord: null,
  acquisitionDate: null,
  unitPrice: null,
  createdAt: new Date("2026-01-01"),
  searchAttributes: [],
} as any;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/catalog", vi.fn()]}>
        <CatalogOverviewPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("CatalogOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetBooks.mockResolvedValue([book]);
    mockedGetStats.mockResolvedValue({
      totalBooks: 1,
      availableBooks: 1,
      checkedOutBooks: 0,
      activeMembers: 1,
      activeCirculation: 0,
      overdueItems: 0,
      totalFines: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("presents the catalog as one overview without permanent MARC or Z39.50 tabs", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTestId("text-catalog-title")).toHaveTextContent("Catalog overview");
    expect(screen.getByRole("button", { name: /open catalog analytics/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /marc editor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /z39\.50 search/i })).not.toBeInTheDocument();
    await user.click(screen.getByTestId("button-actions-1"));
    expect(screen.getByTestId("button-marc-1")).toHaveTextContent("View MARC record");
  });

  it("opens analytics from the module action", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /open catalog analytics/i }));

    expect(screen.getByTestId("catalog-analytics-dialog")).toBeInTheDocument();
  });
});