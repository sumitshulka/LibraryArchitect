import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig, types } from "@neondatabase/serverless";
import { sql as drizzleSql } from "drizzle-orm";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Workaround for a driver/proxy bug: this environment's Postgres HTTP proxy
// returns `rows: null` (and sometimes `fields: null`) instead of `[]` when a
// query matches zero rows. @neondatabase/serverless then crashes trying to
// call `.map()` on `null` inside processQueryResult. We intercept the raw
// HTTP response and normalize `null` rows/fields to empty arrays before the
// driver parses it.
neonConfig.fetchFunction = async (url: string, opts: RequestInit) => {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = text;
  try {
    const json = JSON.parse(text);
    if (json !== null && typeof json === "object") {
      if (json.rows === null) json.rows = [];
      if (json.fields === null) json.fields = [];
      if (Array.isArray(json.results)) {
        for (const result of json.results) {
          if (result && typeof result === "object") {
            if (result.rows === null) result.rows = [];
            if (result.fields === null) result.fields = [];
          }
        }
      }
    }
    body = JSON.stringify(json);
  } catch {
    // Not JSON (e.g. an error response) — pass through unmodified.
  }
  return new Response(body, { status: res.status, statusText: res.statusText });
};

const sql = neon(process.env.DATABASE_URL, { types });
export const db = drizzle(sql, { schema });

// Workaround for two related driver bugs in this environment's neon-http
// setup, both around explicit `null` values and RETURNING clauses:
//
// 1) When an INSERT/UPDATE parameter is JS `null` and the target column is a
//    non-text type (integer, timestamp, etc.), the driver serializes it as an
//    empty string "" instead of SQL NULL, causing
//    `invalid input syntax for type integer/timestamp: ""`. Fix: replace
//    explicit `null` values with a `sql\`NULL\`` literal, which the driver
//    passes through untyped and Postgres accepts for any column type.
//
// 2) The HTTP proxy in this environment returns empty `rows`/`fields` for the
//    RETURNING clause of INSERT/UPDATE commands even when rows were actually
//    affected (rowCount > 0) — the row silently vanishes. Wrapping the
//    mutation in a CTE (`WITH x AS (INSERT ... RETURNING *) SELECT * FROM x`)
//    turns the outer command into a SELECT, which the proxy handles
//    correctly and returns the real row data.
//
// Use `nullifyForInsert` on values before insert/update, and `returningViaCte`
// instead of `.returning()` when you need the affected row(s) back.
export function nullifyForInsert<T extends Record<string, any>>(data: T): T {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = value === null ? drizzleSql`NULL` : value;
  }
  return out as T;
}

export async function returningViaCte<T>(query: any): Promise<T[]> {
  const cte = db.$with("_returning_cte").as(query);
  return (await db.with(cte).select().from(cte)) as T[];
}

// Workaround for a driver bug: @neondatabase/serverless returns timestamp
// values over its HTTP wire protocol as ISO-8601 strings with a trailing "Z"
// (e.g. "2026-03-17T08:37:06.815876Z"). drizzle-orm's NeonHttpDriver.initMappers()
// (invoked above, inside drizzle()) registers an identity passthrough parser for
// TIMESTAMP/TIMESTAMPTZ so it can do its own parsing in PgTimestamp#mapFromDriverValue,
// which does `new Date(value + "+0000")` — but that produces an Invalid Date when
// `value` already has a trailing "Z". We must re-register OUR parser AFTER calling
// drizzle() (which overwrites any parser set beforehand), normalizing to a bare
// "YYYY-MM-DD HH:MM:SS.ffffff" string (no timezone marker) so drizzle's own
// "+0000" suffixing parses correctly.
const normalizeTimestamp = (value: string) => value.replace("T", " ").replace(/Z$/, "");
types.setTypeParser(types.builtins.TIMESTAMP, normalizeTimestamp);
types.setTypeParser(types.builtins.TIMESTAMPTZ, normalizeTimestamp);

// Workaround for another driver/proxy bug: this environment's Postgres HTTP
// proxy returns BOOL columns as actual JSON booleans (`true`/`false`) instead
// of the "t"/"f" text-format strings the pg wire protocol normally uses (and
// which @neondatabase/serverless's default BOOL parser expects). Its parser
// does `value === "t"`, so a real `true` boolean fails that check and silently
// becomes `false`. We register a parser that accepts either representation.
types.setTypeParser(types.builtins.BOOL, (value: any) => value === true || value === "t" || value === "true");
