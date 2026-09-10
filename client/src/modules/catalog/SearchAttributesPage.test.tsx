import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import SearchAttributesPage, { BulkAssignAttributesPage } from "./SearchAttributesPage";
import { booksApi, digitalResourcesApi, searchAttributesApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  booksApi: { getAll: vi.fn() },
  digitalResourcesApi: { getAll: vi.fn() },
  searchAttributesApi: {
    getTypes: vi.fn(),
    createType: vi.fn(),
    createValue: vi.fn(),
    createValues: vi.fn(),
    updateType: vi.fn(),
    deleteValue: vi.fn(),
    deleteType: vi.fn(),
    bulkAssign: vi.fn(),
  },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockedGetTypes = vi.mocked(searchAttributesApi.getTypes);
const mockedGetBooks = vi.mocked(booksApi.getAll);
const mockedGetDigitalResources = vi.mocked(digitalResourcesApi.getAll);
const mockedBulkAssign = vi.mocked(searchAttributesApi.bulkAssign);
const mockedCreateValues = vi.mocked(searchAttributesApi.createValues);
let navigateSpy: (path: string, ...args: any[]) => any;

const types = [{
  id: 1,
  name: "Program",
  description: null,
  isActive: true,
  sortOrder: 0,
  createdAt: "2026-01-01",
  values: [
    { id: 10, attributeTypeId: 1, value: "Computer Science", isActive: true, sortOrder: 0, createdAt: "2026-01-01" },
    { id: 11, attributeTypeId: 1, value: "Inactive", isActive: false, sortOrder: 1, createdAt: "2026-01-01" },
  ],
}];

function renderPage(path = "/catalog/search-attributes") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [path, navigateSpy]}>
        <SearchAttributesPage />
      </Router>
    </QueryClientProvider>,
  );
}

function renderBulkPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/catalog/search-attributes/bulk-assign", navigateSpy]}>
        <BulkAssignAttributesPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("SearchAttributesPage bulk assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateSpy = vi.fn();
    mockedGetTypes.mockResolvedValue(types);
    mockedGetBooks.mockResolvedValue([
      { id: 1, title: "Algorithms", author: "A. Author", isbn: "111" },
      { id: 2, title: "Databases", author: "B. Author", isbn: "222" },
    ] as any);
    mockedGetDigitalResources.mockResolvedValue([
      { id: 3, title: "Library Orientation", author: "Library Team", subject: "Welcome" },
    ] as any);
    mockedBulkAssign.mockResolvedValue({ booksUpdated: 1, digitalResourcesUpdated: 1 });
    mockedCreateValues.mockResolvedValue({ createdCount: 2, skippedCount: 0, values: [] });
  });

  afterEach(() => cleanup());

  it("navigates to the dedicated bulk assignment page", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("button-bulk-assign-attributes"));
    expect(navigateSpy).toHaveBeenCalledWith("/catalog/search-attributes/bulk-assign", undefined);
  });

  it("adds multiple attribute values from one value-per-line submission", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId("button-add-multiple-values-1"));
    expect(screen.getByRole("heading", { name: "Add multiple values" })).toBeInTheDocument();
    await user.type(
      screen.getByTestId("textarea-bulk-values-1"),
      "CS101\nCS102\n\nCS101",
    );

    expect(screen.getByText("2 unique values ready to add.")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-save-bulk-values-1"));

    expect(mockedCreateValues).toHaveBeenCalledWith(1, ["CS101", "CS102"]);
  });

  it("filters values by name within each attribute card", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByTestId("input-search-values-1");
    await user.type(searchInput, "computer");

    expect(screen.getByTestId("badge-value-10")).toBeInTheDocument();
    expect(screen.queryByTestId("badge-value-11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 values")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "does-not-exist");

    expect(screen.getByText("No values match your search.")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 2 values")).toBeInTheDocument();
  });

  it("selects targets and shows removable review items on the bulk page", async () => {
    const user = userEvent.setup();
    renderBulkPage();

    expect(await screen.findByRole("heading", { name: "Bulk Assign Attributes" })).toBeInTheDocument();

    await user.click(screen.getByTestId("checkbox-bulk-attribute-10"));
    await user.click(screen.getByTestId("checkbox-book-1"));
    await user.click(screen.getByTestId("checkbox-digital-resource-3"));

    expect(screen.getByTestId("selected-book-1")).toHaveTextContent("Algorithms");
    expect(screen.getByTestId("selected-digital-resource-3")).toHaveTextContent("Library Orientation");
    expect(screen.getByText("1 attribute values · 2 resources selected")).toBeInTheDocument();

    await user.click(screen.getByTestId("selected-book-remove-1"));
    expect(screen.queryByTestId("selected-book-1")).not.toBeInTheDocument();
    expect(screen.getByText("1 attribute values · 1 resources selected")).toBeInTheDocument();
  });

  it("filters bulk assignment attribute values by name", async () => {
    const user = userEvent.setup();
    renderBulkPage();

    const searchInput = await screen.findByTestId("input-search-bulk-attribute-1");
    await user.type(searchInput, "computer");

    expect(screen.getByTestId("checkbox-bulk-attribute-10")).toBeInTheDocument();
    expect(screen.queryByTestId("checkbox-bulk-attribute-11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 active values")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "does-not-exist");

    expect(screen.getByText("No values match your search.")).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 1 active values")).toBeInTheDocument();
  });

  it("supports selecting all visible targets and submits both target types", async () => {
    const user = userEvent.setup();
    renderBulkPage();

    await screen.findByTestId("checkbox-book-1");
    await user.click(screen.getByTestId("checkbox-bulk-attribute-10"));
    await user.click(screen.getByTestId("button-select-all-book"));
    await user.click(screen.getByTestId("button-select-all-digital-resource"));
    await user.click(screen.getByTestId("button-confirm-bulk-assign"));

    expect(mockedBulkAssign).toHaveBeenCalledWith({
      attributeValueIds: [10],
      bookIds: [1, 2],
      digitalResourceIds: [3],
    });
  });
});