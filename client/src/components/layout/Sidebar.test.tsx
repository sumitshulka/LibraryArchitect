import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";

const authState = vi.hoisted(() => ({ user: null as {
  role: string;
  category: string;
  isLocalUser: boolean;
} | null }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/"],
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

describe("Sidebar allocation access", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    authState.user = null;
  });

  it("shows Allocations to an ERP Library Admin but keeps local-admin-only items hidden", () => {
    authState.user = { role: "ADMIN", category: "STAFF", isLocalUser: false };

    renderSidebar();

    const allocationLinks = screen.getAllByTestId("link-nav-allocations");
    expect(allocationLinks).toHaveLength(2);
    allocationLinks.forEach((link) => expect(link).toHaveAttribute("href", "/allocations"));
    expect(screen.queryByTestId("link-nav-audit-logs")).not.toBeInTheDocument();
  });

  it("does not show Allocations to librarians", () => {
    authState.user = { role: "LIBRARIAN", category: "STAFF", isLocalUser: false };

    renderSidebar();

    expect(screen.queryByTestId("link-nav-allocations")).not.toBeInTheDocument();
  });

  it("shows the pending approval count beside Transfer Approvals", async () => {
    authState.user = { role: "ADMIN", category: "STAFF", isLocalUser: true };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 1, status: "PENDING_REVIEW" },
        { id: 2, status: "NEEDS_REALLOCATION" },
        { id: 3, status: "COMPLETED" },
      ],
    }) as Response));

    renderSidebar();

    const badges = await screen.findAllByTestId("transfer-approval-count");
    expect(badges).toHaveLength(2);
    badges.forEach(badge => expect(badge).toHaveTextContent("2"));
    expect(screen.getAllByTestId("link-nav-transfer-approvals")).toHaveLength(2);
  });
});