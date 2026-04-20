# LibraTech - Enterprise Library Management System

## Overview
LibraTech is an enterprise-grade library management system designed for comprehensive library operations, including catalog, user, circulation, inventory management, and reporting. It's built as a full-stack web application with React, Express.js, and PostgreSQL, styled with shadcn/ui and Tailwind CSS. The system is designed with ERP integration capabilities for institutional deployment, supporting features like SSO authentication and user provisioning.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite for bundling. Client-side routing with Wouter.
- **UI Component System**: shadcn/ui (New York style), Radix UI primitives, Tailwind CSS v4 for styling with dark/light mode support.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form state and validation, Sonner for toast notifications.
- **Layout Structure**: Responsive design with fixed sidebar and top bar, modular page organization.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript.
- **Request Handling**: JSON and URL-encoded body parsing, custom logging middleware.
- **Routing & API Design**: RESTful API design with `/api` prefix, Zod for request validation, structured error responses.
- **Build Process**: Custom esbuild script for server bundling.

### Data Layer
- **Database & ORM**: PostgreSQL (Neon serverless driver) with Drizzle ORM for type-safe queries. Schema-first approach using `shared/schema.ts`.
- **Data Models**: Includes tables for Users (with roles: ADMIN, LIBRARIAN, STUDENT, FACULTY), Resource Types, Books, Circulation, Inventory, System Configuration, ERP Integrations, Sessions, Audit Logs (10 categories with detailed metadata), Search Attributes (types and values for faceted search), and Password Reset OTPs.
- **Schema Validation**: Zod schemas generated from Drizzle for client and server validation.

### Authentication & User Management
- **Authentication Modes**: LOCAL (username/password), ERP (SSO-only), HYBRID (both).
- **SSO Token Flow**: ERP generates a signed, time-limited token with user data, verified by the system using HMAC-SHA256.
- **User Provisioning**: Staff (ADMIN/LIBRARIAN) must be pre-provisioned via ERP API; Patrons (STUDENT/FACULTY) are auto-provisioned on first SSO login.
- **Security Features**: Token signature verification, timestamp expiration, origin/referer whitelist, secret key hashing, HTTP-only secure session cookies.

### Circulation & Library Rules
- **Library-Based Checkout**: All checkouts are tied to a specific library. System Admins select the library; Librarians are restricted to their assigned library. `libraryId` is stored in circulation records.
- **Direct Checkout**: Frontend flow supports searching for members and books, selecting copies from the chosen library, and confirming issue.
- **Quick Return**: Facilitates quick book returns, ensuring books go back to their issuing library.

### Fine Collection Workflow
- **Schema**: `payment_methods`, `fine_payments` (per-payment ledger), `fine_waiver_requests` (approval queue). Circulation rows track `fineAmount`, `finePaidAmount`, `fineWaivedAmount`, `damageCost`, `damagePaidAmount`, `damageWaivedAmount`, `damageStatus`.
- **Accrued Fine**: Calculated live via `server/fines.ts#calculateAccruedFine` using each library's `policies.finePerDay`, `gracePeriodDays`, and `maxFineCap`. Active circulation rows expose `accruedFine`/`daysOverdue` when fetched with `?enrich=true`.
- **Return Modal**: At return time the librarian/admin can record damage cost + notes, split payments across configured methods (Cash, UPI, Card, Bank, Cheque, …), and apply a waiver. Outstanding amounts persist on the borrower's record for later collection via `POST /api/circulation/:id/collect-fine`.
- **Waiver Approval**: Admins (`role === 'ADMIN'`) waive directly. Librarians create a `fine_waiver_request` (PENDING) that admins review on the **Waiver Requests** page. Approval applies the waiver and updates the circulation.
- **Configurable Payment Methods**: Managed in **Settings → Payment Methods** (CRUD with active toggle).
- **Fines & Revenue Report**: `GET /api/reports/fines-revenue` aggregates payments by method, library, and day; powers the report page with filters (date range, library, method, type) plus CSV export.
- **Audit**: Every fine/damage/waiver action is logged under category `FINES` (PAYMENT_COLLECTED, WAIVED_BY_ADMIN, WAIVER_REQUESTED, WAIVER_APPROVED, WAIVER_REJECTED).

## External Dependencies

### Database Service
- **Neon Serverless PostgreSQL**: For the primary database.

### UI Component Libraries
- **Radix UI**: Core accessible UI primitives.
- **Lucide React**: Iconography.
- **embla-carousel-react**: Carousel functionality.
- **cmdk**: Command palette.
- **react-day-picker**: Calendar and date selection.

### Form & Validation
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation.
- **@hookform/resolvers**: Zod integration with React Hook Form.

### Utility Libraries
- **date-fns**: Date manipulation.
- **clsx**, **class-variance-authority**, **tailwind-merge**: Conditional CSS and Tailwind class management.
- **nanoid**: Unique ID generation.

### Development Tools
- **TypeScript**: Language.
- **ESBuild**: Server bundling.
- **Vite**: Frontend build tool.

### Fonts
- **Google Fonts**: Inter (UI font), JetBrains Mono (monospace).

### Email Provider Integration
- **SMTP**: For forgot password flow and notifications. Pre-populated settings for common providers (Gmail, Outlook, Yahoo, etc.) and custom SMTP.

### ERP Integration APIs
- **ERP Provisioning API**: For creating, listing, deleting, and updating status of library staff users.
- **ERP Transaction API**: For querying circulation transactions.
- **ERP Catalog API**: For searching the catalog using attribute filters and text search.