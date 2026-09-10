import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import SearchAttributesPage from "./SearchAttributesPage";
import { booksApi, digitalResourcesApi, searchAttributesApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  booksApi: { getAll: vi.fn() },
  digitalResourcesApi: { getAll: vi.fn() },
  searchAttributesApi: {
    getTypes: vi.fn(),
    createType: vi.fn(),
    createValue: vi.fn(),
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/catalog/search-attributes", vi.fn()]}>
        <SearchAttributesPage />
      </Router>
    </QueryClientProvider>,
  );
}

describe("SearchAttributesPage bulk assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTypes.mockResolvedValue(types);
    mockedGetBooks.mockResolvedValue([
      { id: 1, title: "Algorithms", author: "A. Author", isbn: "111" },
      { id: 2, title: "Databases", author: "B. Author", isbn: "222" },
    ] as any);
    mockedGetDigitalResources.mockResolvedValue([
      { id: 3, title: "Library Orientation", author: "Library Team", subject: "Welcome" },
    ] as any);
    mockedBulkAssign.mockResolvedValue({ booksUpdated: 1, digitalResourcesUpdated: 1 });
  });

  afterEach(() => cleanup());

  it("selects attribute values, books, and digital resources independently", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("button-bulk-assign-attributes"));
    expect(await screen.findByRole("heading", { name: "Bulk Assign Attributes" })).toBeInTheDocument();

    await user.click(screen.getByTestId("checkbox-bulk-attribute-10"));
    await user.click(screen.getByTestId("checkbox-book-1"));
    await user.click(screen.getByTestId("checkbox-digital-resource-3"));

    expect(screen.getByText("1 attribute values · 1 books · 1 digital resources selected")).toBeInTheDocument();
    expect(screen.getByText("Replace existing search attributes for the selected books and digital resources.")).toBeInTheDocument();
  });

  it("supports selecting all visible targets and submits both target types", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("button-bulk-assign-attributes"));
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