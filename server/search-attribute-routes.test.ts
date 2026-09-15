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

describe("POST /api/search-attributes/bulk-assign", () => {
  let httpServer: Server;

  beforeEach(async () => {
    vi.clearAllMocks();
    const localAdmin = { id: 303, name: "Local Admin", role: "ADMIN" };
    storageMock.getSession.mockResolvedValue({ userId: localAdmin.id });
    storageMock.getUser.mockResolvedValue(localAdmin);
    storageMock.getSearchAttributeType.mockResolvedValue({ id: 7, name: "Courses" });
    storageMock.getSearchAttributeValuesByType.mockResolvedValue([{ value: "CS101" }]);
    storageMock.createSearchAttributeValues.mockResolvedValue([
      { id: 8, attributeTypeId: 7, value: "CS102" },
      { id: 9, attributeTypeId: 7, value: "CS103" },
    ]);
    storageMock.getSearchAttributeValue.mockImplementation(async (id: number) => ({ id }));
    storageMock.getBook.mockImplementation(async (id: number) => ({ id, title: `Book ${id}` }));
    storageMock.getDigitalResource.mockImplementation(async (id: number) => ({ id, title: `Resource ${id}` }));
    storageMock.setResourceSearchAttributes.mockResolvedValue(undefined);
    storageMock.setDigitalResourceSearchAttributes.mockResolvedValue(undefined);

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

  async function assign(body: unknown) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/search-attributes/bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": "test-session" },
      body: JSON.stringify(body),
    });
  }

  async function createValues(typeId: number, body: unknown) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}/api/search-attributes/types/${typeId}/values/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": "test-session" },
      body: JSON.stringify(body),
    });
  }

  it("creates many values in one request and reports skipped values", async () => {
    const response = await createValues(7, {
      values: ["CS101", "CS102", "CS103", "CS102"],
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      createdCount: 2,
      skippedCount: 1,
    });
    expect(storageMock.createSearchAttributeValues).toHaveBeenCalledWith(
      7,
      ["CS101", "CS102", "CS103"],
    );
  });

  it("rejects bulk values for an unknown attribute type", async () => {
    storageMock.getSearchAttributeType.mockResolvedValue(undefined);

    const response = await createValues(999, { values: ["CS101"] });

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Search attribute type not found");
    expect(storageMock.createSearchAttributeValues).not.toHaveBeenCalled();
  });

  it("validates all targets before replacing assignments", async () => {
    const response = await assign({
      attributeValueIds: [10, 10],
      bookIds: [1, 1, 2],
      digitalResourceIds: [3],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ booksUpdated: 2, digitalResourcesUpdated: 1 });
    expect(storageMock.setResourceSearchAttributes).toHaveBeenCalledWith(1, [10]);
    expect(storageMock.setResourceSearchAttributes).toHaveBeenCalledWith(2, [10]);
    expect(storageMock.setDigitalResourceSearchAttributes).toHaveBeenCalledWith(3, [10]);
  });

  it("rejects requests without any selected target", async () => {
    const response = await assign({
      attributeValueIds: [10],
      bookIds: [],
      digitalResourceIds: [],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/at least one book/i);
    expect(storageMock.setResourceSearchAttributes).not.toHaveBeenCalled();
    expect(storageMock.setDigitalResourceSearchAttributes).not.toHaveBeenCalled();
  });

  it("rejects an unknown attribute value", async () => {
    storageMock.getSearchAttributeValue.mockResolvedValue(undefined);

    const response = await assign({
      attributeValueIds: [999],
      bookIds: [1],
      digitalResourceIds: [],
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/attribute values were not found/i);
    expect(storageMock.setResourceSearchAttributes).not.toHaveBeenCalled();
  });
});