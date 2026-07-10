import { drizzle } from "drizzle-orm/neon-http";
import { neon, types } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const sql = neon(process.env.DATABASE_URL, { types });
export const db = drizzle(sql, { schema });

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
