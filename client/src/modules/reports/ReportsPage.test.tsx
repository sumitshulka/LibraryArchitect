import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportsPage from "./ReportsPage";
import {
  acquisitionsReportApi,
  circulationReportApi,
  finesReportApi,
  librariesApi,
  paymentMethodsApi,
  usersApi,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  acquisitionsReportApi: { get: vi.fn() },
  circulationReportApi: { get: vi.fn() },
  finesReportApi: { get: vi.fn() },
  librariesApi: { getAll: vi.fn() },
  paymentMethodsApi: { getAll: vi.fn() },
  usersApi: { getAll: vi.fn() },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({
    currency: { symbol: "$" },
    format: (amount: number) => `$${(amount / 100).toFixed(2)}`,
  }),
}));

const mockedAcquisitions = vi.mocked(acquisitionsReportApi.get);
const mockedCirculation = vi.mocked(circulationReportApi.get);
const mockedFines = vi.mocked(finesReportApi.get);
const mockedLibraries = vi.mocked(librariesApi.getAll);
const mockedMethods = vi.mocked(paymentMethodsApi.getAll);
const mockedUsers = vi.mocked(usersApi.getAll);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

describe("ReportsPage fines and revenue export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLibraries.mockResolvedValue([]);
    mockedMethods.mockResolvedValue([]);
    mockedUsers.mockResolvedValue([]);
    mockedAcquisitions.mockResolvedValue({
      copies: [],
      totals: {
        totalSpend: 0,
        pricedCopies: 0,
        avgUnitPrice: 0,
        totalCopies: 0,
        datedCopies: 0,
        uniqueTitles: 0,
      },
      timeSeries: [],
      byLibrary: [],
      bySource: [],
      byCategory: [],
      byFormat: [],
      byStatus: [],
      byCondition: [],
    });
    mockedCirculation.mockResolvedValue({
      records: [],
      totals: {
        totalCheckouts: 0,
        activeCount: 0,
        returnedCount: 0,
        overdueCount: 0,
        avgLoanDays: 0,
      },
      monthlyTrends: [],
      byLibrary: [],
      byCategory: [],
      topBooks: [],
      topBorrowers: [],
      byBook: [],
      byUser: [],
    });
    mockedFines.mockResolvedValue({
      payments: [
        {
          id: 1,
          paidAt: "2026-08-01T12:00:00.000Z",
          paymentType: "FINE",
          methodName: "Cash",
          bookTitle: 'A "quoted" title',
          borrowerName: 'Pat "Reader"',
          libraryName: "Central Library",
          amount: 1250,
          referenceNumber: 'ref "one"',
          collectorName: 'Staff "One"',
        },
      ],
      totals: {
        collected: 1250,
        paymentCount: 1,
        outstanding: 0,
        waived: 0,
        damageCollected: 0,
        fineCollected: 1250,
      },
      timeSeries: [],
      byMethod: [],
      byLibrary: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("disables circulation and acquisitions exports when no records match", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTestId("button-circ-export")).toBeDisabled());

    await user.click(screen.getByRole("tab", { name: "Acquisitions" }));
    await waitFor(() => expect(screen.getByTestId("button-acq-export")).toBeDisabled());
  });

  it("exports fines and revenue rows with quoted values escaped for CSV", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:report");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    renderPage();
    await user.click(screen.getByTestId("tab-fines"));
    await waitFor(() => expect(screen.getByTestId("row-payment-1")).toBeInTheDocument());

    await user.click(screen.getByTestId("button-export-csv"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await csvBlob.text();
    expect(csv).toContain('"Book","Borrower","Library","Amount","Reference","Collected by"');
    expect(csv).toContain(
      '"2026-08-01T12:00:00.000Z","FINE","Cash","A ""quoted"" title","Pat ""Reader""","Central Library","12.50","ref ""one""","Staff ""One"""',
    );
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });

  it("exports circulation rows with dates, amounts, and quoted values", async () => {
    mockedCirculation.mockResolvedValue({
      records: [
        {
          id: 7,
          checkoutDate: "2026-08-03T09:30:00.000Z",
          dueDate: "2026-08-17T09:30:00.000Z",
          returnDate: "2026-08-20T16:45:00.000Z",
          status: "RETURNED",
          isOverdue: true,
          loanDays: 17,
          bookTitle: 'The "quoted" book',
          bookIsbn: "9780000000001",
          author: 'Author, "A"',
          category: "Fiction",
          borrowerName: 'Reader "One"',
          borrowerRole: "STUDENT",
          libraryName: "Central Library",
          renewalCount: 2,
          fineAmount: 875,
        },
      ],
      totals: {
        totalCheckouts: 1,
        activeCount: 0,
        returnedCount: 1,
        overdueCount: 1,
        avgLoanDays: 17,
      },
      monthlyTrends: [],
      byLibrary: [],
      byCategory: [],
      topBooks: [],
      topBorrowers: [],
      byBook: [],
      byUser: [],
    });

    const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:circulation");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("row-circ-7")).toBeInTheDocument());

    await user.click(screen.getByTestId("button-circ-export"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await csvBlob.text();
    expect(csv).toContain(
      '"Checkout Date","Due Date","Return Date","Status","Overdue","Loan Days","Title","ISBN","Author","Category","Borrower","Role","Library","Renewals","Fine Amount"',
    );
    expect(csv).toContain(
      '"2026-08-03","2026-08-17","2026-08-20","RETURNED","Yes","17","The ""quoted"" book","9780000000001","Author, ""A""","Fiction","Reader ""One""","STUDENT","Central Library","2","8.75"',
    );
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:circulation");
  });

  it("exports all circulation records when results exceed the visible table limit", async () => {
    const records = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1,
      checkoutDate: "2026-08-03T09:30:00.000Z",
      dueDate: "2026-08-17T09:30:00.000Z",
      returnDate: null,
      status: "ACTIVE",
      isOverdue: false,
      loanDays: 14,
      bookTitle: `Circulation title ${index + 1}`,
      bookIsbn: `978000000${String(index + 1).padStart(4, "0")}`,
      author: "Report author",
      category: "Fiction",
      borrowerName: "Report reader",
      borrowerRole: "STUDENT",
      libraryName: "Central Library",
      renewalCount: 0,
      fineAmount: 0,
    }));
    mockedCirculation.mockResolvedValue({
      records,
      totals: {
        totalCheckouts: records.length,
        activeCount: records.length,
        returnedCount: 0,
        overdueCount: 0,
        avgLoanDays: 14,
      },
      monthlyTrends: [],
      byLibrary: [],
      byCategory: [],
      topBooks: [],
      topBorrowers: [],
      byBook: [],
      byUser: [],
    });

    const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:large-circulation");
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("row-circ-1")).toBeInTheDocument());
    expect(screen.queryByTestId("row-circ-501")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("button-circ-export"));

    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await csvBlob.text();
    expect(csv.split("\n")).toHaveLength(records.length + 1);
    expect(csv).toContain('"Circulation title 501"');
    expect(anchorClick).toHaveBeenCalled();
  });

  it("exports acquisition rows with converted prices, dates, and quoted values", async () => {
    mockedAcquisitions.mockResolvedValue({
      copies: [
        {
          id: 11,
          acquisitionDate: "2026-07-12T11:00:00.000Z",
          barcode: "BC-001",
          bookTitle: 'A "quoted" title',
          bookIsbn: "9780000000002",
          author: 'Writer, "W"',
          category: "History",
          format: "HARDCOVER",
          libraryName: "North, Library",
          acquisitionSource: 'Vendor "One"',
          price: 12345,
          priceSource: "INVOICE",
          status: "AVAILABLE",
          condition: "NEW",
        },
      ],
      totals: {
        totalSpend: 12345,
        pricedCopies: 1,
        avgUnitPrice: 12345,
        totalCopies: 1,
        datedCopies: 1,
        uniqueTitles: 1,
      },
      timeSeries: [],
      byLibrary: [],
      bySource: [],
      byCategory: [],
      byFormat: [],
      byStatus: [],
      byCondition: [],
    });

    const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:acquisitions");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Acquisitions" }));
    await waitFor(() => expect(screen.getByTestId("row-acq-copy-11")).toBeInTheDocument());

    await user.click(screen.getByTestId("button-acq-export"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await csvBlob.text();
    expect(csv).toContain(
      '"Acquisition Date","Barcode","Title","ISBN","Author","Category","Format","Library","Source","Price","Price Source","Status","Condition"',
    );
    expect(csv).toContain(
      '"2026-07-12","BC-001","A ""quoted"" title","9780000000002","Writer, ""W""","History","HARDCOVER","North, Library","Vendor ""One""","123.45","INVOICE","AVAILABLE","NEW"',
    );
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:acquisitions");
  });

  it("exports all acquisition copies when results exceed the visible table limit", async () => {
    const copies = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1,
      acquisitionDate: "2026-07-12T11:00:00.000Z",
      barcode: `BC-${String(index + 1).padStart(3, "0")}`,
      bookTitle: `Acquisition title ${index + 1}`,
      bookIsbn: `978000000${String(index + 1).padStart(4, "0")}`,
      author: "Acquisition author",
      category: "History",
      format: "HARDCOVER",
      libraryName: "North Library",
      acquisitionSource: "Vendor",
      price: 1000,
      priceSource: "INVOICE",
      status: "AVAILABLE",
      condition: "NEW",
    }));
    mockedAcquisitions.mockResolvedValue({
      copies,
      totals: {
        totalSpend: copies.length * 1000,
        pricedCopies: copies.length,
        avgUnitPrice: 1000,
        totalCopies: copies.length,
        datedCopies: copies.length,
        uniqueTitles: copies.length,
      },
      timeSeries: [],
      byLibrary: [],
      bySource: [],
      byCategory: [],
      byFormat: [],
      byStatus: [],
      byCondition: [],
    });

    const createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:large-acquisitions");
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Acquisitions" }));
    await waitFor(() => expect(screen.getByTestId("row-acq-copy-1")).toBeInTheDocument());
    expect(screen.queryByTestId("row-acq-copy-501")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("button-acq-export"));

    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await csvBlob.text();
    expect(csv.split("\n")).toHaveLength(copies.length + 1);
    expect(csv).toContain('"Acquisition title 501"');
    expect(anchorClick).toHaveBeenCalled();
  });
});
