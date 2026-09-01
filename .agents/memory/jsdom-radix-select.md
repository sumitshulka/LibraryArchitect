---
name: Radix Select in jsdom
description: Shared test-environment compatibility requirements for Radix Select components.
---

Radix Select interactions in jsdom require no-op implementations for pointer capture and scrollIntoView APIs.

**Why:** jsdom does not provide these browser methods, so otherwise valid Select tests fail during event handling or active-option rendering.

**How to apply:** Keep the compatibility methods in the shared test setup so page tests can exercise real Select behavior without mocking the UI primitives.