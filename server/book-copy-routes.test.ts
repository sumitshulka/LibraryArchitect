// @vitest-environment node

import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "./routes";

const { storageMock } = vi.hoisted(() => {
  const methods = new Map<string, ReturnType<typeof vi.fn>>();
  const storage = new Proxy({}, {
    get: (_target, property: string) => {
      if (!methods.has(property)) methods.set(property, vi.fn());
      return methods.get(property);
    },
  });
  return { storageMock: storage as Record<string, ReturnType<typeof vi.fn>> };
});

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./audit", () => ({
  getClientInfo: vi.fn(),
  invalidateAuditConfigCache: vi.fn(),
  logAudit: vi.fn(),
}));
vi.mock("./fines", () => ({
  CIRCULATION_POLICY_KEY: "circulation_policy",
  FINE_CALCULATION_MODE_KEY: "fine_calculation_mode",
  calculateAccruedFine: vi.fn(),
  computeAccruedFine: vi.fn(),
  getCirculationFineSummary: vi.fn(),
  invalidateCirculationPolicyCache: vi.fn(),
  loadFineCalculationMode: vi.fn(),
  loadGlobalCirculationDefaults: vi.fn(),
}));
vi.mock("./swagger", () => ({ setupSwagger: vi.fn() }));
vi.mock("./reservations", () => ({ registerReservationRoutes: vi.fn() }));
vi.mock("./erp-extra", () => ({ registerErpExtraRoutes: vi.fn() }));
vi.mock("./digital-resources", () => ({ registerDigitalResourceRoutes: vi.fn() }));
vi.mock("./lost-damaged", () => ({ registerLostDamagedRoutes: vi.fn() }));

const copy = {
  id: 10,
  bookId: 5,
  libraryId: 3,
  barcode: "BC-10",
  internalSSN: "SYS-10",
  userDefinedSSN: "LIB-10",
  status: "AVAILABLE",
};

describe("book copy identifier validation", () => {
  let httpServer: Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.getBookCopy.mockResolvedValue(copy);
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([]);
    storageMock.updateBookCopy.mockImplementation(async (_id, updates) => ({ ...copy, ...updates }));
    storageMock.createBookCopy.mockImplementation(async (value) => ({ id: 11, ...value }));
    storageMock.getBook.mockResolvedValue({ id: 5 });
    storageMock.getLibrary.mockResolvedValue({ id: 3 });

    const app = express();
    app.use(express.json());
    httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    });
  });

  async function request(path: string, method: "POST" | "PATCH", body: unknown) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("allows an edit that retains the same copy's identifier", async () => {
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([copy]);

    const response = await request("/api/book-copies/10", "PATCH", { userDefinedSSN: "lib-10" });

    expect(response.status).toBe(200);
    expect(storageMock.updateBookCopy).toHaveBeenCalledWith(10, { userDefinedSSN: "lib-10" });
  });

  it.each([
    ["barcode", { id: 20, barcode: "OTHER", internalSSN: null, userDefinedSSN: null }],
    ["Internal SSN", { id: 20, barcode: "BC-20", internalSSN: "OTHER", userDefinedSSN: null }],
    ["user-defined SSN", { id: 20, barcode: "BC-20", internalSSN: null, userDefinedSSN: "OTHER" }],
  ])("rejects an edit conflicting with another copy's %s", async (_label, conflictingCopy) => {
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([conflictingCopy]);

    const response = await request("/api/book-copies/10", "PATCH", { userDefinedSSN: "other" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ conflictingCopyIds: [20] });
    expect(storageMock.updateBookCopy).not.toHaveBeenCalled();
    expect(storageMock.getBookCopiesByIdentifiers).toHaveBeenCalledWith(["other"]);
  });

  it("rejects casing-only conflicts before creating a copy", async () => {
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([
      { id: 20, barcode: "BC-20", internalSSN: null, userDefinedSSN: "LIB-20" },
    ]);

    const response = await request("/api/book-copies", "POST", {
      bookId: 5,
      libraryId: 3,
      barcode: "BC-11",
      userDefinedSSN: "lib-20",
      status: "AVAILABLE",
    });

    expect(response.status).toBe(409);
    expect(storageMock.createBookCopy).not.toHaveBeenCalled();
    expect(storageMock.getBookCopiesByIdentifiers).toHaveBeenCalledWith(["BC-11", "lib-20"]);
  });

  it("reports every existing conflicting copy without changing data", async () => {
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([
      { id: 20, barcode: "BC-20", internalSSN: null, userDefinedSSN: "DUPLICATE" },
      { id: 21, barcode: "BC-21", internalSSN: "duplicate", userDefinedSSN: null },
    ]);

    const response = await request("/api/book-copies/10", "PATCH", { userDefinedSSN: "Duplicate" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ conflictingCopyIds: [20, 21] });
    expect(storageMock.updateBookCopy).not.toHaveBeenCalled();
  });
});