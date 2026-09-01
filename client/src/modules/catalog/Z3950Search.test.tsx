import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Z3950Search } from "./Z3950Search";
import { z3950Api } from "@/lib/api";

const { setLocation } = vi.hoisted(() => ({
  setLocation: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  z3950Api: {
    search: vi.fn(),
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/settings?section=catalog", setLocation],
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const mockedSearch = vi.mocked(z3950Api.search);

const result = {
  id: "ol-123",
  title: "A Live Catalog Result",
  author: "A. Real Author",
  isbn: "9780132350884",
  publisher: "A Real Publisher",
  year: "2024",
  source: "Open Library",
  category: "Technology",
};

describe("Z3950Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("searches the live API with the entered query and selected source", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([result]);

    render(<Z3950Search />);
    await user.click(screen.getByTestId("select-z3950-server"));
    await user.click(await screen.findByRole("option", { name: "Google Books" }));
    await user.type(screen.getByTestId("input-z3950-query"), "A Live Catalog Result");
    await user.click(screen.getByTestId("button-search-z3950"));

    expect(mockedSearch).toHaveBeenCalledWith("A Live Catalog Result", "google-books");
    expect(await screen.findByText("A Live Catalog Result")).toBeInTheDocument();
    expect(screen.getByText("Open Library")).toBeInTheDocument();
  });

  it("keeps importing a live result available through Add Resource", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([result]);

    render(<Z3950Search />);
    await user.type(screen.getByTestId("input-z3950-query"), "9780132350884");
    await user.click(screen.getByTestId("button-search-z3950"));
    await user.click(await screen.findByTestId("button-import-z3950-ol-123"));

    expect(setLocation).toHaveBeenCalledTimes(1);
    expect(setLocation.mock.calls[0][0]).toContain("/catalog/new?");
    expect(setLocation.mock.calls[0][0]).toContain("source=z3950");
    expect(setLocation.mock.calls[0][0]).toContain("title=A+Live+Catalog+Result");
  });

  it("shows provider failures instead of reporting an empty search", async () => {
    const user = userEvent.setup();
    mockedSearch.mockRejectedValue(new Error("Live catalog providers are temporarily unavailable. Please try again."));

    render(<Z3950Search />);
    await user.type(screen.getByTestId("input-z3950-query"), "9780132350884");
    await user.click(screen.getByTestId("button-search-z3950"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Live catalog providers are temporarily unavailable. Please try again.",
    );
    expect(screen.queryByText("No live results found")).not.toBeInTheDocument();
  });

  it("does not offer an unusable import when a title result has no ISBN", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([{ ...result, id: "ol-no-isbn", isbn: "" }]);

    render(<Z3950Search />);
    await user.type(screen.getByTestId("input-z3950-query"), "A title without an ISBN");
    await user.click(screen.getByTestId("button-search-z3950"));

    const importButton = await screen.findByTestId("button-import-z3950-ol-no-isbn");
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveTextContent("ISBN required");
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });
});