---
name: PDF preview blocked by Chrome in nested iframes
description: Why embedding PDFs via <iframe> fails in this environment and the fix used.
---

Chrome shows "This page has been blocked by Chrome" when a page tries to render its built-in PDF
viewer inside a doubly-nested iframe (e.g. the app is itself embedded in a canvas/webview preview
iframe, and the app then nests another iframe pointing at a PDF file). No server-side headers
(X-Frame-Options/CSP) need to be present for this to happen — it's a Chrome-side restriction tied
to nested iframe sandboxing of the PDF viewer plugin.

**Why:** Observed in LibraTech's Digital Resource detail page preview panel.

**How to apply:** Don't rely on `<iframe src="...pdf">` (or `<embed>`/`<object>` with the PDF
viewer) for in-page PDF preview when the app may run inside another iframe. Instead, show a
preview card with an explicit "Open in new tab" button (`window.open(url, "_blank")`), which is
unaffected by the nesting restriction. Image previews are unaffected and can stay inline.
