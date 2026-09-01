import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PendingFinesPage from "./PendingFinesPage";
import {
  circulationApi,
  librariesApi,
  paymentMethodsApi,
  pendingFinesApi,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  circulationApi: { collectFine: vi.fn() },
  librariesApi: { getAll: vi.fn() },
  paymentMethodsApi: { getAll: vi.fn() },
  pendingFinesApi: { getAll: vi.fn() },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 99, role: "ADMIN", name: "Admin", email: "admin@example.com" },
  }),
}));

vi.mock("@/lib/useCurrency", () => ({
  useCurrency: () => ({
    format: (amount: number) => `$${(amount / 100).toFixed(2)}`,
    currency: { symbol: "$" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedGetPendingFines = vi.mocked(pendingFinesApi.getAll);
const mockedGetLibraries = vi.mocked(librariesApi.getAll);
const mockedGetPaymentMethods = vi.mocked(paymentMethodsApi.getAll);
const mockedCollectFine = vi.mocked(circulationApi.collectFine);

const pendingCase = {
  circulationId: 41,
  bookId: 7,
  bookTitle: "Effective Testing",
  bookIsbn: "9780132350884",
  libraryId: 3,
  libraryName: "Central Library",
  checkoutDate: "2026-08-01T00:00:00.000Z",
  dueDate: "2026-08-15T00:00:00.000Z",
  returnDate: "2026-08-20T00:00:00.000Z",
  fineAmount: 1250,
  finePaidAmount: 0,
  fineWaivedAmount: 0,
  fineOutstandingCents: 1250,
  damageCost: 0,
  damagePaidAmount: 0,
  damageWaivedAmount: 0,
  damageOutstandingCents: 0,
  fineStatus: "OUTSTANDING",
  damageStatus: "NONE",
  totalOutstandingCents: 1250,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PendingFinesPage />
    </QueryClientProvider>,
  );
}

describe("PendingFinesPage collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLibraries.mockResolvedValue([
      { id: 3, name: "Central Library", code: "CENTRAL" },
    ] as never);
    mockedGetPendingFines.mockResolvedValue({
      users: [{
        userId: 2,
        userName: "Patron Reader",
        userEmail: "patron@example.com",
        userRole: "STUDENT",
        membershipId: "S-100",
        totalOutstandingCents: 1250,
        circulations: [pendingCase],
      }],
      total: 1,
      grandTotalCents: 1250,
    } as never);
    mockedGetPaymentMethods.mockResolvedValue([
      { id: 1, name: "Cash", code: "CASH", isActive: true },
      { id: 2, name: "Card", code: "CARD", isActive: true },
    ] as never);
    mockedCollectFine.mockResolvedValue({ id: pendingCase.circulationId } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("sends the selected payment payload and closes after a successful collection", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Patron Reader");
    await user.click(screen.getByTestId("row-user-2"));
    await user.click(screen.getByTestId("button-collect-41"));
    await user.click(await screen.findByTestId("button-add-fine-split"));

    await user.click(screen.getByTestId("select-method-0"));
    await user.click(await screen.findByRole("option", { name: "Card" }));
    const amount = screen.getByTestId("input-amount-0");
    await user.clear(amount);
    await user.type(amount, "12.50");
    await user.type(screen.getByTestId("input-ref-0"), "RCPT-123");

    await user.click(screen.getByTestId("button-confirm-collect"));

    await waitFor(() => expect(mockedCollectFine).toHaveBeenCalledWith(41, {
      payments: [{
        paymentMethodId: 2,
        amount: 1250,
        paymentType: "FINE",
        referenceNumber: "RCPT-123",
      }],
      waiveFineAmount: undefined,
      waiveDamageAmount: undefined,
      waiveReason: undefined,
    }));
    await waitFor(() => expect(screen.queryByTestId("dialog-collect-payment")).not.toBeInTheDocument());
  });
});