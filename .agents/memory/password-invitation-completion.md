---
name: Password invitation completion
description: Durable ordering and database-driver constraints for local password setup invitations.
---

The password setup flow must persist the local password before marking the one-time invitation as used. If the password write fails after token consumption, the user sees an expired-link message and cannot recover through the original email.

**Why:** The Neon HTTP proxy can silently lose affected rows on direct INSERT/UPDATE RETURNING statements, so account writes and token consumption must not be ordered around an unverified write.

**How to apply:** Treat both SQL NULL and an empty string as an uninitialized local password. Use a conditional password update, consume the invitation only after that update succeeds, and use returningViaCte when an update method needs to return the affected user.