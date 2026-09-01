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
  circulationApi: {
    getAll: vi.fn(),
    lookupBook: vi.fn(),
    checkoutMany: vi.fn(),
    returnBook: vi.fn(),
  },
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
const mockedLookupBook = vi.mocked(circulationApi.lookupBook);
const mockedGetLibraries = vi.mocked(librariesApi.getActive);
const mockedCheckoutMany = vi.mocked(circulationApi.checkoutMany);
const mockedReturn = vi.mocked(circulationApi.returnBook);

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
    mockedLookupBook.mockResolvedValue({
      book,
      copy: {
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
    } as never);
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
    mockedCheckoutMany.mockResolvedValue([{ id: 12 }] as never);
    mockedReturn.mockResolvedValue({ id: 42 } as never);
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

    await waitFor(() => expect(mockedCheckoutMany).toHaveBeenCalledTimes(1));
    expect(mockedCheckoutMany.mock.calls[0][0]).toEqual([expect.objectContaining({
      bookId: 7,
      userId: 2,
      libraryId: 3,
      bookCopyId: 8,
      dueDate: expect.any(Date),
    })]);
  });

  it("looks up an SSN-specific active checkout and displays its borrower and fine information", async () => {
    const user = userEvent.setup();
    mockedGetCirculation.mockResolvedValue([{
      id: 12,
      bookId: 7,
      bookCopyId: 8,
      libraryId: 3,
      userId: 2,
      checkoutDate: new Date("2026-08-01"),
      dueDate: new Date("2026-08-15"),
      returnDate: null,
      status: "OVERDUE",
      fineAmount: 0,
      fineStatus: "OUTSTANDING",
      finePaidAmount: 0,
      fineWaivedAmount: 0,
      damageCost: 0,
      damageStatus: "NONE",
      damagePaidAmount: 0,
      damageWaivedAmount: 0,
      damageNotes: null,
      renewalCount: 0,
      accruedFine: 750,
      fineOutstanding: 750,
      damageOutstanding: 0,
      daysOverdue: 17,
      isOverdue: true,
    }] as never);

    renderPage();
    await user.click(screen.getByTestId("tab-return"));

    const input = screen.getByTestId("input-return-isbn");
    await user.type(input, "SSN-8");
    await user.keyboard("{Enter}");

    expect((await screen.findAllByText("Patron Reader")).length).toBeGreaterThan(0);
    expect(screen.getByText("Fine information")).toBeInTheDocument();
    expect((await screen.findAllByText("$7.50")).length).toBeGreaterThan(0);
    expect(mockedLookupBook).toHaveBeenCalledWith("SSN-8");
  });

  it("looks up an active checkout by ISBN and processes the matching return", async () => {
    const user = userEvent.setup();
    mockedLookupBook.mockResolvedValue({ book, copy: null } as never);
    mockedGetCirculation.mockResolvedValue([
      {
        id: 42,
        bookId: book.id,
        userId: member.id,
        status: "ACTIVE",
        checkoutDate: "2026-08-20T00:00:00.000Z",
        dueDate: "2099-09-15T00:00:00.000Z",
      },
    ] as never);
    renderPage();

    await user.click(screen.getByTestId("tab-return"));
    await user.type(screen.getByTestId("input-return-isbn"), ` ${book.isbn} `);
    await user.click(screen.getByTestId("button-lookup-return"));

    await waitFor(() => expect(screen.getAllByText("Effective Testing").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Patron Reader").length).toBeGreaterThan(0);
    expect(screen.getByTestId("button-process-return")).toBeEnabled();
    expect(mockedLookupBook).toHaveBeenCalledWith(book.isbn);

    await user.click(screen.getByTestId("button-process-return"));

    await waitFor(() => expect(mockedReturn).toHaveBeenCalledWith(42));
  });
});