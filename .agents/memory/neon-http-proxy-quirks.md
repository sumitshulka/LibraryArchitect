---
name: Neon HTTP proxy quirks in this environment
description: Several distinct bugs in this Replit environment's Postgres HTTP proxy / @neondatabase/serverless driver combo, and the workarounds applied in server/db.ts.
---

This environment's Postgres HTTP proxy (used by `@neondatabase/serverless`'s neon-http driver) has multiple wire-format bugs that don't show up with a normal TCP Postgres connection. All fixes live in `server/db.ts`; they are driver/environment-level, not specific to any one schema.

## 1. Zero-row query results return `rows: null` instead of `[]`
`processQueryResult` in the driver calls `.map()` on `rows`, which crashes on `null`. Fixed via a custom `neonConfig.fetchFunction` that intercepts the raw HTTP response and normalizes `null` `rows`/`fields` to `[]` before the driver parses it.

**Why:** reproduced on both new and pre-existing tables — it's proxy-side, not caused by any particular schema.
**How to apply:** already global via `neonConfig.fetchFunction` in `server/db.ts`; no per-query action needed.

## 2. Explicit `null` values for non-text columns (integer, timestamp, etc.) get sent as `""`
When an INSERT/UPDATE parameter is JS `null` and the target column isn't text, the driver serializes it as empty string `""`, causing `invalid input syntax for type integer/timestamp: ""`.

**Why:** confirmed at the raw driver level (`neon()` tagged query), not a drizzle-specific bug — reproduced with plain parameterized SQL and null params.
**How to apply:** use `nullifyForInsert(data)` (exported from `server/db.ts`) on values before `.insert()`/`.update().set()` — it replaces JS `null` with a `sql\`NULL\`` literal, which Postgres accepts for any column type.

## 3. BOOL columns are read back as `false` even when Postgres has `true`
The proxy returns BOOL columns as actual JSON `true`/`false` instead of the `"t"`/`"f"` text-format strings the driver's default BOOL parser expects (it does `value === "t"`, so a real `true` fails that check silently).

**Why:** verified by comparing raw wire response (`rows: [[true]]`) against what a plain `db.select()` returned (`false`) — the row data itself was correct in Postgres, only the client-side parsing was wrong.
**How to apply:** already fixed globally via `types.setTypeParser(types.builtins.BOOL, ...)` in `server/db.ts` (registered after `drizzle()`, same ordering requirement as the timestamp parser — see the timestamp memory note).

## 4. INSERT/UPDATE ... RETURNING silently returns empty rows/fields even when rowCount > 0
The row is genuinely written (confirmed via raw SQL SELECT afterward) but the RETURNING payload in the HTTP response comes back with `rows: []`/`fields: []` and `rowCount` correctly showing 1+. This makes `.returning()` in drizzle look like it "found nothing" even though the write succeeded.

**Why:** the proxy appears to only reliably populate `rows`/`fields` for `command: "SELECT"` responses; INSERT/UPDATE keep `command: "INSERT"/"UPDATE"` and lose the RETURNING data even when `RETURNING *` is present in the query.
**How to apply:** wrap the mutation in a CTE so the outer command becomes a SELECT: `WITH x AS (INSERT ... RETURNING *) SELECT * FROM x`. Use the `returningViaCte(query)` helper exported from `server/db.ts` — pass it the drizzle `.insert()/.update()...returning()` builder instead of awaiting it directly.

## General guidance
Any new code doing INSERT/UPDATE with nullable non-text columns or that needs the affected row(s) back should use `nullifyForInsert` + `returningViaCte` from `server/db.ts`. This is a growing list — if you find another proxy quirk, add it here rather than special-casing it inline.
