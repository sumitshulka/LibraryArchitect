// Inject the session id from localStorage into every same-origin /api request.
// This allows authentication to work in third-party iframe contexts (like Replit's
// preview) where browsers block cross-site cookies even with SameSite=None.

const originalFetch = window.fetch.bind(window);

window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  let url = "";
  if (typeof input === "string") url = input;
  else if (input instanceof URL) url = input.toString();
  else if (input instanceof Request) url = input.url;

  const isApi =
    url.startsWith("/api") ||
    url.startsWith(window.location.origin + "/api");

  if (!isApi) return originalFetch(input, init);

  const sid = localStorage.getItem("session_id");
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  if (sid && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${sid}`);
  }

  const nextInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  };
  return originalFetch(input, nextInit);
}) as typeof window.fetch;
