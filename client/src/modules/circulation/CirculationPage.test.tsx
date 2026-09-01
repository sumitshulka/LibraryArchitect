import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CirculationPage from "./CirculationPage";
import {
  bookCopiesApi,
  booksApi,
  circulationApi,
  librariesApi,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  bookCopiesApi: { getByBook: vi.fn(), getByBookAndLibrary: vi.fn() },
  booksApi: { getAll: vi.fn() },
  circulationApi: { getAll: vi.fn(), checkout: vi.fn(), returnBook: vi.fn() },
  librariesApi: { getActive: vi.fn() },
  libraryMembershipsApi: { getByUser: vi.fn() },
  reservationsApi: {},
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  return {
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock("./ReturnBookDialog", () => ({
  ReturnBookDialog: () => null,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 99, role: "ADMIN", name: "Admin", email: "admin@example.com" },
  }),
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({
    format: (amount: number) => `$${(amount / 100).toFixed(2)}`,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedGetCopies = vi.mocked(bookCopiesApi.getByBookAndLibrary);
const mockedGetBooks = vi.mocked(booksApi.getAll);
const mockedGetCirculation = vi.mocked(circulationApi.getAll);
const mockedGetLibraries = vi.mocked(librariesApi.getActive);
const mockedCheckout = vi.mocked(circulationApi.checkout);

const member = {
  id: 2,
  name: "Patron Reader",
  username: "patron",
  role: "STUDENT",
  email: "patron@example.com",
  studentId: "S-100",
  employeeId: null,
  department: "History",
  status: "ACTIVE",
};

const book = {
  id: 7,
  isbn: "9780132350884",
  title: "Effective Testing",
  author: "A. Developer",
  publisher: null,
  publishedYear: 2026,
  category: "Technology",
  resourceTypeId: 1,
  format: "PHYSICAL",
  status: "AVAILABLE",
  coverUrl: null,
  shelfLocation: "A-1",
  marcRecord: null,
  acquisitionDate: null,
  unitPrice: null,
  createdAt: new Date(),
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CirculationPage />
    </QueryClientProvider>,
  );
}

describe("CirculationPage checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLibraries.mockResolvedValue([
      {
        id: 3,
        name: "Central Library",
        code: "CENTRAL",
        orgUnitId: 1,
        address: null,
        contactEmail: null,
        contactPhone: null,
        openingHours: null,
        isActive: true,
        isMainLibrary: true,
        policies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockedGetBooks.mockResolvedValue([book] as never);
    mockedGetCirculation.mockResolvedValue([]);
    mockedGetCopies.mockResolvedValue([
      {
        id: 8,
        bookId: 7,
        libraryId: 3,
        barcode: "BC-8",
        internalSSN: "SSN-8",
        userDefinedSSN: null,
        callNumber: null,
        shelfLocation: "A-1",
        status: "AVAILABLE",
        condition: "GOOD",
        acquisitionDate: null,
        acquisitionSource: null,
        price: null,
        notes: null,
        allocatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
    mockedCheckout.mockResolvedValue({ id: 12 } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/users/search")) {
          return new Response(JSON.stringify({ users: [member], totalCount: 1 }), { status: 200 });
        }
        if (url === "/api/users") {
          return new Response(JSON.stringify([member]), { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps Issue Book disabled until library, member, book, and copy prerequisites are ready", async () => {
    const user = userEvent.setup();
    renderPage();

    const issueButton = screen.getByTestId("button-issue");
    expect(issueButton).toBeDisabled();

    await user.click(screen.getByTestId("select-library"));
    await user.click(await screen.findByRole("option", { name: /Central Library/ }));
    expect(issueButton).toBeDisabled();

    await user.click(screen.getByTestId("input-member-search"));
    await user.click(await screen.findByTestId("button-select-member-2"));
    expect(issueButton).toBeDisabled();

    await user.type(screen.getByTestId("input-isbn"), book.isbn);
    await user.click(screen.getByTestId("button-lookup-isbn"));
    await waitFor(() => expect(mockedGetCopies).toHaveBeenCalledWith(7, 3));
    await waitFor(() => expect(issueButton).toBeEnabled());
  });

  it("opens confirmation and creates circulation with the selected checkout details", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("select-library"));
    await user.click(await screen.findByRole("option", { name: /Central Library/ }));
    await user.click(screen.getByTestId("input-member-search"));
    await user.click(await screen.findByTestId("button-select-member-2"));
    await user.type(screen.getByTestId("input-isbn"), book.isbn);
    await user.click(screen.getByTestId("button-lookup-isbn"));
    await user.click(await screen.findByTestId("button-issue"));

    expect(await screen.findByText("Confirm Book Issue")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-confirm-issue"));

    await waitFor(() => expect(mockedCheckout).toHaveBeenCalledTimes(1));
    expect(mockedCheckout.mock.calls[0][0]).toMatchObject({
      bookId: 7,
      userId: 2,
      libraryId: 3,
      bookCopyId: 8,
      dueDate: expect.any(Date),
    });
  });
});