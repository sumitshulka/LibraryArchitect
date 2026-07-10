---
name: Neon HTTP driver timestamp parser ordering
description: Why timestamp/timestamptz columns returned null or "Invalid Date" via @neondatabase/serverless + drizzle-orm, and the fix.
---

`drizzle-orm`'s `NeonHttpDriver.initMappers()` registers its own global
`types.setTypeParser` for TIMESTAMP/TIMESTAMPTZ/DATE/INTERVAL (identity passthrough)
the moment `drizzle(sql, { schema })` is called. This silently overwrites any custom
type parser registered beforehand, and there is no per-query `types` option threaded
through from `neon(url, { types })` — it's dead configuration for this purpose.

Separately, the neon-http wire protocol returns timestamp values as ISO-8601 strings
with a trailing "Z" (e.g. `2026-03-17T08:37:06.815876Z`), but drizzle's
`PgTimestamp#mapFromDriverValue` unconditionally appends `"+0000"` to the string
(`new Date(value + "+0000")`), assuming Postgres's native space-separated format with
no timezone marker. Appending to a string that already ends in "Z" produces an
Invalid Date (silently becomes `null`/NaN downstream).

**Why:** two independent bugs stack: (1) global type-parser registration order matters
because `drizzle()` re-registers parsers on construction, and (2) drizzle's own
mapFromDriverValue assumes a format the neon-http driver doesn't actually return.

**How to apply:** if timestamps are unexpectedly `null` or throw "Invalid time value"
with this stack (`@neondatabase/serverless` + `drizzle-orm/neon-http`), register any
custom `types.setTypeParser` calls for TIMESTAMP/TIMESTAMPTZ *after* calling
`drizzle(sql, { schema })`, not before — and normalize the value by stripping the
trailing "Z" / converting "T" to a space so drizzle's own "+0000" suffixing works.
