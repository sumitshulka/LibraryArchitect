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

const partialBook = {
  id: 5,
  isbn: "9781781334355",
  title: "Ego",
  author: "Mary Gregory",
  publisher: "Rethink Press, Limited",
  publishedYear: 2020,
  category: "General",
  resourceTypeId: 1,
  format: "PHYSICAL",
  status: "AVAILABLE",
  coverUrl: null,
  shelfLocation: null,
  marcRecord: null,
  acquisitionDate: null,
  unitPrice: null,
  createdAt: new Date("2026-09-01T13:03:16.000Z"),
};

describe("POST /api/books partial-save recovery", () => {
  let httpServer: Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.getBookByIsbn.mockResolvedValue(partialBook);
    storageMock.createBookCopies.mockResolvedValue([{ id: 10, bookId: partialBook.id }]);

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

  async function saveBook() {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isbn: partialBook.isbn,
        title: partialBook.title,
        author: partialBook.author,
        publisher: partialBook.publisher,
        publishedYear: partialBook.publishedYear,
        category: partialBook.category,
        resourceTypeId: partialBook.resourceTypeId,
        format: partialBook.format,
        status: partialBook.status,
        quantity: 1,
      }),
    });
  }

  it("completes copy creation when a previous failed save left a zero-copy book", async () => {
    storageMock.getBookCopiesByBook.mockResolvedValue([]);

    const response = await saveBook();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: partialBook.id, copiesCreated: 1, recovered: true });
    expect(storageMock.createBook).not.toHaveBeenCalled();
    expect(storageMock.createBookCopies).toHaveBeenCalledWith(
      partialBook.id,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("continues rejecting a duplicate book that already has copies", async () => {
    storageMock.getBookCopiesByBook.mockResolvedValue([{ id: 9, bookId: partialBook.id }]);

    const response = await saveBook();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Book with this ISBN already exists");
    expect(storageMock.createBookCopies).not.toHaveBeenCalled();
  });
});