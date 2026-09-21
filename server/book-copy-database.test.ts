// @vitest-environment node

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { InsertBookCopy } from "@shared/schema";

const developmentDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.NEON_DATABASE_URL?.trim();

function databaseIdentity(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

if (
  testDatabaseUrl
  && developmentDatabaseUrl
  && databaseIdentity(testDatabaseUrl) === databaseIdentity(developmentDatabaseUrl)
) {
  throw new Error(
    "NEON_DATABASE_URL must point to an isolated PostgreSQL database, not DATABASE_URL",
  );
}

// This suite must use the isolated database URL, rather than the application's
// normal development database. Dynamic imports let the database module see
// that URL before it initializes its Neon client.
let db: typeof import("./db").db;
let DBStorage: typeof import("./storage").DBStorage;
let BookCopyIdentifierConflictError: typeof import("./storage").BookCopyIdentifierConflictError;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  ({ db } = await import("./db"));
  ({ DBStorage, BookCopyIdentifierConflictError } = await import("./storage"));
}

const runId = `book-copy-db-test-${randomUUID()}`;
let bookId: number;
let storage: InstanceType<typeof DBStorage>;

type DatabaseRow = Record<string, unknown>;

async function insertBookCopy(values: {
  barcode: string;
  internalSSN?: string | null;
  userDefinedSSN?: string | null;
}) {
  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO book_copies (book_id, barcode, internal_ssn, user_defined_ssn)
      VALUES (
        ${bookId},
        ${values.barcode},
        ${values.internalSSN ?? null},
        ${values.userDefinedSSN ?? null}
      )
      RETURNING id
    )
    SELECT id FROM inserted
  `);
  const id = Number((result.rows as DatabaseRow[])[0]?.id);
  expect(Number.isInteger(id)).toBe(true);
  return id;
}

async function rowsForIdentifier(identifier: string) {
  const result = await db.execute(sql`
    SELECT id, barcode, internal_ssn, user_defined_ssn
    FROM book_copies
    WHERE lower(barcode) = lower(${identifier})
       OR lower(internal_ssn) = lower(${identifier})
       OR lower(user_defined_ssn) = lower(${identifier})
    ORDER BY id
  `);
  return result.rows as DatabaseRow[];
}

async function holdIdentifierLock(identifier: string, seconds: number) {
  return db.execute(sql`
    WITH lock_acquired AS (
      SELECT pg_advisory_xact_lock(hashtextextended(lower(${identifier}), 0))
    )
    SELECT pg_sleep(${seconds})
    FROM lock_acquired
  `);
}

async function waitForIdentifierLock(identifier: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await db.execute(sql`
      SELECT pg_try_advisory_xact_lock(hashtextextended(lower(${identifier}), 0)) AS acquired
    `);
    const acquired = (result.rows as DatabaseRow[])[0]?.acquired;
    if (acquired === false || acquired === "f") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for the test lock on ${identifier}`);
}

async function removeTestCopies() {
  await db.execute(sql`
    DELETE FROM book_copies
    WHERE book_id = ${bookId}
      AND barcode LIKE ${`${runId}%`}
  `);
}

describe.skipIf(!testDatabaseUrl)("book copy identifiers against PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute(sql`
      WITH inserted AS (
        INSERT INTO books (isbn, title, author, category)
        VALUES (
          ${`${runId}-isbn`},
          ${`${runId} fixture book`},
          'Identifier race test',
          'Testing'
        )
        RETURNING id
      )
      SELECT id FROM inserted
    `);
    bookId = Number((result.rows as DatabaseRow[])[0]?.id);
    storage = new DBStorage();
  });

  afterAll(async () => {
    if (!db || !bookId) return;
    await removeTestCopies();
    await db.execute(sql`DELETE FROM books WHERE id = ${bookId}`);
  });

  it.each([
    ["Internal SSN", "internalSSN"],
    ["user-defined SSN", "userDefinedSSN"],
  ] as const)(
    "allows only one winner when a barcode races a %s",
    async (_label, updateField) => {
      const identifier = `${runId}-${updateField}-race`;
      const existingCopyId = await insertBookCopy({
        barcode: `${runId}-${updateField}-existing`,
      });

      const createInput: InsertBookCopy = {
        bookId,
        libraryId: null,
        barcode: identifier,
        internalSSN: null,
        userDefinedSSN: null,
        status: "AVAILABLE",
        condition: "GOOD",
      };

      const results = await Promise.allSettled([
        storage.createBookCopy(createInput),
        storage.updateBookCopy(existingCopyId, { [updateField]: identifier }),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected?.status).toBe("rejected");
      expect(rejected && rejected.reason).toBeInstanceOf(BookCopyIdentifierConflictError);

      const matchingRows = await rowsForIdentifier(identifier);
      expect(matchingRows).toHaveLength(1);
      expect(
        matchingRows[0].barcode === identifier
          || matchingRows[0].internal_ssn === identifier
          || matchingRows[0].user_defined_ssn === identifier,
      ).toBe(true);
    },
  );

  it.each([
    ["Internal SSN", "internalSSN", "userDefinedSSN"],
    ["user-defined SSN", "userDefinedSSN", "internalSSN"],
  ] as const)(
    "allows the update to win when it acquires the %s identifier lock first",
    async (_label, updateField, gateField) => {
      const targetIdentifier = `${runId}-${updateField}-update-winner`;
      const gateIdentifier = `${runId}-${updateField}-create-gate`;
      const existingBarcode = `${runId}-${updateField}-update-winner-existing`;
      const existingCopyId = await insertBookCopy({ barcode: existingBarcode });
      const createInput: InsertBookCopy = {
        bookId,
        libraryId: null,
        barcode: targetIdentifier,
        internalSSN: gateField === "internalSSN" ? gateIdentifier : null,
        userDefinedSSN: gateField === "userDefinedSSN" ? gateIdentifier : null,
        status: "AVAILABLE",
        condition: "GOOD",
      };

      const gatePromise = holdIdentifierLock(gateIdentifier, 3);
      await waitForIdentifierLock(gateIdentifier);
      const createPromise = storage.createBookCopy(createInput);
      void createPromise.catch(() => undefined);
      const updated = await storage.updateBookCopy(existingCopyId, {
        [updateField]: targetIdentifier,
      });

      expect(updated?.id).toBe(existingCopyId);
      expect(updated?.[updateField]).toBe(targetIdentifier);

      await gatePromise;
      await expect(createPromise).rejects.toMatchObject({
        conflictingCopyIds: [existingCopyId],
      });

      const matchingRows = await rowsForIdentifier(targetIdentifier);
      expect(matchingRows).toEqual([
        expect.objectContaining({
          id: existingCopyId,
          barcode: existingBarcode,
          [updateField === "internalSSN" ? "internal_ssn" : "user_defined_ssn"]: targetIdentifier,
        }),
      ]);
    },
    10000,
  );

  it("keeps a same-copy identifier edit valid", async () => {
    const identifier = `${runId}-same-copy`;
    const copy = await storage.createBookCopy({
      bookId,
      libraryId: null,
      barcode: `${runId}-same-copy-barcode`,
      internalSSN: null,
      userDefinedSSN: identifier,
      status: "AVAILABLE",
      condition: "GOOD",
    });
    const updated = await storage.updateBookCopy(copy.id, {
      userDefinedSSN: identifier,
    });

    expect(updated?.id).toBe(copy.id);
    expect(updated?.userDefinedSSN).toBe(identifier);
    expect(await rowsForIdentifier(identifier)).toHaveLength(1);
  });

  it("allocates copies with integer IDs and generated internal SSNs", async () => {
    const libraryResult = await db.execute(sql`
      SELECT id
      FROM libraries
      ORDER BY id
      LIMIT 1
    `);
    const libraryId = Number((libraryResult.rows as DatabaseRow[])[0]?.id);
    expect(Number.isInteger(libraryId)).toBe(true);

    const firstCopyId = await insertBookCopy({
      barcode: `${runId}-allocation-first`,
    });
    const secondCopyId = await insertBookCopy({
      barcode: `${runId}-allocation-second`,
    });

    const allocated = await storage.allocateCopies(
      [firstCopyId, secondCopyId],
      libraryId,
      { mode: "GENERATE", prefix: `${runId}-ssn` },
    );

    expect(allocated.map((copy) => copy.id)).toEqual([firstCopyId, secondCopyId]);
    expect(allocated.every((copy) => copy.libraryId === libraryId)).toBe(true);
    expect(allocated.map((copy) => copy.internalSSN)).toEqual([
      expect.stringContaining(`${runId}-ssn-`),
      expect.stringContaining(`${runId}-ssn-`),
    ]);
  });

  it("audits every legacy collision occurrence and supports remediation", async () => {
    const identifier = `${runId}-legacy-collision`;
    await insertBookCopy({
      barcode: identifier,
      internalSSN: `${runId}-legacy-internal`,
    });
    const collisionCopyId = await insertBookCopy({
      barcode: `${runId}-legacy-second-barcode`,
      internalSSN: identifier,
      userDefinedSSN: identifier,
    });

    const collision = (await storage.auditBookCopyIdentifierCollisions())
      .find((entry) => entry.identifier === identifier);

    expect(collision).toEqual({
      identifier,
      copyIds: expect.any(Array),
      occurrences: expect.arrayContaining([
        expect.objectContaining({ field: "barcode", value: identifier }),
        expect.objectContaining({ field: "internalSSN", value: identifier }),
        expect.objectContaining({ field: "userDefinedSSN", value: identifier }),
      ]),
    });
    expect(collision?.copyIds).toHaveLength(2);
    expect(collision?.occurrences).toHaveLength(3);

    await storage.updateBookCopy(collisionCopyId, {
      internalSSN: `${runId}-remediated-internal`,
      userDefinedSSN: `${runId}-remediated-user`,
    });

    expect(
      (await storage.auditBookCopyIdentifierCollisions())
        .some((entry) => entry.identifier === identifier),
    ).toBe(false);
  });
});