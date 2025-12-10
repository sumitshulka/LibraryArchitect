import type { Book, User, Circulation, Inventory, SystemConfig, ResourceType, Category, ErpIntegration, ErpWhitelist, OrgUnit, Library, BookCopy, BookTransfer, LibraryMembership } from "@shared/schema";

const API_BASE = "/api";

// Books API
export const booksApi = {
  getAll: async (search?: string): Promise<Book[]> => {
    const url = search ? `${API_BASE}/books?search=${encodeURIComponent(search)}` : `${API_BASE}/books`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch books");
    return res.json();
  },

  getById: async (id: number): Promise<Book> => {
    const res = await fetch(`${API_BASE}/books/${id}`);
    if (!res.ok) throw new Error("Failed to fetch book");
    return res.json();
  },

  create: async (book: Omit<Book, "id" | "createdAt">): Promise<Book> => {
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

// Users API
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`);
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
  search: async (isbn: string, server?: string): Promise<Z3950SearchResult[]> => {
    const res = await fetch(`${API_BASE}/z3950/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn, server }),
    });
    if (!res.ok) throw new Error("Failed to perform Z39.50 search");
    return res.json();
  },
};

// Circulation API
export const circulationApi = {
  getAll: async (userId?: number): Promise<Circulation[]> => {
    const url = userId ? `${API_BASE}/circulation?userId=${userId}` : `${API_BASE}/circulation`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch circulation records");
    return res.json();
  },

  checkout: async (data: { bookId: number; userId: number; dueDate: Date }): Promise<Circulation> => {
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

  returnBook: async (id: number): Promise<Circulation> => {
    const res = await fetch(`${API_BASE}/circulation/${id}/return`, {
      method: "POST",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to return book");
    }
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
export const configApi = {
  getAll: async (): Promise<SystemConfig[]> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error("Failed to fetch configuration");
    return res.json();
  },

  set: async (data: Omit<SystemConfig, "id" | "updatedAt">): Promise<SystemConfig> => {
    const res = await fetch(`${API_BASE}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to set configuration");
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
};

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

  getResources: async (id: number, params?: {
    query?: string;
    format?: string;
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<LibraryResourcesResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('query', params.query);
    if (params?.format) searchParams.set('format', params.format);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
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
