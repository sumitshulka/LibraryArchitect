import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("Sidebar allocation access", () => {
  afterEach(() => {
    cleanup();
    authState.user = null;
  });

  it("shows Allocations to an ERP Library Admin but keeps local-admin-only items hidden", () => {
    authState.user = { role: "ADMIN", category: "STAFF", isLocalUser: false };

    render(<Sidebar />);

    const allocationLinks = screen.getAllByTestId("link-nav-allocations");
    expect(allocationLinks).toHaveLength(2);
    allocationLinks.forEach((link) => expect(link).toHaveAttribute("href", "/allocations"));
    expect(screen.queryByTestId("link-nav-audit-logs")).not.toBeInTheDocument();
  });

  it("does not show Allocations to librarians", () => {
    authState.user = { role: "LIBRARIAN", category: "STAFF", isLocalUser: false };

    render(<Sidebar />);

    expect(screen.queryByTestId("link-nav-allocations")).not.toBeInTheDocument();
  });
});