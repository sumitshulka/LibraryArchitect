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

const reviewRequest = {
  ...pendingRequest,
  items: [{
    id: 11,
    requestId: 1,
    bookId: 8,
    requestedQuantity: 3,
    book: { id: 8, title: "Example Book", isbn: "9780000000008" },
    legs: [],
    acquisitions: [],
  }],
};

let requestRows: any[] = [pendingRequest];

function renderPage(path = "/transfers") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [path, vi.fn()]}>
        <Route path={path}>
          <TransfersPage />
        </Route>
      </Router>
    </QueryClientProvider>,
  );
}

describe("TransfersPage withdrawal confirmation", () => {
  let notificationIsRead = false;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationIsRead = false;
    requestRows = [pendingRequest];
    authState.user = { id: 1, name: "Local Admin", role: "ADMIN", isLocalUser: true };
    apiMocks.getAllLibraries.mockResolvedValue([{ id: 2, name: "Central Library" }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      let body: unknown;
      if (path.endsWith("/transfers/notifications/4/read")) {
        notificationIsRead = true;
        body = { success: true };
      } else if (path.startsWith("/api/transfers/catalog")) {
        body = [{
          id: 8,
          title: "Example Book",
          sources: [
            { libraryId: 4, libraryName: "West Library", quantity: 2 },
            { libraryId: 5, libraryName: "East Library", quantity: 5 },
          ],
          localInventory: { total: 1, byStatus: { AVAILABLE: 1 } },
        }];
      } else if (path.endsWith("/transfers/notifications")) {
        body = notificationIsRead ? [] : [{
          id: 4,
          requestId: 1,
          recipientId: 1,
          message: "Transfer request #1 needs review",
          readAt: null,
        }];
      } else if (path.endsWith("/transfers")) {
        body = requestRows;
      } else if (path.endsWith("/transfers/acquisitions")) {
        body = [];
      } else {
        body = { success: true, status: "CANCELLED" };
      }
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

  it("removes a notification from the list after it is marked read", async () => {
    renderPage("/transfer-approvals");

    await screen.findByText("Transfer request #1 needs review");
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));

    await waitFor(() => {
      expect(screen.queryByText("Transfer request #1 needs review")).not.toBeInTheDocument();
    });
  });

  it.each([
    ["/transfers", "Library Transfers"],
    ["/transfers/acquisitions", "Acquisition Queue"],
  ])("keeps approval notifications off %s", async (path, heading) => {
    renderPage(path);

    await screen.findByRole("heading", { name: heading });
    expect(screen.queryByText("Transfer request #1 needs review")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === "/api/transfers/notifications")).toBe(false);
  });

  it("lets an admin choose available sources and queues the unallocated remainder", async () => {
    requestRows = [reviewRequest];
    renderPage("/transfer-approvals");

    expect(await screen.findByRole("button", { name: "Approve sources and queue remainder" })).toBeDisabled();
    await userEvent.click(await screen.findByRole("button", { name: "Choose sources" }));
    await screen.findByRole("heading", { name: "Choose transfer sources" });
    const acquisitionInput = screen.getByLabelText("Copies to Acquisition Queue for Example Book");
    expect(acquisitionInput).toHaveValue(3);
    expect(screen.getByText("Full request goes to acquisition.")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Add source library" }));
    await screen.findByRole("option", { name: "West Library · 2 available" });
    await userEvent.selectOptions(screen.getByLabelText("Source library"), "4");
    await userEvent.clear(screen.getByLabelText("Quantity from source 1"));
    await userEvent.type(screen.getByLabelText("Quantity from source 1"), "2");
    expect(acquisitionInput).toHaveValue(1);
    expect(screen.getByText("Partial request goes to acquisition.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve allocations" }));

    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === "/api/transfers/1/review");
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        action: "approve",
        allocations: [{ itemId: 11, libraryId: 4, quantity: 2 }],
        acquisitions: [{ itemId: 11, quantity: 1 }],
      });
    });
  });

  it("enables suggested-source approval when the request includes a source", async () => {
    requestRows = [{
      ...reviewRequest,
      items: [{
        ...reviewRequest.items[0],
        legs: [{ id: 21, sourceLibraryId: 4, requestedQuantity: 1, status: "PREFERRED" }],
      }],
    }];
    renderPage("/transfer-approvals");

    expect(await screen.findByRole("button", { name: "Approve sources and queue remainder" })).toBeEnabled();
  });

  it("can route the full requested quantity to the Acquisition Queue", async () => {
    requestRows = [reviewRequest];
    renderPage("/transfer-approvals");

    await userEvent.click(await screen.findByRole("button", { name: "Choose sources" }));
    const acquisitionInput = await screen.findByLabelText("Copies to Acquisition Queue for Example Book");
    expect(acquisitionInput).toHaveValue(3);
    await userEvent.click(screen.getByRole("button", { name: "Approve allocations" }));

    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === "/api/transfers/1/review");
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        action: "approve",
        allocations: [],
        acquisitions: [{ itemId: 11, quantity: 3 }],
      });
    });
  });

  it("collects a required rejection reason in the application dialog", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    renderPage("/transfer-approvals");

    await userEvent.click(await screen.findByRole("button", { name: /^Reject$/ }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Reject request" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Rejection reason/), "No copies can be transferred");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url) === "/api/transfers/1/review");
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        action: "reject",
        reason: "No copies can be transferred",
      });
    });
    expect(promptSpy).not.toHaveBeenCalled();
  });
});
