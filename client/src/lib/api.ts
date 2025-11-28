import type { Book, User, Circulation, Inventory, SystemConfig, ResourceType } from "@shared/schema";

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
};

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
