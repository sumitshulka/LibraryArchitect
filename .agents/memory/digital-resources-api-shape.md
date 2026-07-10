---
name: Digital resources list API response shape
description: How the digital resources listing endpoint returns data, to avoid frontend type mismatches
---

`GET /api/digital-resources` (and the visibility-filtered variant used for non-staff) returns `{ resources: DigitalResource[], total: number }`, not a bare array.

**Why:** `storage.listDigitalResources`/`listVisibleDigitalResources` return a paginated envelope; a naive `res.json()` typed as `Promise<DigitalResource[]>` on the client silently breaks `.map()`/`.filter()` calls at runtime (not caught by TS since `fetch().json()` is untyped).

**How to apply:** Any client code consuming this endpoint must unwrap `data.resources` (see `client/src/lib/api.ts` `digitalResourcesApi.getAll`). `GET /api/digital-resources/:id` returns the resource object directly with an embedded `versions` array — no envelope there.
