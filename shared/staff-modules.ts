type StaffModuleDefinition = { id: string; label: string; href: string; adminOnly?: boolean };

export const STAFF_MODULES: readonly StaffModuleDefinition[] = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "libraries", label: "Libraries", href: "/libraries" },
  { id: "catalog", label: "Catalog", href: "/catalog" },
  { id: "digital-resources", label: "Digital Resources", href: "/digital-resources" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "transfers", label: "Transfers", href: "/transfers" },
  { id: "allocations", label: "Allocations", href: "/allocations", adminOnly: true },
  { id: "circulation", label: "Circulation", href: "/circulation" },
  { id: "reservations", label: "Reservations", href: "/reservations" },
  { id: "lost-damaged", label: "Lost & Damaged", href: "/lost-damaged" },
  { id: "fines", label: "Fines", href: "/circulation/pending-fines" },
  { id: "patrons", label: "Patrons", href: "/users" },
  { id: "organizations", label: "Organizations", href: "/organizations" },
  { id: "reports", label: "Reports", href: "/reports" },
  { id: "audit-logs", label: "Audit Logs", href: "/audit-logs" },
  { id: "messages", label: "Messages", href: "/messages" },
] as const;

export type StaffModuleId = typeof STAFF_MODULES[number]["id"];

export function moduleForPath(path: string): StaffModuleId | null {
  const match = [...STAFF_MODULES]
    .filter(module => module.href !== "/")
    .sort((a, b) => b.href.length - a.href.length)
    .find(module => path === module.href || path.startsWith(`${module.href}/`));
  if (match) return match.id;
  return path === "/" ? "dashboard" : null;
}

const API_MODULE_PREFIXES: Array<[string, StaffModuleId]> = [
  ["/api/dashboard", "dashboard"], ["/api/stats", "dashboard"],
  ["/api/books", "catalog"], ["/api/catalog", "catalog"], ["/api/search-attributes", "catalog"],
  ["/api/categories", "catalog"], ["/api/resource-types", "catalog"], ["/api/z3950", "catalog"],
  ["/api/book-copies", "inventory"], ["/api/book-copy-identifiers", "inventory"],
  ["/api/inventory", "inventory"], ["/api/inventory-items", "inventory"], ["/api/inventory-import", "inventory"],
  ["/api/digital-resources", "digital-resources"],
  ["/api/circulation", "circulation"], ["/api/circulations", "circulation"], ["/api/checkout", "circulation"],
  ["/api/returns", "circulation"], ["/api/loans", "circulation"], ["/api/circulation-policy", "circulation"],
  ["/api/fines", "fines"], ["/api/pending-fines", "fines"], ["/api/waiver-requests", "fines"],
  ["/api/fine-waiver-requests", "fines"], ["/api/payment-methods", "fines"],
  ["/api/reservations", "reservations"], ["/api/transfers", "transfers"], ["/api/book-transfers", "transfers"],
  ["/api/users", "patrons"],
  ["/api/libraries", "libraries"], ["/api/library-memberships", "libraries"],
  ["/api/library-access-requests", "libraries"],
  ["/api/organizations", "organizations"], ["/api/org-units", "organizations"],
  ["/api/reports", "reports"], ["/api/circulation-report", "reports"],
  ["/api/audit-logs", "audit-logs"], ["/api/audit-sessions", "audit-logs"],
  ["/api/audit", "audit-logs"], ["/api/messages", "messages"], ["/api/notifications", "messages"],
  ["/api/allocations", "allocations"], ["/api/staff-allocations", "allocations"],
  ["/api/staff-allocation-logs", "allocations"], ["/api/lost-damaged", "lost-damaged"],
];

export function moduleForApiPath(path: string): StaffModuleId | null {
  return API_MODULE_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}
