import type { Book, User, Circulation, Inventory, SystemConfig, ResourceType, Category, ErpIntegration, ErpWhitelist, OrgUnit, Library, BookCopy, BookTransfer, LibraryMembership, AuditLog, DigitalResource, DigitalResourceVersion } from "@shared/schema";

const API_BASE = "/api";

export type BookWithSearchAttributes = Book & {
  searchAttributes: { attributeValueId: number; attributeValue: string; attributeTypeName: string; attributeTypeId: number }[];
};

// Books API
export const booksApi = {
  getAll: async (search?: string, attributeValueIds?: number[]): Promise<BookWithSearchAttributes[]> => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (attributeValueIds && attributeValueIds.length > 0) {
      params.set("attributeValueIds", attributeValueIds.join(","));
    }
    const qs = params.toString();
    const url = qs ? `${API_BASE}/books?${qs}` : `${API_BASE}/books`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch books");
    return res.json();
  },

  getById: async (id: number): Promise<Book> => {
    const res = await fetch(`${API_BASE}/books/${id}`);
    if (!res.ok) throw new Error("Failed to fetch book");
    return res.json();
  },

  create: async (book: Omit<Book, "id" | "createdAt" | "acquisitionDate"> & { quantity?: number; acquisitionDate?: string | Date | null }): Promise<Book> => {
    const res = await fetch(`${API_BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create book");
    }
    return res.json();
  },

  update: async (id: number, book: Partial<Book>): Promise<Book> => {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
    });
    if (!res.ok) throw new Error("Failed to update book");
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete book");
    }
  },

  getDashboard: async (id: number): Promise<BookDashboard> => {
    const res = await fetch(`${API_BASE}/books/${id}/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch book dashboard");
    return res.json();
  },

  addCopies: async (
    id: number,
    purchase: {
      quantity: number;
      acquisitionDate?: string | null;
      acquisitionSource?: string | null;
      unitPrice?: number | null;
      shelfLocation?: string | null;
    },
  ): Promise<{ book: Book; copiesCreated: number }> => {
    const res = await fetch(`${API_BASE}/books/${id}/copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(purchase),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add book copies");
    }
    return res.json();
  },
};

// Book Dashboard types
export interface BookLibraryAllocation {
  libraryId: number;
  libraryName: string;
  libraryCode: string;
  total: number;
  available: number;
  checkedOut: number;
  reserved: number;
  damaged: number;
  lost: number;
  inTransit: number;
}

export interface BookFinancials {
  totalFinesCollected: number;
  totalFinesOutstanding: number;
  totalFinesWaived: number;
  totalAcquisitionCost: number;
}

export interface AcquisitionHistoryEntry {
  date: string | null;
  source: string | null;
  cost: number;
  quantity: number;
}

export interface BookDashboard {
  book: Book;
  totalCopies: number;
  libraryAllocations: BookLibraryAllocation[];
  recentCirculation: Circulation[];
  financials: BookFinancials;
  acquisitionHistory: AcquisitionHistoryEntry[];
}

export interface CopyReviewerHistoryEntry extends Circulation {
  userName: string;
  userEmail: string;
  libraryName: string | null;
  accruedFine: number;
  fineOutstanding: number;
  damageOutstanding: number;
  daysOverdue: number;
  isOverdue: boolean;
}

export interface BookCopyReviewerDetails {
  book: Book;
  copy: BookCopy;
  library: Library | null;
  history: CopyReviewerHistoryEntry[];
}

// Users API
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  getByCategory: async (category: 'STAFF' | 'PATRON'): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users?category=${category}`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  getById: async (id: number): Promise<User> => {
    const res = await fetch(`${API_BASE}/users/${id}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },

  create: async (user: Omit<User, "id" | "joinedDate">): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create user");
    }
    return res.json();
  },

  update: async (id: number, user: Partial<User>): Promise<User> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error("Failed to update user");
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete user");
  },
};

// Resource Types API
export const resourceTypesApi = {
  getAll: async (): Promise<ResourceType[]> => {
    const res = await fetch(`${API_BASE}/resource-types`);
    if (!res.ok) throw new Error("Failed to fetch resource types");
    return res.json();
  },

  getActive: async (): Promise<ResourceType[]> => {
    const res = await fetch(`${API_BASE}/resource-types?active=true`);
    if (!res.ok) throw new Error("Failed to fetch active resource types");
    return res.json();
  },

  getById: async (id: number): Promise<ResourceType> => {
    const res = await fetch(`${API_BASE}/resource-types/${id}`);
    if (!res.ok) throw new Error("Failed to fetch resource type");
    return res.json();
  },

  create: async (type: Omit<ResourceType, "id" | "createdAt">): Promise<ResourceType> => {
    const res = await fetch(`${API_BASE}/resource-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(type),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create resource type");
    }
    return res.json();
  },

  update: async (id: number, type: Partial<ResourceType>): Promise<ResourceType> => {
    const res = await fetch(`${API_BASE}/resource-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(type),
    });
    if (!res.ok) throw new Error("Failed to update resource type");
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/resource-types/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete resource type");
  },
};

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error("Failed to fetch categories");
    return res.json();
  },

  getActive: async (): Promise<Category[]> => {
    const res = await fetch(`${API_BASE}/categories?active=true`);
    if (!res.ok) throw new Error("Failed to fetch active categories");
    return res.json();
  },

  getById: async (id: number): Promise<Category> => {
    const res = await fetch(`${API_BASE}/categories/${id}`);
    if (!res.ok) throw new Error("Failed to fetch category");
    return res.json();
  },

  create: async (category: Omit<Category, "id" | "createdAt">): Promise<Category> => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create category");
    }
    return res.json();
  },

  update: async (id: number, category: Partial<Category>): Promise<Category> => {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });
    if (!res.ok) throw new Error("Failed to update category");
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete category");
  },
};

// Z39.50 Search API
export interface Z3950SearchResult {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  year: string;
  source: string;
  category: string;
}

export const z3950Api = {
  search: async (query: string, server?: string): Promise<Z3950SearchResult[]> => {
    const res = await fetch(`${API_BASE}/z3950/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, server }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Failed to perform live catalog search");
    }
    return res.json();
  },
};

// Circulation API
export interface PaymentSplit {
  paymentMethodId: number;
  amount: number;
  paymentType: 'FINE' | 'DAMAGE';
  referenceNumber?: string;
  notes?: string;
}

export interface ReturnPayload {
  damageCost?: number;
  damageNotes?: string;
  payments?: PaymentSplit[];
  waiveFineAmount?: number;
  waiveDamageAmount?: number;
  waiveReason?: string;
}

export interface ReturnBatchResult {
  succeeded: Array<{ circulationId: number; circulation: Circulation }>;
  failed: Array<{ circulationId: number; error: string }>;
}

export interface FinePreview {
  assessedFineCents: number;
  finePaid: number;
  fineWaived: number;
  fineOutstanding: number;
  damageCost: number;
  damagePaid: number;
  damageWaived: number;
  damageOutstanding: number;
  daysOverdue: number;
  isOverdue: boolean;
  totalOutstanding: number;
  bookUnitPrice: number | null;
  payments: any[];
}

export interface PendingFineCirculation {
  circulationId: number;
  bookId: number;
  bookTitle: string;
  bookIsbn: string | null;
  libraryId: number | null;
  libraryName: string | null;
  checkoutDate: string;
  dueDate: string;
  returnDate: string | null;
  fineAmount: number;
  finePaidAmount: number;
  fineWaivedAmount: number;
  fineOutstandingCents: number;
  damageCost: number;
  damagePaidAmount: number;
  damageWaivedAmount: number;
  damageOutstandingCents: number;
  fineStatus: string | null;
  damageStatus: string | null;
  totalOutstandingCents: number;
}

export interface PendingFineUser {
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  membershipId: string | null;
  totalOutstandingCents: number;
  circulations: PendingFineCirculation[];
}

export interface CirculationListRecord extends Circulation {
  bookTitle: string | null;
  bookAuthor: string | null;
  bookIsbn: string | null;
  copySSN: string | null;
  copyInternalSSN: string | null;
  copyUserDefinedSSN: string | null;
  copyBarcode: string | null;
  libraryName: string | null;
  accruedFine?: number;
  daysOverdue?: number;
  isOverdue?: boolean;
  fineOutstanding?: number;
  damageOutstanding?: number;
}

export const pendingFinesApi = {
  getAll: async (filters?: { libraryId?: number; search?: string }): Promise<{ users: PendingFineUser[]; total: number; grandTotalCents: number }> => {
    const params = new URLSearchParams();
    if (filters?.libraryId) params.set("libraryId", String(filters.libraryId));
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    const res = await fetch(`/api/circulation/pending-fines${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Failed to fetch pending fines");
    return res.json();
  },
};

export const circulationApi = {
  getAll: async (userId?: number, enrich = false): Promise<CirculationListRecord[]> => {
    const params = new URLSearchParams();
    if (userId) params.set("userId", String(userId));
    if (enrich) params.set("enrich", "true");
    const url = `${API_BASE}/circulation${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch circulation records");
    return res.json();
  },

  lookupBook: async (identifier: string): Promise<{ book: Book; copy: BookCopy | null }> => {
    const res = await fetch(`${API_BASE}/circulation/book-lookup?identifier=${encodeURIComponent(identifier)}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "No book found with that ISBN, SSN, or barcode");
    }
    return res.json();
  },

  checkout: async (data: { bookId: number; userId: number; dueDate: Date; bookCopyId?: number; libraryId?: number }): Promise<Circulation> => {
    const res = await fetch(`${API_BASE}/circulation/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to checkout book");
    }
    return res.json();
  },

  checkoutMany: async (items: { bookId: number; userId: number; dueDate: Date; bookCopyId?: number; libraryId?: number }[]): Promise<Circulation[]> => {
    const res = await fetch(`${API_BASE}/circulation/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to checkout books");
    }
    return res.json();
  },

  returnBook: async (id: number, payload: ReturnPayload = {}): Promise<Circulation> => {
    const res = await fetch(`${API_BASE}/circulation/${id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to return book");
    }
    return res.json();
  },

  returnMany: async (circulationIds: number[]): Promise<ReturnBatchResult> => {
    const res = await fetch(`${API_BASE}/circulation/return-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circulationIds }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to return books");
    }
    return res.json();
  },

  finePreview: async (id: number): Promise<FinePreview> => {
    const res = await fetch(`${API_BASE}/circulation/${id}/fine-preview`);
    if (!res.ok) throw new Error("Failed to fetch fine preview");
    return res.json();
  },

  collectFine: async (id: number, payload: ReturnPayload): Promise<Circulation> => {
    const res = await fetch(`${API_BASE}/circulation/${id}/collect-fine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to collect fine");
    }
    return res.json();
  },
};

export interface PaymentMethodApi {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  sortOrder?: number | null;
}

export const paymentMethodsApi = {
  getAll: async (activeOnly = false): Promise<PaymentMethodApi[]> => {
    const url = `${API_BASE}/payment-methods${activeOnly ? "?active=true" : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch payment methods");
    return res.json();
  },
  create: async (data: { name: string; code: string; description?: string; isActive?: boolean; sortOrder?: number }): Promise<PaymentMethodApi> => {
    const res = await fetch(`${API_BASE}/payment-methods`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to create payment method"); }
    return res.json();
  },
  update: async (id: number, data: Partial<{ name: string; code: string; description: string; isActive: boolean; sortOrder: number }>): Promise<PaymentMethodApi> => {
    const res = await fetch(`${API_BASE}/payment-methods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to update payment method"); }
    return res.json();
  },
  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/payment-methods/${id}`, { method: "DELETE" });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to delete payment method"); }
  },
};

export const fineWaiverRequestsApi = {
  getAll: async (status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<any[]> => {
    const url = `${API_BASE}/fine-waiver-requests${status ? `?status=${status}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch waiver requests");
    return res.json();
  },
  approve: async (id: number, reviewNotes?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/fine-waiver-requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewNotes }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to approve"); }
    return res.json();
  },
  reject: async (id: number, reviewNotes?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/fine-waiver-requests/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewNotes }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to reject"); }
    return res.json();
  },
};

export interface ReservationApi {
  id: number;
  userId: number;
  bookId: number;
  bookCopyId: number | null;
  libraryId: number;
  reservedFor: string;
  expiresAt: string;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  notes: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  fulfilledAt?: string | null;
  fulfilledCirculationId?: number | null;
  // enrichment
  bookTitle?: string;
  bookAuthor?: string;
  userName?: string;
  userEmail?: string;
  userIdentifier?: string;
  libraryName?: string;
  copyBarcode?: string;
  copySSN?: string | null;
}

export const reservationsApi = {
  list: async (filters: { userId?: number; libraryId?: number; bookId?: number; status?: string; fromDate?: string; toDate?: string } = {}): Promise<ReservationApi[]> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });
    const res = await fetch(`${API_BASE}/reservations?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch reservations");
    return res.json();
  },
  create: async (data: { userId?: number; items: { bookId: number; libraryId: number; reservedFor?: string; notes?: string }[] }): Promise<{ created: ReservationApi[]; failed: any[] }> => {
    const res = await fetch(`${API_BASE}/reservations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to create reservation"); }
    return res.json();
  },
  cancel: async (id: number, reason?: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/reservations/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to cancel"); }
  },
  forBook: async (bookId: number, libraryId?: number): Promise<ReservationApi[]> => {
    const url = `${API_BASE}/books/${bookId}/reservations${libraryId ? `?libraryId=${libraryId}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch book reservations");
    return res.json();
  },
  initiatePickup: async (data: { reservationIds: number[]; userIdentifier: string }): Promise<{ pickupId: number; expiresAt: string; maskedEmail: string; reservationCount: number }> => {
    const res = await fetch(`${API_BASE}/reservations/pickup/initiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to initiate pickup"); }
    return res.json();
  },
  confirmPickup: async (data: { pickupId: number; otp: string }): Promise<{ success: boolean; circulations: any[] }> => {
    const res = await fetch(`${API_BASE}/reservations/pickup/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to confirm pickup"); }
    return res.json();
  },
};

export const finesReportApi = {
  get: async (filters: { from?: string; to?: string; libraryId?: number; methodId?: number; type?: 'FINE' | 'DAMAGE'; userId?: number } = {}): Promise<any> => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.libraryId) params.set("libraryId", String(filters.libraryId));
    if (filters.methodId) params.set("methodId", String(filters.methodId));
    if (filters.type) params.set("type", filters.type);
    if (filters.userId) params.set("userId", String(filters.userId));
    const res = await fetch(`${API_BASE}/reports/fines-revenue?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch fines report");
    return res.json();
  },
};

export const circulationReportApi = {
  get: async (filters: { from?: string; to?: string; libraryId?: number; status?: string; userId?: number } = {}): Promise<any> => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.libraryId) params.set("libraryId", String(filters.libraryId));
    if (filters.status) params.set("status", filters.status);
    if (filters.userId) params.set("userId", String(filters.userId));
    const res = await fetch(`${API_BASE}/reports/circulation?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch circulation report");
    return res.json();
  },
};

export const acquisitionsReportApi = {
  get: async (filters: { from?: string; to?: string; libraryId?: number; source?: string; category?: string; status?: string; condition?: string; format?: string; q?: string } = {}): Promise<any> => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.libraryId) params.set("libraryId", String(filters.libraryId));
    if (filters.source) params.set("source", filters.source);
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.format) params.set("format", filters.format);
    if (filters.q) params.set("q", filters.q);
    const res = await fetch(`${API_BASE}/reports/acquisitions?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch acquisitions report");
    return res.json();
  },
};

// Inventory API
export const inventoryApi = {
  getBySession: async (sessionId: string): Promise<Inventory[]> => {
    const res = await fetch(`${API_BASE}/inventory?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error("Failed to fetch inventory records");
    return res.json();
  },

  create: async (data: Omit<Inventory, "id" | "createdAt">): Promise<Inventory> => {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create inventory record");
    return res.json();
  },

  update: async (id: number, data: Partial<Inventory>): Promise<Inventory> => {
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update inventory record");
    return res.json();
  },
};

// System Config API
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {}
  return fallback;
}

export const configApi = {
  getAll: async (): Promise<SystemConfig[]> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch configuration"));
    return res.json();
  },

  set: async (data: Omit<SystemConfig, "id" | "updatedAt">): Promise<SystemConfig> => {
    const res = await fetch(`${API_BASE}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to set configuration"));
    return res.json();
  },
};

export interface CirculationPolicy {
  finePerDay?: number;
  gracePeriodDays?: number;
  maxFineCap?: number;
  loanPeriodDays?: number;
  maxBooksPerUser?: number;
  renewalLimit?: number;
  reservationDays?: number;
  allowRenewals?: boolean;
  enableLateFines?: boolean;
}

export type FineCalculationMode = "LOCK_TO_DUE_DATE" | "SEGMENT_PER_DAY";

export interface CirculationPolicyVersion {
  id: number;
  scope: "GLOBAL" | "LIBRARY";
  libraryId: number | null;
  policy: CirculationPolicy;
  effectiveFrom: string;
  reason: string;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
}

export const circulationPolicyApi = {
  get: async (): Promise<CirculationPolicy> => {
    const res = await fetch(`${API_BASE}/circulation-policy`);
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch circulation policy"));
    return res.json();
  },
  update: async (payload: { policy: CirculationPolicy; reason: string; effectiveFrom?: string }): Promise<CirculationPolicy> => {
    const res = await fetch(`${API_BASE}/circulation-policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to save circulation policy"));
    return res.json();
  },
  history: async (params: { scope: "GLOBAL" | "LIBRARY"; libraryId?: number; limit?: number }): Promise<CirculationPolicyVersion[]> => {
    const q = new URLSearchParams();
    q.set("scope", params.scope);
    if (params.libraryId !== undefined) q.set("libraryId", String(params.libraryId));
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    const res = await fetch(`${API_BASE}/circulation-policy/history?${q.toString()}`);
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch policy history"));
    return res.json();
  },
};

export const fineCalculationModeApi = {
  get: async (): Promise<{ mode: FineCalculationMode }> => {
    const res = await fetch(`${API_BASE}/fine-calculation-mode`);
    if (!res.ok) throw new Error(await readError(res, "Failed to fetch fine calculation mode"));
    return res.json();
  },
  update: async (mode: FineCalculationMode): Promise<{ mode: FineCalculationMode }> => {
    const res = await fetch(`${API_BASE}/fine-calculation-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to save fine calculation mode"));
    return res.json();
  },
};

// Dashboard Stats API
export interface DashboardStats {
  totalBooks: number;
  availableBooks: number;
  checkedOutBooks: number;
  activeMembers: number;
  activeCirculation: number;
  overdueItems: number;
  totalFines: number;
}

export const statsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE}/stats/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch dashboard statistics");
    return res.json();
  },
};

// ERP Integration types (without sensitive fields)
export type ErpIntegrationPublic = Omit<ErpIntegration, "secretHash" | "secretSalt">;

export interface ErpCredentials {
  appId: string;
  secretKey: string;
  note: string;
  rotatedAt?: string;
}

export interface ErpIntegrationWithCredentials extends ErpIntegrationPublic {
  credentials: ErpCredentials;
}

// ERP Integration API
export const erpIntegrationsApi = {
  getAll: async (): Promise<ErpIntegrationPublic[]> => {
    const res = await fetch(`${API_BASE}/erp-integrations`);
    if (!res.ok) throw new Error("Failed to fetch ERP integrations");
    return res.json();
  },

  getById: async (id: number): Promise<ErpIntegrationPublic> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${id}`);
    if (!res.ok) throw new Error("Failed to fetch ERP integration");
    return res.json();
  },

  create: async (data: {
    name: string;
    erpType: string;
    connectionMode?: "HOST" | "CLIENT" | "BIDIRECTIONAL";
    outboundBaseUrl?: string | null;
    description?: string | null;
    isActive?: boolean;
  }): Promise<ErpIntegrationWithCredentials> => {
    const res = await fetch(`${API_BASE}/erp-integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create ERP integration");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<{
    name: string;
    erpType: string;
    connectionMode: "HOST" | "CLIENT" | "BIDIRECTIONAL";
    outboundBaseUrl: string | null;
    description: string | null;
    isActive: boolean;
  }>): Promise<ErpIntegrationPublic> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update ERP integration");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete ERP integration");
    }
  },

  rotateSecret: async (id: number): Promise<{ message: string; credentials: ErpCredentials }> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${id}/rotate-secret`, {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to rotate secret");
    }
    return res.json();
  },

  getWhitelist: async (integrationId: number): Promise<ErpWhitelist[]> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/whitelist`);
    if (!res.ok) throw new Error("Failed to fetch whitelist");
    return res.json();
  },

  addWhitelist: async (integrationId: number, data: {
    urlPattern: string;
    description?: string | null;
    isActive?: boolean;
  }): Promise<ErpWhitelist> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/whitelist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add whitelist entry");
    }
    return res.json();
  },

  updateWhitelist: async (integrationId: number, id: number, data: Partial<{
    urlPattern: string;
    description: string | null;
    isActive: boolean;
  }>): Promise<ErpWhitelist> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/whitelist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update whitelist entry");
    }
    return res.json();
  },

  deleteWhitelist: async (integrationId: number, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/whitelist/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete whitelist entry");
    }
  },

  // Outbound Auth Config
  updateAuthConfig: async (integrationId: number, data: {
    authLoginUrl?: string | null;
    authClientSecret?: string | null;
    authTokenTtlSeconds?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/auth-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update auth configuration");
    }
    return res.json();
  },

  testConnection: async (integrationId: number): Promise<{ success: boolean; message: string; tokenExpiry?: string }> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/test-connection`, {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Connection test failed");
    }
    return res.json();
  },

  lookupUser: async (integrationId: number, userType: 'student' | 'faculty', identifier: string): Promise<{
    success: boolean;
    userType: string;
    identifier: string;
    details: Record<string, any>;
  }> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/lookup/${userType}/${identifier}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "User lookup failed");
    }
    return res.json();
  },

  // Pull Endpoints
  getPullEndpoints: async (integrationId: number): Promise<ErpPullEndpoint[]> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/pull-endpoints`);
    if (!res.ok) throw new Error("Failed to fetch pull endpoints");
    return res.json();
  },

  getPullEndpoint: async (integrationId: number, id: number): Promise<ErpPullEndpoint> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/pull-endpoints/${id}`);
    if (!res.ok) throw new Error("Failed to fetch pull endpoint");
    return res.json();
  },

  createPullEndpoint: async (integrationId: number, data: {
    name: string;
    endpointType: string;
    urlPath: string;
    httpMethod?: string;
    requestHeaders?: Record<string, unknown> | null;
    requestBodyTemplate?: Record<string, unknown> | null;
    pathParameters?: Record<string, unknown> | null;
    queryParameters?: Record<string, unknown> | null;
    responseRootPath?: string | null;
    paginationConfig?: Record<string, unknown> | null;
    isActive?: boolean;
    description?: string | null;
  }): Promise<ErpPullEndpoint> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/pull-endpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create pull endpoint");
    }
    return res.json();
  },

  updatePullEndpoint: async (integrationId: number, id: number, data: Partial<{
    name: string;
    endpointType: string;
    urlPath: string;
    httpMethod: string;
    requestHeaders: Record<string, unknown> | null;
    requestBodyTemplate: Record<string, unknown> | null;
    pathParameters: Record<string, unknown> | null;
    queryParameters: Record<string, unknown> | null;
    responseRootPath: string | null;
    paginationConfig: Record<string, unknown> | null;
    isActive: boolean;
    description: string | null;
  }>): Promise<ErpPullEndpoint> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/pull-endpoints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update pull endpoint");
    }
    return res.json();
  },

  deletePullEndpoint: async (integrationId: number, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/erp-integrations/${integrationId}/pull-endpoints/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete pull endpoint");
    }
  },

  testPullEndpoint: async (endpointId: number): Promise<ErpTestResult> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/test`, {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to test endpoint");
    }
    return res.json();
  },

  getTestLogs: async (endpointId: number, limit?: number): Promise<ErpTestLog[]> => {
    const url = limit 
      ? `${API_BASE}/erp-pull-endpoints/${endpointId}/test-logs?limit=${limit}`
      : `${API_BASE}/erp-pull-endpoints/${endpointId}/test-logs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch test logs");
    return res.json();
  },

  // Field Mappings
  getFieldMappings: async (endpointId: number): Promise<ErpFieldMapping[]> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/field-mappings`);
    if (!res.ok) throw new Error("Failed to fetch field mappings");
    return res.json();
  },

  createFieldMapping: async (endpointId: number, data: {
    sourceField: string;
    targetField: string;
    targetTable: string;
    transformationType?: string | null;
    transformationConfig?: Record<string, unknown> | null;
    isRequired?: boolean;
    defaultValue?: string | null;
    description?: string | null;
    sortOrder?: number;
  }): Promise<ErpFieldMapping> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/field-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create field mapping");
    }
    return res.json();
  },

  bulkCreateFieldMappings: async (endpointId: number, data: {
    mappings: Array<{
      sourceField: string;
      targetField: string;
      targetTable: string;
      transformationType?: string | null;
      transformationConfig?: Record<string, unknown> | null;
      isRequired?: boolean;
      defaultValue?: string | null;
      description?: string | null;
      sortOrder?: number;
    }>;
    replaceExisting?: boolean;
  }): Promise<ErpFieldMapping[]> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/field-mappings/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to bulk create field mappings");
    }
    return res.json();
  },

  updateFieldMapping: async (endpointId: number, id: number, data: Partial<{
    sourceField: string;
    targetField: string;
    targetTable: string;
    transformationType: string | null;
    transformationConfig: Record<string, unknown> | null;
    isRequired: boolean;
    defaultValue: string | null;
    description: string | null;
    sortOrder: number;
  }>): Promise<ErpFieldMapping> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/field-mappings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update field mapping");
    }
    return res.json();
  },

  deleteFieldMapping: async (endpointId: number, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/erp-pull-endpoints/${endpointId}/field-mappings/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete field mapping");
    }
  },
};

// ERP Types
export interface ErpPullEndpoint {
  id: number;
  integrationId: number;
  name: string;
  endpointType: string;
  httpMethod: string;
  urlPath: string;
  description: string | null;
  requestHeaders: Record<string, unknown> | null;
  requestBodyTemplate: Record<string, unknown> | null;
  pathParameters: Record<string, unknown> | null;
  queryParameters: Record<string, unknown> | null;
  responseRootPath: string | null;
  paginationConfig: Record<string, unknown> | null;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErpFieldMapping {
  id: number;
  endpointId: number;
  sourceField: string;
  targetField: string;
  targetTable: string;
  transformationType: string | null;
  transformationConfig: Record<string, unknown> | null;
  isRequired: boolean;
  defaultValue: string | null;
  description: string | null;
  sortOrder: number | null;
  createdAt: string;
}

export interface ErpTestLog {
  id: number;
  endpointId: number;
  testedBy: number | null;
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, unknown> | null;
  requestBody: Record<string, unknown> | null;
  responseStatus: number | null;
  responseHeaders: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  status: string;
  errorMessage: string | null;
  responseTimeMs: number | null;
  createdAt: string;
}

export interface ErpTestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  responseTimeMs: number;
  error?: string;
  log: ErpTestLog;
}

// Organizational Units API
export const orgUnitsApi = {
  getAll: async (): Promise<OrgUnit[]> => {
    const res = await fetch(`${API_BASE}/org-units`);
    if (!res.ok) throw new Error("Failed to fetch organizational units");
    return res.json();
  },

  getByParent: async (parentId: number | null): Promise<OrgUnit[]> => {
    const param = parentId === null ? 'null' : parentId.toString();
    const res = await fetch(`${API_BASE}/org-units?parentId=${param}`);
    if (!res.ok) throw new Error("Failed to fetch organizational units");
    return res.json();
  },

  getByType: async (type: string): Promise<OrgUnit[]> => {
    const res = await fetch(`${API_BASE}/org-units?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error("Failed to fetch organizational units");
    return res.json();
  },

  getById: async (id: number): Promise<OrgUnit> => {
    const res = await fetch(`${API_BASE}/org-units/${id}`);
    if (!res.ok) throw new Error("Failed to fetch organizational unit");
    return res.json();
  },

  create: async (data: Omit<OrgUnit, "id" | "createdAt" | "updatedAt">): Promise<OrgUnit> => {
    const res = await fetch(`${API_BASE}/org-units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create organizational unit");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Omit<OrgUnit, "id" | "createdAt" | "updatedAt">>): Promise<OrgUnit> => {
    const res = await fetch(`${API_BASE}/org-units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update organizational unit");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/org-units/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete organizational unit");
    }
  },
};

// Libraries API
export const librariesApi = {
  getAll: async (): Promise<Library[]> => {
    const res = await fetch(`${API_BASE}/libraries`);
    if (!res.ok) throw new Error("Failed to fetch libraries");
    return res.json();
  },

  getActive: async (): Promise<Library[]> => {
    const res = await fetch(`${API_BASE}/libraries?active=true`);
    if (!res.ok) throw new Error("Failed to fetch active libraries");
    return res.json();
  },

  getByOrgUnit: async (orgUnitId: number): Promise<Library[]> => {
    const res = await fetch(`${API_BASE}/libraries?orgUnitId=${orgUnitId}`);
    if (!res.ok) throw new Error("Failed to fetch libraries");
    return res.json();
  },

  getById: async (id: number): Promise<Library> => {
    const res = await fetch(`${API_BASE}/libraries/${id}`);
    if (!res.ok) throw new Error("Failed to fetch library");
    return res.json();
  },

  create: async (data: Omit<Library, "id" | "createdAt" | "updatedAt">): Promise<Library> => {
    const res = await fetch(`${API_BASE}/libraries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create library");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Omit<Library, "id" | "createdAt" | "updatedAt">>): Promise<Library> => {
    const res = await fetch(`${API_BASE}/libraries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update library");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/libraries/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete library");
    }
  },

  getDashboard: async (id: number): Promise<LibraryDashboardStats> => {
    const res = await fetch(`${API_BASE}/libraries/${id}/dashboard`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch library dashboard");
    }
    return res.json();
  },

  getStaff: async (id: number): Promise<LibraryStaffMember[]> => {
    const res = await fetch(`${API_BASE}/libraries/${id}/staff`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch library staff");
    }
    return res.json();
  },

  getResources: async (id: number, params?: {
    query?: string;
    format?: string;
    category?: string;
    status?: string;
    attributeValueIds?: number[];
    limit?: number;
    offset?: number;
  }): Promise<LibraryResourcesResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('query', params.query);
    if (params?.format) searchParams.set('format', params.format);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.attributeValueIds && params.attributeValueIds.length > 0) {
      searchParams.set('attributeValueIds', params.attributeValueIds.join(','));
    }
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    
    const queryString = searchParams.toString();
    const url = `${API_BASE}/libraries/${id}/resources${queryString ? '?' + queryString : ''}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch library resources");
    }
    return res.json();
  },
};

export interface LibraryResourceStats {
  bookId: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedYear: number | null;
  category: string;
  format: string;
  coverUrl: string | null;
  searchAttributes: {
    attributeValueId: number;
    attributeValue: string;
    attributeTypeName: string;
    attributeTypeId: number;
  }[];
  totalCopies: number;
  available: number;
  checkedOut: number;
  reserved: number;
  damaged: number;
  lost: number;
  inTransit: number;
}

export interface LibraryResourcesResponse {
  resources: LibraryResourceStats[];
  total: number;
  categories: string[];
}

export interface LibraryDashboardStats {
  libraryId: number;
  libraryName: string;
  libraryCode: string;
  orgUnitName: string | null;
  
  totalCopies: number;
  physicalBooks: number;
  ebooks: number;
  audiobooks: number;
  
  availableCopies: number;
  checkedOutCopies: number;
  lostCopies: number;
  damagedCopies: number;
  inTransitCopies: number;
  reservedCopies: number;
  
  activeCirculations: number;
  overdueItems: number;
  
  totalFinesOutstanding: number;
  totalFinesPaid: number;
  totalFinesWaived: number;
  
  pendingTransfersIn: number;
  pendingTransfersOut: number;
  
  totalMembers: number;
}

export interface LibraryStaffMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  allocatedAt: string;
}

// Book Copies API
export const bookCopiesApi = {
  getByBook: async (bookId: number): Promise<BookCopy[]> => {
    const res = await fetch(`${API_BASE}/book-copies?bookId=${bookId}`);
    if (!res.ok) throw new Error("Failed to fetch book copies");
    return res.json();
  },

  getByLibrary: async (libraryId: number): Promise<BookCopy[]> => {
    const res = await fetch(`${API_BASE}/book-copies?libraryId=${libraryId}`);
    if (!res.ok) throw new Error("Failed to fetch book copies");
    return res.json();
  },

  getByBookAndLibrary: async (bookId: number, libraryId: number): Promise<BookCopy[]> => {
    const res = await fetch(`${API_BASE}/book-copies?bookId=${bookId}&libraryId=${libraryId}`);
    if (!res.ok) throw new Error("Failed to fetch book copies");
    return res.json();
  },

  getCirculationHistory: async (copyId: number): Promise<Circulation[]> => {
    const res = await fetch(`${API_BASE}/book-copies/${copyId}/circulation-history`);
    if (!res.ok) throw new Error("Failed to fetch circulation history");
    return res.json();
  },

  getReviewerDetails: async (copyId: number): Promise<BookCopyReviewerDetails> => {
    const res = await fetch(`${API_BASE}/book-copies/${copyId}/reviewer-details`);
    if (!res.ok) throw new Error("Failed to fetch book copy reviewer details");
    return res.json();
  },

  getById: async (id: number): Promise<BookCopy> => {
    const res = await fetch(`${API_BASE}/book-copies/${id}`);
    if (!res.ok) throw new Error("Failed to fetch book copy");
    return res.json();
  },

  getByBarcode: async (barcode: string): Promise<BookCopy> => {
    const res = await fetch(`${API_BASE}/book-copies/barcode/${encodeURIComponent(barcode)}`);
    if (!res.ok) throw new Error("Failed to fetch book copy");
    return res.json();
  },

  create: async (data: Omit<BookCopy, "id" | "createdAt" | "updatedAt">): Promise<BookCopy> => {
    const res = await fetch(`${API_BASE}/book-copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create book copy");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Omit<BookCopy, "id" | "createdAt" | "updatedAt">>): Promise<BookCopy> => {
    const res = await fetch(`${API_BASE}/book-copies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update book copy");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/book-copies/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete book copy");
    }
  },
};

// Book Transfers API
export const bookTransfersApi = {
  getPending: async (): Promise<BookTransfer[]> => {
    const res = await fetch(`${API_BASE}/book-transfers?status=PENDING`);
    if (!res.ok) throw new Error("Failed to fetch pending transfers");
    return res.json();
  },

  getBySourceLibrary: async (libraryId: number): Promise<BookTransfer[]> => {
    const res = await fetch(`${API_BASE}/book-transfers?sourceLibraryId=${libraryId}`);
    if (!res.ok) throw new Error("Failed to fetch book transfers");
    return res.json();
  },

  getByDestinationLibrary: async (libraryId: number): Promise<BookTransfer[]> => {
    const res = await fetch(`${API_BASE}/book-transfers?destinationLibraryId=${libraryId}`);
    if (!res.ok) throw new Error("Failed to fetch book transfers");
    return res.json();
  },

  getById: async (id: number): Promise<BookTransfer> => {
    const res = await fetch(`${API_BASE}/book-transfers/${id}`);
    if (!res.ok) throw new Error("Failed to fetch book transfer");
    return res.json();
  },

  create: async (data: Omit<BookTransfer, "id" | "requestDate" | "approvalDate" | "completionDate">): Promise<BookTransfer> => {
    const res = await fetch(`${API_BASE}/book-transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create book transfer");
    }
    return res.json();
  },

  updateStatus: async (id: number, data: { status: string; approvedBy?: number; notes?: string }): Promise<BookTransfer> => {
    const res = await fetch(`${API_BASE}/book-transfers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update book transfer");
    }
    return res.json();
  },
};

// Library Memberships API
export const libraryMembershipsApi = {
  getByUser: async (userId: number): Promise<LibraryMembership[]> => {
    const res = await fetch(`${API_BASE}/library-memberships?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch library memberships");
    return res.json();
  },

  getByLibrary: async (libraryId: number): Promise<LibraryMembership[]> => {
    const res = await fetch(`${API_BASE}/library-memberships?libraryId=${libraryId}`);
    if (!res.ok) throw new Error("Failed to fetch library memberships");
    return res.json();
  },

  create: async (data: Omit<LibraryMembership, "id" | "joinedAt">): Promise<LibraryMembership> => {
    const res = await fetch(`${API_BASE}/library-memberships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create library membership");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Omit<LibraryMembership, "id" | "joinedAt">>): Promise<LibraryMembership> => {
    const res = await fetch(`${API_BASE}/library-memberships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update library membership");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/library-memberships/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to delete library membership");
    }
  },
};

// Allocations API
export interface UnallocatedCopyInfo {
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  bookFormat: string;
  totalUnallocatedCopies: number;
  copies: {
    id: number;
    barcode: string;
    shelfLocation: string | null;
    status: string;
    createdAt: string;
  }[];
}

export interface AllocationResult {
  success: boolean;
  allocatedCount: number;
  copies: BookCopy[];
}

export const allocationsApi = {
  getUnallocated: async (): Promise<UnallocatedCopyInfo[]> => {
    const res = await fetch(`${API_BASE}/allocations/unallocated`);
    if (!res.ok) throw new Error("Failed to fetch unallocated copies");
    return res.json();
  },

  allocate: async (data: {
    copyIds: number[];
    libraryId: number;
    generateSSN: boolean;
    ssnPrefix?: string;
  }): Promise<AllocationResult> => {
    const res = await fetch(`${API_BASE}/allocations/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to allocate copies");
    }
    return res.json();
  },
};

// Staff Library Allocation API
export interface StaffAllocationLogWithDetails {
  id: number;
  staffUserId: number;
  libraryId: number;
  action: 'ALLOCATED' | 'DEALLOCATED';
  performedByUserId: number;
  reason: string | null;
  createdAt: string;
  staffUserName: string;
  staffUserRole: string;
  libraryName: string;
  performedByName: string;
}

export interface StaffAllocationWithLibrary {
  id: number;
  userId: number;
  libraryId: number;
  role: string;
  isPrimaryLibrary: boolean;
  joinedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  library?: {
    id: number;
    name: string;
    code: string;
  };
}

export const staffAllocationsApi = {
  getStaffAllocations: async (staffUserId: number): Promise<StaffAllocationWithLibrary[]> => {
    const res = await fetch(`${API_BASE}/staff-allocations/${staffUserId}`);
    if (!res.ok) throw new Error("Failed to fetch staff allocations");
    return res.json();
  },

  allocateStaff: async (staffUserId: number, libraryId: number, reason?: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/staff-allocations/${staffUserId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId, reason }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to allocate staff");
    }
    return res.json();
  },

  deallocateStaff: async (staffUserId: number, libraryId: number, reason?: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/staff-allocations/${staffUserId}/deallocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId, reason }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to deallocate staff");
    }
    return res.json();
  },

  getAllocationLogs: async (staffUserId?: number): Promise<StaffAllocationLogWithDetails[]> => {
    const url = staffUserId 
      ? `${API_BASE}/staff-allocation-logs?staffUserId=${staffUserId}`
      : `${API_BASE}/staff-allocation-logs`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch allocation logs");
    return res.json();
  },
};

// Search Attributes API
export interface SearchAttributeType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
  values: SearchAttributeValue[];
}

export interface SearchAttributeValue {
  id: number;
  attributeTypeId: number;
  value: string;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
}

export interface ResourceSearchAttribute {
  id: number;
  bookId: number;
  attributeValueId: number;
  assignedAt: string;
  attributeValue: string;
  attributeTypeName: string;
  attributeTypeId: number;
}

export interface DigitalResourceSearchAttribute {
  id: number;
  digitalResourceId: number;
  attributeValueId: number;
  assignedAt: string;
  attributeValue: string;
  attributeTypeName: string;
  attributeTypeId: number;
}

export const searchAttributesApi = {
  getTypes: async (): Promise<SearchAttributeType[]> => {
    const res = await fetch(`${API_BASE}/search-attributes/types`);
    if (!res.ok) throw new Error("Failed to fetch search attribute types");
    return res.json();
  },

  createType: async (data: { name: string; description?: string; sortOrder?: number }): Promise<SearchAttributeType> => {
    const res = await fetch(`${API_BASE}/search-attributes/types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create search attribute type");
    }
    return res.json();
  },

  updateType: async (id: number, data: Partial<{ name: string; description: string; isActive: boolean; sortOrder: number }>): Promise<SearchAttributeType> => {
    const res = await fetch(`${API_BASE}/search-attributes/types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update search attribute type");
    return res.json();
  },

  deleteType: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/search-attributes/types/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete search attribute type");
  },

  createValue: async (typeId: number, data: { value: string; sortOrder?: number }): Promise<SearchAttributeValue> => {
    const res = await fetch(`${API_BASE}/search-attributes/types/${typeId}/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create search attribute value");
    }
    return res.json();
  },

  updateValue: async (id: number, data: Partial<{ value: string; isActive: boolean; sortOrder: number }>): Promise<SearchAttributeValue> => {
    const res = await fetch(`${API_BASE}/search-attributes/values/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update search attribute value");
    return res.json();
  },

  deleteValue: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/search-attributes/values/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete search attribute value");
  },

  getBookAttributes: async (bookId: number): Promise<ResourceSearchAttribute[]> => {
    const res = await fetch(`${API_BASE}/books/${bookId}/search-attributes`);
    if (!res.ok) throw new Error("Failed to fetch book search attributes");
    return res.json();
  },

  setBookAttributes: async (bookId: number, attributeValueIds: number[]): Promise<ResourceSearchAttribute[]> => {
    const res = await fetch(`${API_BASE}/books/${bookId}/search-attributes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributeValueIds }),
    });
    if (!res.ok) throw new Error("Failed to update book search attributes");
    return res.json();
  },

  getDigitalResourceAttributes: async (digitalResourceId: number): Promise<DigitalResourceSearchAttribute[]> => {
    const res = await fetch(`${API_BASE}/digital-resources/${digitalResourceId}/search-attributes`);
    if (!res.ok) throw new Error("Failed to fetch digital resource search attributes");
    return res.json();
  },

  setDigitalResourceAttributes: async (digitalResourceId: number, attributeValueIds: number[]): Promise<DigitalResourceSearchAttribute[]> => {
    const res = await fetch(`${API_BASE}/digital-resources/${digitalResourceId}/search-attributes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributeValueIds }),
    });
    if (!res.ok) throw new Error("Failed to update digital resource search attributes");
    return res.json();
  },
};

// Digital Resources API
export interface DigitalResourceFilters {
  search?: string;
  department?: string;
  course?: string;
  semester?: string;
  resourceType?: string;
  category?: string;
  faculty?: string;
  uploadedBy?: number;
  status?: string;
  libraryId?: number;
  tags?: string[];
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  attributeValueIds?: number[];
}

export interface DigitalResourceWithVersions extends DigitalResource {
  versions: DigitalResourceVersion[];
}

export const digitalResourcesApi = {
  getAll: async (filters: DigitalResourceFilters = {}): Promise<DigitalResource[]> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return;
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
    });
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/digital-resources${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Failed to fetch digital resources");
    const data = await res.json();
    return data.resources ?? data;
  },

  getById: async (id: number): Promise<DigitalResourceWithVersions> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to fetch digital resource");
    }
    return res.json();
  },

  create: async (data: Partial<DigitalResource>): Promise<DigitalResource> => {
    const res = await fetch(`${API_BASE}/digital-resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create digital resource");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<DigitalResource>): Promise<DigitalResource> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update digital resource");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to delete digital resource");
    }
  },

  publish: async (id: number, publish: boolean): Promise<DigitalResource> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update publish status");
    }
    return res.json();
  },

  uploadFile: async (file: File): Promise<{ fileUrl: string; fileName: string; fileSizeBytes: number }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/digital-resources/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to upload file");
    }
    return res.json();
  },

  getVersions: async (id: number): Promise<DigitalResourceVersion[]> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}/versions`);
    if (!res.ok) throw new Error("Failed to fetch versions");
    return res.json();
  },

  addVersion: async (id: number, data: { file?: File; externalUrl?: string; versionNumber?: string; releaseNotes?: string; reasonForUpdate?: string; changeSummary?: string }): Promise<DigitalResourceVersion> => {
    const formData = new FormData();
    if (data.file) formData.append("file", data.file);
    if (data.externalUrl) formData.append("externalUrl", data.externalUrl);
    if (data.versionNumber) formData.append("versionNumber", data.versionNumber);
    if (data.releaseNotes) formData.append("releaseNotes", data.releaseNotes);
    if (data.reasonForUpdate) formData.append("reasonForUpdate", data.reasonForUpdate);
    if (data.changeSummary) formData.append("changeSummary", data.changeSummary);
    const res = await fetch(`${API_BASE}/digital-resources/${id}/versions`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add version");
    }
    return res.json();
  },

  recordDownload: async (id: number): Promise<{ fileUrl: string | null; externalUrl: string | null }> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}/download`, { method: "POST" });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to record download");
    }
    return res.json();
  },

  recordView: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}/view`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to record view");
  },

  restoreVersion: async (id: number, versionId: number): Promise<DigitalResource> => {
    const res = await fetch(`${API_BASE}/digital-resources/${id}/restore-version/${versionId}`, {
      method: "PUT",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to restore version");
    }
    return res.json();
  },
};

export interface ResourceTypeSettingApi {
  id: number;
  resourceType: string;
  color: string;
  maxSizeMb: number;
  isActive: boolean;
}

export const resourceTypeSettingsApi = {
  getAll: async (): Promise<ResourceTypeSettingApi[]> => {
    const res = await fetch(`${API_BASE}/resource-type-settings`);
    if (!res.ok) throw new Error("Failed to fetch resource type settings");
    return res.json();
  },
  update: async (resourceType: string, data: { color?: string; maxSizeMb?: number; isActive?: boolean }): Promise<ResourceTypeSettingApi> => {
    const res = await fetch(`${API_BASE}/resource-type-settings/${resourceType}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to update resource type setting");
    }
    return res.json();
  },
};

export const auditLogsApi = {
  query: async (filters: {
    category?: string;
    action?: string;
    userId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const res = await fetch(`${API_BASE}/audit-logs?${params}`);
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  },
};
