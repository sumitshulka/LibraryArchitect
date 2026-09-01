import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddResourcePage from "./AddResourcePage";
import { booksApi, categoriesApi, resourceTypesApi } from "@/lib/api";
import { toast } from "sonner";

vi.mock("@/lib/api", () => ({
  booksApi: { create: vi.fn() },
  categoriesApi: { getActive: vi.fn() },
  resourceTypesApi: { getActive: vi.fn() },
  z3950Api: { search: vi.fn() },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({
    currency: { symbol: "$" },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ["/catalog/add", vi.fn()],
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(booksApi.create);
const mockedGetCategories = vi.mocked(categoriesApi.getActive);
const mockedGetResourceTypes = vi.mocked(resourceTypesApi.getActive);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AddResourcePage />
    </QueryClientProvider>,
  );
}

async function chooseSelect(testId: string, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(testId));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.type(screen.getByTestId("input-isbn"), "9780132350884");
  await user.type(screen.getByTestId("input-title"), "Effective Testing");
  await user.type(screen.getByTestId("input-author"), "A. Developer");
  await chooseSelect("select-resource-type", "Book");
  await chooseSelect("select-category", "Technology");
}

describe("AddResourcePage catalog creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/catalog/new");
    mockedGetResourceTypes.mockResolvedValue([
      { id: 1, name: "Book", description: null, isActive: true, createdAt: new Date() },
    ]);
    mockedGetCategories.mockResolvedValue([
      { id: 1, name: "Technology", description: null, isActive: true, createdAt: new Date() },
    ]);
    mockedCreate.mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("sends the entered price and copy quantity when creating a resource", async () => {
    const user = userEvent.setup();
    renderPage();

    await fillRequiredFields();
    await user.clear(screen.getByTestId("input-unit-price"));
    await user.type(screen.getByTestId("input-unit-price"), "12.50");
    fireEvent.change(screen.getByTestId("input-quantity"), { target: { value: "3" } });
    await user.click(screen.getByTestId("button-save"));

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({
      isbn: "9780132350884",
      title: "Effective Testing",
      author: "A. Developer",
      category: "Technology",
      resourceTypeId: 1,
      unitPrice: 12.5,
      quantity: 3,
    });
  });

  it("blocks submission when required catalog fields are missing", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("button-save"));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all required fields (ISBN, Title, Author, Category)",
    );
  });

  it("requires a resource type after the other required fields are filled", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("input-isbn"), "9780132350884");
    await user.type(screen.getByTestId("input-title"), "Effective Testing");
    await user.type(screen.getByTestId("input-author"), "A. Developer");
    await chooseSelect("select-category", "Technology");
    await user.click(screen.getByTestId("button-save"));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Please select a resource type");
  });

  it("prefills a live catalog record imported from Settings", async () => {
    window.history.replaceState(
      null,
      "",
      "/catalog/new?source=z3950&isbn=9780132350884&title=A+Live+Catalog+Result&author=A.+Real+Author&publisher=A+Real+Publisher&year=2024&category=Technology",
    );

    renderPage();

    expect(await screen.findByTestId("input-isbn")).toHaveValue("9780132350884");
    expect(screen.getByTestId("input-title")).toHaveValue("A Live Catalog Result");
    expect(screen.getByTestId("input-author")).toHaveValue("A. Real Author");
    expect(screen.getByTestId("input-publisher")).toHaveValue("A Real Publisher");
    expect(screen.getByTestId("input-year")).toHaveValue(2024);
    expect(toast.success).toHaveBeenCalledWith(
      "Live catalog record loaded. Review the details before saving.",
    );
  });
});