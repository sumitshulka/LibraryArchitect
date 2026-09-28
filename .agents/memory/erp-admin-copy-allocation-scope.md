---
name: ERP-admin copy allocation scope
description: Authorization boundary for ERP Library Admins allocating unallocated book copies.
---

ERP Library Admins may allocate unallocated copies only to active libraries where they have an active, non-expired library membership. Local administrators retain the existing all-library allocation access. Keep this exception limited to copy allocation; do not weaken the shared local-admin guard or extend the permission to transfers and other inventory tools without separate authorization.

**Why:** ERP administrators need the allocation workflow, but treating them as global local administrators would grant unrelated cross-library privileges.

**How to apply:** When modifying allocation authorization, preserve the active-membership scope in both the library list and the allocation mutation. Keep other local-admin-only workflows unchanged unless their access is separately approved.