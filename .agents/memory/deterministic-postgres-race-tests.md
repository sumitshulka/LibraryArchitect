---
name: Deterministic PostgreSQL race tests
description: A reliable pattern for forcing a specific winner in concurrent Neon HTTP integration tests.
---

When an integration test must prove which concurrent PostgreSQL mutation wins, give the losing operation a second, lower-sorted identifier and hold that identifier's advisory transaction lock in a short-lived transaction. Start the losing operation while it is blocked on the gate, then run the winning operation against the contested identifier and release the gate afterward.

**Why:** Neon HTTP exposes batched transactions but not a convenient test hook between statements, so launch order alone is not a reliable way to prove the update-side path won.

**How to apply:** Poll `pg_try_advisory_xact_lock` until the gate holder is confirmed, keep the gate transaction alive only long enough for the winner to commit, and assert both the conflict owner and the persisted winner values.