import { LucideIcon, LayoutDashboard, Book, Users, Repeat, AlertCircle, Settings, PieChart, Layers, Bell, Search, Menu, Building2, Package, ClipboardList, Tags, Coins } from "lucide-react";

export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE';
  joinedDate: string;
}

export interface BookItem {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  status: 'AVAILABLE' | 'CHECKED_OUT' | 'LOST' | 'MAINTENANCE';
  coverUrl?: string;
  publishedYear: number;
}

export interface CirculationRecord {
  id: string;
  bookId: string;
  userId: string;
  checkoutDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  fineAmount?: number;
}

export const mockUsers: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@admin.lib', role: 'ADMIN', status: 'ACTIVE', joinedDate: '2023-01-15' },
  { id: '2', name: 'Bob Smith', email: 'bob@lib.org', role: 'LIBRARIAN', status: 'ACTIVE', joinedDate: '2023-03-10' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@student.edu', role: 'STUDENT', status: 'ACTIVE', joinedDate: '2024-09-01' },
  { id: '4', name: 'Diana Prince', email: 'diana@student.edu', role: 'STUDENT', status: 'INACTIVE', joinedDate: '2024-09-05' },
  { id: '5', name: 'Evan Wright', email: 'evan@student.edu', role: 'STUDENT', status: 'ACTIVE', joinedDate: '2024-09-12' },
];

export const mockBooks: BookItem[] = [
  { id: '101', isbn: '978-0132350884', title: 'Clean Code', author: 'Robert C. Martin', category: 'Computer Science', status: 'AVAILABLE', publishedYear: 2008 },
  { id: '102', isbn: '978-0201616224', title: 'The Pragmatic Programmer', author: 'Andrew Hunt', category: 'Computer Science', status: 'CHECKED_OUT', publishedYear: 1999 },
  { id: '103', isbn: '978-0131103627', title: 'The C Programming Language', author: 'Brian Kernighan', category: 'Computer Science', status: 'AVAILABLE', publishedYear: 1988 },
  { id: '104', isbn: '978-0321125217', title: 'Domain-Driven Design', author: 'Eric Evans', category: 'Software Engineering', status: 'AVAILABLE', publishedYear: 2003 },
  { id: '105', isbn: '978-0060935467', title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Fiction', status: 'LOST', publishedYear: 1960 },
];

export const mockCirculation: CirculationRecord[] = [
  { id: 'c1', bookId: '102', userId: '3', checkoutDate: '2025-02-01', dueDate: '2025-02-15', status: 'ACTIVE' },
  { id: 'c2', bookId: '105', userId: '4', checkoutDate: '2024-12-01', dueDate: '2024-12-15', status: 'OVERDUE', fineAmount: 15.50 },
  { id: 'c3', bookId: '101', userId: '5', checkoutDate: '2025-01-10', dueDate: '2025-01-24', returnDate: '2025-01-20', status: 'RETURNED' },
];

export const dashboardStats = {
  totalBooks: 12500,
  booksIssued: 452,
  overdue: 18,
  totalMembers: 3420,
  circulationTrend: [
    { name: 'Mon', issues: 45, returns: 30 },
    { name: 'Tue', issues: 52, returns: 38 },
    { name: 'Wed', issues: 38, returns: 42 },
    { name: 'Thu', issues: 65, returns: 55 },
    { name: 'Fri', issues: 48, returns: 40 },
    { name: 'Sat', issues: 20, returns: 15 },
    { name: 'Sun', issues: 10, returns: 8 },
  ]
};

export const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', localAdminOnly: false },
  { label: 'Catalog', icon: Book, href: '/catalog', localAdminOnly: false },
  { label: 'Search Attributes', icon: Tags, href: '/catalog/search-attributes', localAdminOnly: false },
  { label: 'Allocations', icon: Package, href: '/allocations', localAdminOnly: false },
  { label: 'Circulation', icon: Repeat, href: '/circulation', localAdminOnly: false },
  { label: 'Waiver Requests', icon: Coins, href: '/circulation/waiver-requests', localAdminOnly: true },
  { label: 'Patrons', icon: Users, href: '/users', localAdminOnly: false },
  { label: 'Inventory', icon: Layers, href: '/inventory', localAdminOnly: false },
  { label: 'Organizations', icon: Building2, href: '/organizations', localAdminOnly: false },
  { label: 'Reports', icon: PieChart, href: '/reports', localAdminOnly: false },
  { label: 'Audit Logs', icon: ClipboardList, href: '/audit-logs', localAdminOnly: true },
  { label: 'Settings', icon: Settings, href: '/settings', localAdminOnly: true },
];
