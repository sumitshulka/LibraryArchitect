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

const { logAuditMock } = vi.hoisted(() => ({
  logAuditMock: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./audit", () => ({
  getClientInfo: vi.fn(),
  invalidateAuditConfigCache: vi.fn(),
  logAudit: logAuditMock,
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

const library = {
  id: 7,
  name: "Central Library",
  code: "CENTRAL",
  orgUnitId: 1,
  address: null,
  contactEmail: null,
  contactPhone: null,
  openingHours: null,
  isActive: true,
  isMainLibrary: true,
  policies: {
    loanPeriodDays: 14,
    finePerDay: 10,
  },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const librarian = {
  id: 101,
  name: "Test Librarian",
  username: "librarian",
  role: "LIBRARIAN",
};

const admin = {
  id: 202,
  name: "Test Admin",
  username: "admin",
  role: "ADMIN",
};

describe("PATCH /api/libraries/:id policy authorization and audit", () => {
  let httpServer: Server;
  let currentUser: typeof librarian | typeof admin | undefined;
  let currentLibrary: typeof library;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = undefined;
    currentLibrary = structuredClone(library);

    storageMock.getLibrary.mockImplementation(async (id: number) =>
      id === library.id ? currentLibrary : undefined,
    );
    storageMock.getSession.mockImplementation(async (sessionId: string) =>
      sessionId === "test-session" && currentUser ? { userId: currentUser.id } : undefined,
    );
    storageMock.getUser.mockImplementation(async (userId: number) =>
      currentUser && userId === currentUser.id ? currentUser : undefined,
    );
    storageMock.createCirculationPolicyVersion.mockResolvedValue({
      id: 99,
      scope: "LIBRARY",
      libraryId: library.id,
    });
    storageMock.updateLibrary.mockImplementation(async (id: number, updates: Partial<typeof library>) => {
      if (id !== currentLibrary.id) return undefined;
      currentLibrary = { ...currentLibrary, ...updates };
      return currentLibrary;
    });

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

  async function patchLibrary(body: unknown, authenticated = false) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/libraries/${library.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { "x-session-id": "test-session" } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("rejects unauthenticated policy edits before changing the library", async () => {
    const response = await patchLibrary({
      policies: { loanPeriodDays: 30 },
      policyReason: "Update approved by the board",
    });

    expect(response.status).toBe(401);
    expect(currentLibrary.policies).toEqual(library.policies);
    expect(storageMock.updateLibrary).not.toHaveBeenCalled();
    expect(storageMock.createCirculationPolicyVersion).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rejects librarian policy edits before changing the library", async () => {
    currentUser = librarian;

    const response = await patchLibrary({
      policies: { loanPeriodDays: 30 },
      policyReason: "Update approved by the board",
    }, true);

    expect(response.status).toBe(403);
    expect(currentLibrary.policies).toEqual(library.policies);
    expect(storageMock.updateLibrary).not.toHaveBeenCalled();
    expect(storageMock.createCirculationPolicyVersion).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("creates a policy version and complete FINES audit entry for an admin edit", async () => {
    currentUser = admin;
    const effectiveFrom = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const resultingPolicy = {
      loanPeriodDays: 30,
      finePerDay: 15,
    };

    const response = await patchLibrary({
      policies: resultingPolicy,
      policyReason: "Update approved by the board",
      policyEffectiveFrom: effectiveFrom,
    }, true);

    expect(response.status).toBe(200);
    expect(currentLibrary.policies).toEqual(resultingPolicy);
    expect(storageMock.createCirculationPolicyVersion).toHaveBeenCalledWith({
      scope: "LIBRARY",
      libraryId: library.id,
      policy: resultingPolicy,
      effectiveFrom: new Date(effectiveFrom),
      reason: "Update approved by the board",
      createdBy: admin.id,
      createdByName: admin.name,
    });

    expect(logAuditMock).toHaveBeenCalledWith(expect.anything(), {
      category: "FINES",
      action: "LIBRARY_POLICY_VERSION_CREATED",
      userId: admin.id,
      userName: admin.name,
      targetType: "policy_version",
      targetId: `LIBRARY:${library.id}`,
      details: {
        libraryId: library.id,
        libraryName: library.name,
        changedFields: ["loanPeriodDays", "finePerDay"],
        previousPolicy: library.policies,
        policy: resultingPolicy,
        reason: "Update approved by the board",
        effectiveFrom,
        backdated: true,
      },
    });
  });
});