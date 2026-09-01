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
      if (!methods.has(property)) {
        methods.set(property, vi.fn());
      }
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
  computeAccruedFine: vi.fn(async () => ({
    fineCents: 0,
    daysOverdue: 0,
    isOverdue: false,
  })),
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

type TestCirculation = {
  id: number;
  bookId: number;
  bookCopyId: number;
  userId: number;
  libraryId: number;
  checkoutDate: Date;
  dueDate: Date;
  returnDate: Date | null;
  status: "ACTIVE" | "RETURNED";
};

const staffSession = { userId: 900 };
const staffUser = {
  id: 900,
  name: "Test Librarian",
  username: "librarian",
  role: "LIBRARIAN",
};

function circulation(id: number, status: TestCirculation["status"]): TestCirculation {
  return {
    id,
    bookId: id + 1000,
    bookCopyId: id + 2000,
    userId: 42,
    libraryId: 7,
    checkoutDate: new Date("2026-08-01T00:00:00.000Z"),
    dueDate: new Date("2099-01-01T00:00:00.000Z"),
    returnDate: status === "RETURNED" ? new Date("2026-08-15T00:00:00.000Z") : null,
    status,
  };
}

describe("POST /api/circulation/return-batch", () => {
  let httpServer: Server;
  let records: Map<number, TestCirculation>;
  let updateCirculation: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    records = new Map();
    updateCirculation = storageMock.updateCirculation;

    storageMock.getSession.mockResolvedValue(staffSession);
    storageMock.getUser.mockResolvedValue(staffUser);
    storageMock.getCirculation.mockImplementation(async (id: number) => records.get(id));
    updateCirculation.mockImplementation(async (id: number, updates: Partial<TestCirculation>) => {
      const current = records.get(id);
      if (!current) return undefined;
      const updated = { ...current, ...updates };
      records.set(id, updated);
      return updated;
    });
    storageMock.updateBook.mockResolvedValue({});
    storageMock.updateBookCopy.mockResolvedValue({});

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

  async function postBatch(body: unknown) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/circulation/return-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": "test-session",
      },
      body: JSON.stringify(body),
    });
  }

  it("returns successful and already-returned IDs separately", async () => {
    records.set(101, circulation(101, "ACTIVE"));
    records.set(202, circulation(202, "RETURNED"));

    const response = await postBatch({ circulationIds: [101, 202] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.succeeded).toHaveLength(1);
    expect(body.succeeded[0].circulationId).toBe(101);
    expect(body.succeeded[0].circulation.id).toBe(101);
    expect(body.failed).toEqual([
      { circulationId: 202, error: "This book has already been returned" },
    ]);
    expect(records.get(101)?.status).toBe("RETURNED");
    expect(records.get(202)?.status).toBe("RETURNED");
    expect(updateCirculation).toHaveBeenCalledTimes(1);
    expect(updateCirculation).toHaveBeenCalledWith(
      101,
      expect.objectContaining({ status: "RETURNED" }),
    );
  });

  it("rejects malformed IDs before changing any circulation", async () => {
    records.set(101, circulation(101, "ACTIVE"));

    const response = await postBatch({ circulationIds: [101, 0] });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("circulationIds");
    expect(records.get(101)?.status).toBe("ACTIVE");
    expect(updateCirculation).not.toHaveBeenCalled();
  });

  it("rejects oversized batches before changing any circulation", async () => {
    records.set(101, circulation(101, "ACTIVE"));

    const response = await postBatch({
      circulationIds: Array.from({ length: 51 }, (_, index) => index + 1),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("at most 50");
    expect(records.get(101)?.status).toBe("ACTIVE");
    expect(updateCirculation).not.toHaveBeenCalled();
  });
});