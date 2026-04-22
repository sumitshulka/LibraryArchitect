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

### Circulation Policies (Global + Per-Library Overrides)
- **Global defaults** are stored in `system_config` under key `circulation_policy` (JSON). Managed by admins via **Settings → Circulation Rules** (`PUT /api/circulation-policy`).
- **Per-library overrides** live in the `libraries.policies` JSONB column. Edited from each library's dashboard via the "Library Policy Overrides" card (admins only). Blank fields inherit the global default.
- **Resolution**: `server/fines.ts#mergeCirculationPolicy(globalDefaults, library)` returns the effective policy for a library by merging library overrides over global defaults. `calculateAccruedFine` uses the merged policy for `finePerDay`, `gracePeriodDays`, `maxFineCap`, and short-circuits to zero when `enableLateFines === false`.
- `loadGlobalCirculationDefaults()` is cached for 30s; `invalidateCirculationPolicyCache()` is called whenever the policy is saved.

### Circulation & Library Rules
- **Library-Based Checkout**: All checkouts are tied to a specific library. System Admins select the library; Librarians are restricted to their assigned library. `libraryId` is stored in circulation records.
- **Direct Checkout**: Frontend flow supports searching for members and books, selecting copies from the chosen library, and confirming issue.
- **Quick Return**: Facilitates quick book returns, ensuring books go back to their issuing library.

### Reservation Workflow
- **Schema**: `reservations` (one row per held copy: `userId`, `bookId`, `bookCopyId`, `libraryId`, `reservedFor`, `expiresAt`, `status` ACTIVE|FULFILLED|CANCELLED|EXPIRED, fulfilment links). `reservation_pickups` (OTP envelope spanning multiple reservations: `otp`, `expiresAt` 15 min, `status`, `reservationIds` jsonb int[]).
- **Hold semantics**: On creation, `server/reservations.ts` finds an AVAILABLE copy in the chosen library and flips it to RESERVED, linking it to the reservation. Per-library `policies.reservationDays` (default 7) controls expiry. `expireStaleReservations` runs on every list/create call and frees stale RESERVED copies back to AVAILABLE.
- **API** (`server/reservations.ts`, mounted via `registerReservationRoutes`):
  - `POST /api/reservations` — staff can pass `userId` (on-behalf); patrons reserve for themselves. Bulk by passing multiple `items: [{bookId, libraryId, reservedFor?}]`.
  - `GET /api/reservations` — staff sees all (filterable by status/library/book/userId/dates); patrons see only their own.
  - `GET /api/books/:bookId/reservations?libraryId=` — list active holds on a book at a library (used by checkout flow hint).
  - `DELETE /api/reservations/:id` — staff or owner cancels; copy is returned to AVAILABLE.
  - `POST /api/reservations/pickup/initiate` — body `{reservationIds, userIdentifier}`. Validates that all reservations belong to the same patron whose `studentId`/`employeeId`/`externalId`/`username` matches (case-insensitive), creates a `reservation_pickup` row with a 6-digit OTP and 15-min expiry, emails it via the configured SMTP, returns masked email.
  - `POST /api/reservations/pickup/confirm` — body `{pickupId, otp}`. Verifies OTP/expiry, creates a circulation record per reservation (CHECKED_OUT, due-date from library policy), marks each copy CHECKED_OUT, fulfils reservations and stamps `fulfilledCirculationId`.
- **Frontend**:
  - `/reservations` (`client/src/modules/circulation/ReservationsPage.tsx`) — staff page with filters (status/library/patron/book), bulk-create dialog (patron picker + library + multi-book), per-row Cancel, and a 4-step Pickup Wizard (scan SSN/barcode → enter patron identifier → email OTP → confirm & issue).
  - Catalog detail panel (`CatalogPage.tsx`) shows a per-library "Reserve a copy" button for STUDENT/FACULTY users when copies are available; "You have an active reservation here" indicator when one already exists.
  - Checkout (`CirculationPage.tsx`) shows a `BookReservationsHint` panel listing active holds for the selected book/library when no copies are available, deep-linking to the Reservations page.
- **Audit**: Reservation create/cancel/fulfill, pickup initiate/confirm are logged under category `CIRCULATION` (action prefixes `RESERVATION_*`, `PICKUP_*`).

### Dynamic Search Attribute Filters
- Reusable component `client/src/components/SearchAttributesFilter.tsx` (popover with grouped checkboxes per type + selected chips). Only renders types that are active AND have ≥1 active value — blank/inactive types are hidden automatically.
- Integrated in **Catalog** (browse collection toolbar) and **Library Resources** (collapsible filters panel).
- Backend: `/api/books` and `/api/libraries/:id/resources` accept `attributeValueIds` (CSV). Filtering uses `storage.getBookIdsByAttributeValueIds(ids)` against the `resource_search_attributes` junction (OR/any-match across selected values).

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