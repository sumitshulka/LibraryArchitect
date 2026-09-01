---
name: Wouter search strings in jsdom
description: How to provide query strings when testing components that use Wouter's useSearch hook.
---

When a component reads query parameters with Wouter's `useSearch`, a custom test `Router` should provide an explicit `searchHook` that returns the desired query string. Passing a query in `ssrPath` alone does not populate the client-side jsdom snapshot.

**Why:** Wouter's browser search hook reads the jsdom location on the client, so its SSR fallback is bypassed during component tests.

**How to apply:** Keep the test route path and search string in sync, for example by returning the substring beginning at `?` from the fixture path through `searchHook`.