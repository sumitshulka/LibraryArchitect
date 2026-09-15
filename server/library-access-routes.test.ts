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

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));

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
  computeAccruedFine: vi.fn(async () => ({ fineCents: 0, daysOverdue: 0, isOverdue: false })),
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

const libraries = [
  { id: 1, name: "Central Library", code: "CENTRAL", isActive: true },
  { id: 2, name: "North Library", code: "NORTH", isActive: true },
];
const librarian = { id: 10, name: "A Librarian", username: "librarian", role: "LIBRARIAN" };
const admin = { id: 20, name: "An Admin", username: "admin", role: "ADMIN" };
const membership = {
  id: 30,
  userId: librarian.id,
  libraryId: 1,
  isActive: true,
  expiresAt: null,
};

describe("library access authorization and messages", () => {
  let httpServer: Server;
  let currentUser: typeof librarian | typeof admin | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = undefined;
    storageMock.getSession.mockImplementation(async (id: string) =>
      id === "test-session" && currentUser ? { userId: currentUser.id } : undefined,
    );
    storageMock.getUser.mockImplementation(async (id: number) =>
      currentUser && id === currentUser.id ? currentUser : undefined,
    );
    storageMock.getAllLibraries.mockResolvedValue(libraries);
    storageMock.getPendingLibraryAccessRequest.mockResolvedValue(undefined);
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

  async function request(path: string, init: RequestInit = {}) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(currentUser ? { "x-session-id": "test-session" } : {}),
        ...init.headers,
      },
    });
  }

  it("gives administrators every library and librarians only their active assignments", async () => {
    currentUser = admin;
    let response = await request("/api/me/library-access");
    expect(response.status).toBe(200);
    expect((await response.json()).libraries).toHaveLength(2);

    currentUser = librarian;
    storageMock.getMembershipsByUser.mockResolvedValue([membership]);
    response = await request("/api/libraries");
    expect(response.status).toBe(200);
    expect((await response.json()).map((library: { id: number }) => library.id)).toEqual([1]);
  });

  it("blocks a librarian from an unassigned library on the server", async () => {
    currentUser = librarian;
    storageMock.getMembershipsByUser.mockResolvedValue([]);
    const response = await request("/api/libraries/2/dashboard");
    expect(response.status).toBe(403);
    expect(storageMock.getLibraryDashboard).not.toHaveBeenCalled();
  });

  it("creates one pending access request for an unassigned librarian", async () => {
    currentUser = librarian;
    storageMock.getStaffLibraryAllocations.mockResolvedValue([]);
    storageMock.createLibraryAccessRequest.mockResolvedValue({
      id: 55,
      requesterId: librarian.id,
      status: "PENDING",
      message: "A Librarian is requesting access to a library.",
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    });
    const response = await request("/api/library-access-requests", { method: "POST", body: "{}" });
    expect(response.status).toBe(201);
    expect(storageMock.createLibraryAccessRequest).toHaveBeenCalledWith(expect.objectContaining({
      requesterId: librarian.id,
      message: expect.stringContaining("requesting access"),
    }));
  });

  it("lets administrators see and resolve a request after assigning a library", async () => {
    currentUser = admin;
    const pending = {
      id: 55,
      requesterId: librarian.id,
      status: "PENDING",
      message: "Please assign me a library.",
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      requesterName: librarian.name,
      requesterEmail: "librarian@example.com",
      requesterRole: librarian.role,
      resolvedByName: null,
    };
    storageMock.getLibraryAccessRequests.mockResolvedValue([pending]);
    storageMock.getStaffLibraryAllocations.mockResolvedValue([membership]);
    storageMock.resolveLibraryAccessRequest.mockResolvedValue({
      ...pending,
      status: "RESOLVED",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
    });

    let response = await request("/api/admin/messages?status=PENDING");
    expect(response.status).toBe(200);
    expect((await response.json())[0].requesterName).toBe(librarian.name);

    response = await request("/api/admin/messages/55/resolve", {
      method: "PATCH",
      body: JSON.stringify({ resolutionNote: "Assigned Central Library" }),
    });
    expect(response.status).toBe(200);
    expect(storageMock.resolveLibraryAccessRequest).toHaveBeenCalledWith(55, admin.id, "Assigned Central Library");
  });

  it("allocates the selected library directly from a pending message", async () => {
    currentUser = admin;
    const pending = {
      id: 56,
      requesterId: librarian.id,
      status: "PENDING",
      message: "Please assign me a library.",
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionAction: null,
      requesterName: librarian.name,
      requesterEmail: "librarian@example.com",
      requesterRole: librarian.role,
      resolvedByName: null,
    };
    storageMock.getLibraryAccessRequests.mockResolvedValue([pending]);
    storageMock.getLibrary.mockResolvedValue({ ...libraries[0], name: "Central Library", isActive: true });
    storageMock.allocateStaffToLibrary.mockResolvedValue(membership);
    storageMock.resolveLibraryAccessRequest.mockResolvedValue({
      ...pending,
      status: "RESOLVED",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
      resolutionAction: "ALLOCATED",
    });

    const response = await request("/api/admin/messages/56/allocate", {
      method: "PATCH",
      body: JSON.stringify({ libraryId: 1, resolutionNote: "Assigned Central Library" }),
    });

    expect(response.status).toBe(200);
    expect(storageMock.allocateStaffToLibrary).toHaveBeenCalledWith(
      librarian.id,
      1,
      admin.id,
      "Assigned Central Library",
    );
    expect(storageMock.resolveLibraryAccessRequest).toHaveBeenCalledWith(
      56,
      admin.id,
      "Assigned Central Library",
      "ALLOCATED",
    );
  });

  it("rejects a pending message without creating a library assignment", async () => {
    currentUser = admin;
    const pending = {
      id: 57,
      requesterId: librarian.id,
      status: "PENDING",
      message: "Please assign me a library.",
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionAction: null,
      requesterName: librarian.name,
      requesterEmail: "librarian@example.com",
      requesterRole: librarian.role,
      resolvedByName: null,
    };
    storageMock.getLibraryAccessRequests.mockResolvedValue([pending]);
    storageMock.resolveLibraryAccessRequest.mockResolvedValue({
      ...pending,
      status: "RESOLVED",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
      resolutionAction: "REJECTED",
    });

    const response = await request("/api/admin/messages/57/reject", {
      method: "PATCH",
      body: JSON.stringify({ resolutionNote: "Library assignment is not available yet" }),
    });

    expect(response.status).toBe(200);
    expect(storageMock.allocateStaffToLibrary).not.toHaveBeenCalled();
    expect(storageMock.resolveLibraryAccessRequest).toHaveBeenCalledWith(
      57,
      admin.id,
      "Library assignment is not available yet",
      "REJECTED",
    );
  });
});