---
name: ERP digital-resources search API
description: Distinction between internal digital-resources listing and the external ERP-facing search API.
---

The app has two separate ways to list/search Digital Resources, and they are not interchangeable:

1. `GET /api/digital-resources` — session-cookie authenticated, used by the web app itself (Repository page,
   dashboards). Supports `attributeValueIds` faceted filtering but requires a logged-in user and applies
   role-based visibility rules (department/course/role/user-specific scoping).

2. `GET /api/erp/digital-resources/search` (+ `.../search-attributes`) — token-authenticated
   (`appId` query param + `X-Secret-Key` header, verified against `erp_integrations`), meant for
   external ERP systems. This mirrors the existing `/api/erp/catalog/search` pattern for books.

**Why:** An audit found that although faceted search-by-attribute existed internally, there was no
externally documented/callable equivalent for Digital Resources — only Books had an ERP-facing
catalog search. Digital Resources needed the same shape of external API for feature parity.

**How to apply:** When asked to expose an internal listing/filter capability "for external
integration" or "in API Docs," check whether an ERP-authenticated route exists separately from the
session-authenticated one — don't assume the internal endpoint is sufficient. The ERP search
variant here deliberately narrows results to `status=PUBLISHED` + `visibility=INSTITUTION` only,
since external systems shouldn't see department/course/role/user-scoped private resources. The
result limit is shared with the existing `erp_catalog_limit` system config (same "too many
results, refine search" pattern as the book catalog).
