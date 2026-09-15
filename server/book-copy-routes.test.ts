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

const librarian = {
  id: 101,
  name: "Test Librarian",
  role: "LIBRARIAN",
};

const remoteAdmin = {
  id: 202,
  name: "Remote Admin",
  role: "ADMIN",
  erpIntegrationId: "remote-erp",
};

const localAdmin = {
  id: 303,
  name: "Local Admin",
  role: "ADMIN",
};

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
  let currentUser: typeof librarian | typeof remoteAdmin | typeof localAdmin | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = undefined;
    storageMock.getBookCopy.mockResolvedValue(copy);
    storageMock.getBookCopiesByIdentifiers.mockResolvedValue([]);
    storageMock.updateBookCopy.mockImplementation(async (_id, updates) => ({ ...copy, ...updates }));
    storageMock.createBookCopy.mockImplementation(async (value) => ({ id: 11, ...value }));
    storageMock.getBook.mockResolvedValue({ id: 5 });
    storageMock.getLibrary.mockResolvedValue({ id: 3 });
    storageMock.getSession.mockImplementation(async (sessionId: string) =>
      sessionId === "test-session" && currentUser ? { userId: currentUser.id } : undefined,
    );
    storageMock.getUser.mockImplementation(async (userId: number) =>
      currentUser && userId === currentUser.id ? currentUser : undefined,
    );
    storageMock.auditBookCopyIdentifierCollisions.mockResolvedValue([]);

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

  async function request(
    path: string,
    method: "GET" | "POST" | "PATCH",
    body?: unknown,
    authenticated = false,
  ) {
    const address = httpServer.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { "x-session-id": "test-session" } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it.each([
    ["unauthenticated", undefined, false, 401],
    ["a librarian", librarian, true, 403],
    ["a remote administrator", remoteAdmin, true, 403],
    ["a local administrator", localAdmin, true, 200],
  ])("controls access to the identifier audit for %s", async (_label, user, authenticated, expectedStatus) => {
    currentUser = user;
    storageMock.auditBookCopyIdentifierCollisions.mockResolvedValue([{
      identifier: "DUPLICATE",
      copyIds: [10, 20],
      occurrences: [],
    }]);

    const response = await request(
      "/api/book-copy-identifiers/audit",
      "GET",
      undefined,
      authenticated,
    );

    expect(response.status).toBe(expectedStatus);
    if (expectedStatus === 200) {
      expect(await response.json()).toMatchObject({
        collisionCount: 1,
        affectedCopyIds: [10, 20],
      });
      expect(storageMock.auditBookCopyIdentifierCollisions).toHaveBeenCalledOnce();
    } else {
      expect(storageMock.auditBookCopyIdentifierCollisions).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["unauthenticated", undefined, false, 401],
    ["a librarian", librarian, true, 403],
    ["a remote administrator", remoteAdmin, true, 403],
    ["a local administrator", localAdmin, true, 200],
  ])("controls access to identifier remediation for %s", async (_label, user, authenticated, expectedStatus) => {
    currentUser = user;

    const response = await request(
      "/api/book-copy-identifiers/remediate",
      "POST",
      {
        copyId: copy.id,
        field: "userDefinedSSN",
        expectedValue: copy.userDefinedSSN,
        replacement: "LIB-10-REMEDIATED",
      },
      authenticated,
    );

    expect(response.status).toBe(expectedStatus);
    if (expectedStatus === 200) {
      expect(storageMock.updateBookCopy).toHaveBeenCalledWith(copy.id, {
        userDefinedSSN: "LIB-10-REMEDIATED",
      });
    } else {
      expect(storageMock.updateBookCopy).not.toHaveBeenCalled();
    }
  });

  it("records the local administrator and returns nullable values in remediation history", async () => {
    currentUser = localAdmin;
    const timestamp = new Date("2026-09-15T09:30:00.000Z");
    storageMock.queryAuditLogs.mockResolvedValue({
      total: 1,
      logs: [{
        id: 777,
        userId: localAdmin.id,
        userName: localAdmin.name,
        targetId: String(copy.id),
        details: {
          field: "userDefinedSSN",
          previousValue: copy.userDefinedSSN,
          replacement: null,
        },
        timestamp,
      }],
    });

    const remediationResponse = await request(
      "/api/book-copy-identifiers/remediate",
      "POST",
      {
        copyId: copy.id,
        field: "userDefinedSSN",
        expectedValue: copy.userDefinedSSN,
        replacement: null,
      },
      true,
    );

    expect(remediationResponse.status).toBe(200);
    expect(logAuditMock).toHaveBeenCalledWith(expect.anything(), {
      category: "CATALOG",
      action: "BOOK_COPY_IDENTIFIER_REMEDIATED",
      userId: localAdmin.id,
      userName: localAdmin.name,
      targetType: "book_copy",
      targetId: String(copy.id),
      details: {
        field: "userDefinedSSN",
        previousValue: copy.userDefinedSSN,
        replacement: null,
      },
    });

    const historyResponse = await request(
      "/api/book-copy-identifiers/remediation-history",
      "GET",
      undefined,
      true,
    );

    expect(historyResponse.status).toBe(200);
    expect(await historyResponse.json()).toEqual({
      events: [{
        id: 777,
        copyId: copy.id,
        field: "userDefinedSSN",
        previousValue: copy.userDefinedSSN,
        replacement: null,
        actor: localAdmin.name,
        actorId: localAdmin.id,
        timestamp: timestamp.toISOString(),
      }],
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    expect(storageMock.queryAuditLogs).toHaveBeenCalledWith({
      category: "CATALOG",
      action: "BOOK_COPY_IDENTIFIER_REMEDIATED",
      limit: 50,
      offset: 0,
    });
  });

  it("returns older remediation history pages in newest-first order", async () => {
    currentUser = localAdmin;
    const timestamps = [
      new Date("2026-09-14T09:30:00.000Z"),
      new Date("2026-09-13T09:30:00.000Z"),
    ];
    storageMock.queryAuditLogs.mockResolvedValue({
      total: 4,
      logs: [
        {
          id: 776,
          userId: localAdmin.id,
          userName: localAdmin.name,
          targetId: "11",
          details: {
            field: "barcode",
            previousValue: "OLD-2",
            replacement: "OLD-3",
          },
          timestamp: timestamps[0],
        },
        {
          id: 775,
          userId: localAdmin.id,
          userName: localAdmin.name,
          targetId: "12",
          details: {
            field: "internalSSN",
            previousValue: "OLD-1",
            replacement: null,
          },
          timestamp: timestamps[1],
        },
      ],
    });

    const response = await request(
      "/api/book-copy-identifiers/remediation-history?limit=2&offset=2",
      "GET",
      undefined,
      true,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      events: [
        {
          id: 776,
          copyId: 11,
          timestamp: timestamps[0].toISOString(),
        },
        {
          id: 775,
          copyId: 12,
          timestamp: timestamps[1].toISOString(),
        },
      ],
      total: 4,
      limit: 2,
      offset: 2,
      hasMore: false,
    });
    expect(storageMock.queryAuditLogs).toHaveBeenCalledWith({
      category: "CATALOG",
      action: "BOOK_COPY_IDENTIFIER_REMEDIATED",
      limit: 2,
      offset: 2,
    });
  });

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

  it("returns one conflict when two creates race for the same identifier", async () => {
    let created = false;
    storageMock.getBookCopiesByIdentifiers.mockImplementation(async () => []);
    storageMock.createBookCopy.mockImplementation(async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (created) {
        const error = new Error("A copy identifier is already used by another copy");
        error.name = "BookCopyIdentifierConflictError";
        (error as Error & { conflictingCopyIds: number[] }).conflictingCopyIds = [11];
        throw error;
      }
      created = true;
      return { id: 11, ...value };
    });

    const body = {
      bookId: 5,
      libraryId: 3,
      barcode: "BC-RACE",
      internalSSN: "SYS-RACE",
      status: "AVAILABLE",
    };
    const responses = await Promise.all([
      request("/api/book-copies", "POST", body),
      request("/api/book-copies", "POST", body),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflictResponse = responses.find((response) => response.status === 409);
    expect(conflictResponse).toBeDefined();
    expect(await conflictResponse!.json()).toMatchObject({ conflictingCopyIds: [11] });
  });
});