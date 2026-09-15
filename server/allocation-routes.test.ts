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

const selectedCopies = [
  { id: 10, barcode: "BC-10", internalSSN: null, userDefinedSSN: null, libraryId: null },
  { id: 11, barcode: "BC-11", internalSSN: null, userDefinedSSN: null, libraryId: null },
];

describe("POST /api/allocations/allocate", () => {
  let httpServer: Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    const localAdmin = { id: 303, name: "Local Admin", role: "ADMIN" };
    storageMock.getSession.mockResolvedValue({ userId: localAdmin.id });
    storageMock.getUser.mockResolvedValue(localAdmin);
    storageMock.getLibrary.mockResolvedValue({ id: 3, name: "Central Library" });
    storageMock.getBookCopiesByIds.mockResolvedValue(selectedCopies);
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([]);
    storageMock.allocateCopies.mockResolvedValue(selectedCopies.map((copy) => ({ ...copy, libraryId: 3 })));

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

  async function allocate(body: unknown) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/allocations/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": "test-session" },
      body: JSON.stringify(body),
    });
  }

  it("allocates every selected copy with supplied library SSNs", async () => {
    const assignments = [
      { copyId: 10, ssn: "LIB-001" },
      { copyId: 11, ssn: "LIB-002" },
    ];
    const response = await allocate({
      copyIds: [10, 11],
      libraryId: 3,
      ssnMode: "SUPPLIED",
      ssnAssignments: assignments,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ allocatedCount: 2, barcodeReadyCount: 2 });
    expect(storageMock.allocateCopies).toHaveBeenCalledWith(
      [10, 11],
      3,
      { mode: "SUPPLIED", assignments },
    );
  });

  it("rejects an incomplete supplied-SSN mapping before allocation", async () => {
    const response = await allocate({
      copyIds: [10, 11],
      libraryId: 3,
      ssnMode: "SUPPLIED",
      ssnAssignments: [{ copyId: 10, ssn: "LIB-001" }],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("exactly one SSN");
    expect(storageMock.allocateCopies).not.toHaveBeenCalled();
  });

  it("rejects duplicate supplied SSNs without regard to case", async () => {
    const response = await allocate({
      copyIds: [10, 11],
      libraryId: 3,
      ssnMode: "SUPPLIED",
      ssnAssignments: [
        { copyId: 10, ssn: "LIB-001" },
        { copyId: 11, ssn: "lib-001" },
      ],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("must be unique");
    expect(storageMock.allocateCopies).not.toHaveBeenCalled();
  });

  it("rejects a supplied SSN already used by another copy", async () => {
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([
      { id: 99, barcode: "BC-99", internalSSN: "LIB-001", userDefinedSSN: null },
    ]);
    const response = await allocate({
      copyIds: [10, 11],
      libraryId: 3,
      ssnMode: "SUPPLIED",
      ssnAssignments: [
        { copyId: 10, ssn: "lib-001" },
        { copyId: 11, ssn: "LIB-002" },
      ],
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("already used");
    expect(storageMock.allocateCopies).not.toHaveBeenCalled();
  });

  it("preserves the generated Internal SSN allocation path", async () => {
    const response = await allocate({
      copyIds: [10, 11],
      libraryId: 3,
      ssnMode: "GENERATE",
      ssnPrefix: "CENTRAL",
    });

    expect(response.status).toBe(200);
    expect(storageMock.getBookCopiesByIdentifiers).not.toHaveBeenCalled();
    expect(storageMock.allocateCopies).toHaveBeenCalledWith(
      [10, 11],
      3,
      { mode: "GENERATE", prefix: "CENTRAL" },
    );
  });
});