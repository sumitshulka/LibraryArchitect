import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnBookDialog } from "./ReturnBookDialog";
import { circulationApi, paymentMethodsApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  circulationApi: {
    finePreview: vi.fn(),
    returnBook: vi.fn(),
  },
  paymentMethodsApi: { getAll: vi.fn() },
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

const mockedFinePreview = vi.mocked(circulationApi.finePreview);
const mockedPaymentMethods = vi.mocked(paymentMethodsApi.getAll);
const mockedReturn = vi.mocked(circulationApi.returnBook);

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReturnBookDialog
        circulationId={42}
        bookTitle="Effective Testing"
        borrowerName="Patron Reader"
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("ReturnBookDialog fine collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFinePreview.mockResolvedValue({
      assessedFineCents: 1250,
      finePaid: 0,
      fineWaived: 0,
      fineOutstanding: 1250,
      damageCost: 0,
      damagePaid: 0,
      damageWaived: 0,
      damageOutstanding: 0,
      daysOverdue: 5,
      isOverdue: true,
      totalOutstanding: 1250,
      bookUnitPrice: null,
      payments: [],
    });
    mockedPaymentMethods.mockResolvedValue([
      { id: 1, name: "Cash", code: "CASH", isActive: true },
      { id: 2, name: "Card", code: "CARD", isActive: true },
    ] as never);
    mockedReturn.mockResolvedValue({ id: 42 } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("sends the selected payment payload when returning a book", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByTestId("button-add-fine-payment"));
    await user.click(screen.getByTestId("select-method-0"));
    await user.click(await screen.findByRole("option", { name: "Card" }));
    await user.type(screen.getByTestId("input-ref-0"), "RCPT-RETURN-42");

    await user.click(screen.getByTestId("button-confirm-return"));

    await waitFor(() => expect(mockedReturn).toHaveBeenCalledWith(42, {
      damageCost: 0,
      damageNotes: undefined,
      payments: [{
        paymentMethodId: 2,
        amount: 1250,
        paymentType: "FINE",
        referenceNumber: "RCPT-RETURN-42",
      }],
      waiveFineAmount: undefined,
      waiveDamageAmount: undefined,
      waiveReason: undefined,
    }));
  });
});