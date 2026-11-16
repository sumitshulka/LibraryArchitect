---
name: Staff module access
description: User decision about limiting each staff member to a subset of their role's modules.
---

Apply module restrictions per staff member as a deny list layered over the assigned platform role. A user restriction can only remove access the role already grants; it cannot grant or override access. Local administrators always retain full, uneditable access.

**Why:** The user clarified that role assignments remain authoritative, while individual permissions may further reduce a user's available modules.

**How to apply:** Offer only modules the assigned role can access, enforce restrictions in navigation, protected pages, and API requests, and bypass restrictions for local administrators.
