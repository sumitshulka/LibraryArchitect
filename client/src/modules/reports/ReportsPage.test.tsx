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
});