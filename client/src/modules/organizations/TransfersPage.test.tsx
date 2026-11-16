import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Router } from "wouter";
import TransfersPage from "./TransfersPage";

const authState = vi.hoisted(() => ({
  user: { id: 1, name: "Local Admin", role: "ADMIN", isLocalUser: true },
}));

const apiMocks = vi.hoisted(() => ({
  getAllLibraries: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("@/lib/api", () => ({
  librariesApi: { getAll: apiMocks.getAllLibraries },
  libraryAccessApi: { getMine: vi.fn() },
}));

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const pendingRequest = {
  id: 1,
  destinationLibraryId: 2,
  requestedBy: 1,
  status: "PENDING_REVIEW",
  reason: "Course reserve",
  createdAt: "2026-11-16T08:00:00.000Z",
  destination: { id: 2, name: "Central Library" },
  items: [],
  events: [],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => ["/transfers", vi.fn()]}>
        <Route path="/transfers">
          <TransfersPage />
        </Route>
      </Router>
    </QueryClientProvider>,
  );
}

describe("TransfersPage withdrawal confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 1, name: "Local Admin", role: "ADMIN", isLocalUser: true };
    apiMocks.getAllLibraries.mockResolvedValue([{ id: 2, name: "Central Library" }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/transfers")
        ? [pendingRequest]
        : path.endsWith("/transfers/notifications") || path.endsWith("/transfers/acquisitions")
          ? []
          : { success: true, status: "CANCELLED" };
      return { ok: true, json: async () => body } as Response;
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the application dialog and submits only after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Withdraw request" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/audit history will be retained/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Keep request" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Withdraw request" }));
    const confirmation = screen.getByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Withdraw request" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/transfers/1/withdraw",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
