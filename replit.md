# LibraTech - Enterprise Library Management System

## Overview

LibraTech is an enterprise-grade library management system built as a full-stack web application. The system provides comprehensive library operations including catalog management, user management, circulation tracking, inventory control, and reporting capabilities. It's designed with ERP integration capabilities in mind, making it suitable for institutional deployment.

The application uses a modern tech stack with React on the frontend, Express.js on the backend, and PostgreSQL with Drizzle ORM for data persistence. The UI is built with shadcn/ui components and styled with Tailwind CSS.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- Uses React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Client-side routing implemented with Wouter (lightweight alternative to React Router)
- The frontend is located in the `client/` directory with main entry point at `client/src/main.tsx`

**UI Component System**
- Built on shadcn/ui component library configured with the "new-york" style variant
- Uses Radix UI primitives for accessible, unstyled components
- Tailwind CSS v4 for styling with CSS variables for theming
- Custom color system supporting light/dark modes through CSS variables
- Component aliases configured for clean imports (`@/components`, `@/lib`, etc.)

**State Management**
- TanStack Query (React Query) for server state management and data fetching
- Custom query client configuration with retry and caching strategies
- Form state managed through React Hook Form with Zod validation
- Toast notifications via both Radix UI Toast and Sonner

**Layout Structure**
- Main application layout with fixed sidebar navigation and top bar
- Responsive design with mobile breakpoint at 768px
- Module-based page organization (dashboard, catalog, users, circulation, inventory, reports, settings)
- Each module is self-contained in `client/src/modules/[module-name]/`

### Backend Architecture

**Server Framework**
- Express.js server with TypeScript
- HTTP server created using Node's native `http` module
- Development mode uses Vite middleware for HMR (Hot Module Replacement)
- Production builds serve static files from `dist/public`

**Request Handling**
- JSON body parsing with raw body capture for webhook verification
- URL-encoded form data support
- Custom logging middleware that tracks request duration
- API routes prefixed with `/api`

**Routing & API Design**
- RESTful API design with resource-based endpoints
- Routes defined in `server/routes.ts` and registered to the Express app
- Zod schemas for request validation with descriptive error messages
- Structured error responses with appropriate HTTP status codes

**Build Process**
- Custom build script using esbuild for server bundling
- Selective dependency bundling to optimize cold start times
- Allowlist of commonly used dependencies to reduce file system calls
- Separate client and server builds orchestrated through `script/build.ts`

### Data Layer

**Database & ORM**
- PostgreSQL database (Neon serverless driver)
- Drizzle ORM for type-safe database queries
- Schema-first approach with database schema defined in `shared/schema.ts`
- Drizzle Kit for schema migrations stored in `migrations/` directory

**Data Models**
The system uses PostgreSQL enums and tables for:

1. **Users** - User accounts with roles (ADMIN, LIBRARIAN, STUDENT, FACULTY) and status tracking
2. **Resource Types** - Configurable categories for different resource types
3. **Books** - Core catalog items with ISBN, MARC records, status tracking, and shelf locations
4. **Circulation** - Book checkout/return records with due dates and fine tracking
5. **Inventory** - Physical inventory management and tracking
6. **System Config** - Application-wide configuration settings with support for local, ERP, or hybrid authentication modes
7. **ERP Integrations** - External ERP system configurations for SSO authentication
8. **Sessions** - User session management with token-based authentication
9. **Audit Logs** - Comprehensive activity logging with 10 categories (AUTHENTICATION, USER_MANAGEMENT, CATALOG, CIRCULATION, FINES, INVENTORY, REPORTS, ERP_INTEGRATION, SYSTEM_CONFIG, STAFF_ALLOCATION), tracking success/failure status, user info, IP addresses, and detailed JSON metadata. Indexed on timestamp, category, status, and userId for query performance.
10. **Search Attribute Types** - Configurable filter categories (e.g., Tags, Programs, Courses, Semester, Subject Type) that librarians define for refined catalog search
11. **Search Attribute Values** - Individual values within each attribute type (e.g., "Computer Science" under Programs, "Semester 1" under Semester)
12. **Resource Search Attributes** - Junction table linking books to attribute values, enabling multi-faceted search filtering
13. **Password Reset OTPs** - OTP codes for forgot password flow, with expiration and used tracking

## Initial Setup & Bootstrap

### Fresh Installation
When the system is first installed, a bootstrap process automatically:
1. Creates a default superadmin account if no users exist
2. Sets the authentication mode to LOCAL

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`

**Important:** Change the default password immediately after first login.

### Local Login Endpoint
- **POST /api/auth/login** - Authenticate with username/password
  - Request: `{ "username": "admin", "password": "admin123" }`
  - Returns: User session cookie and user info
  - Only available in LOCAL or HYBRID auth modes

### Forgot Password Flow
Uses email-based OTP verification:
1. **POST /api/auth/forgot-password** - Request OTP by username or email
   - Validates user exists and has a local password
   - Sends 6-digit OTP via configured SMTP (expires in 10 minutes)
   - Returns masked email address
2. **POST /api/auth/verify-otp** - Verify OTP code
   - Returns a reset token on success
3. **POST /api/auth/reset-password** - Set new password
   - Requires reset token, new password (min 6 chars, must contain letters + numbers)
   - Password requirements enforced on both frontend and backend

### Email Provider Configuration
Settings > Notifications allows admin to configure SMTP email:
- Pre-populated settings for: Gmail, Google Workspace, Outlook, O365, Yahoo, Zoho, SendGrid, Amazon SES
- Custom/Other SMTP option with manual host/port/TLS
- App password field (masked in API responses)
- Test email functionality to verify configuration
- Config stored as system_config entries with category "email"

## SSO Authentication & User Provisioning

### Authentication Modes
The system supports three authentication modes configured via System Config:
- **LOCAL** - Traditional username/password authentication (default for fresh installations)
- **ERP** - SSO-only authentication via configured ERP integrations
- **HYBRID** - Both local and SSO authentication available

### User Categories
Users are categorized into two types:
- **STAFF** - Library administrators and librarians (roles: ADMIN, LIBRARIAN)
- **PATRON** - Library users (roles: STUDENT, FACULTY)

### SSO Token Flow
1. ERP system generates a signed token with user data
2. Token includes: externalId, name, email, erpRole, timestamp, signature
3. Token is Base64URL encoded and sent to `/api/sso/callback`
4. Library system verifies signature using HMAC-SHA256
5. Token expires after 5 minutes; sessions last 24 hours

### User Provisioning Rules
**Library Staff (Admin/Librarian):**
- Must be pre-provisioned via API before SSO login is allowed
- ERP calls `POST /api/erp/library-users` to create staff accounts
- SSO login will be rejected if staff user is not pre-provisioned
- Role mapping: LIBRARY_ADMIN → ADMIN, LIBRARIAN → LIBRARIAN

**Library Patrons (Students/Faculty):**
- Auto-provisioned on first SSO login
- No pre-provisioning required
- Role mapping: STUDENT → STUDENT, FACULTY → FACULTY

### ERP Provisioning API Endpoints
All endpoints require `X-Secret-Key` header matching the ERP integration's secret.

**POST /api/erp/library-users**
Creates or updates a library staff user.
```json
{
  "appId": "ERP_APP_ID",
  "externalId": "EMP001",
  "name": "Jane Doe",
  "email": "jane@example.edu",
  "role": "LIBRARIAN",
  "department": "Library Services"
}
```

**GET /api/erp/library-users?appId=...**
Lists all library staff users for an ERP integration.

**DELETE /api/erp/library-users/:externalId?appId=...**
Deactivates a library staff user (soft delete to INACTIVE status).

**PATCH /api/erp/library-users/:externalId/status?appId=...**
Update user status (works for both staff and patrons). Send `{ "status": "INACTIVE" }` or `{ "status": "ACTIVE" }`.
- Inactive staff cannot log in (local or SSO)
- Inactive patrons cannot check out books and cannot log in via SSO
- Can also be used to reactivate users by setting status back to ACTIVE

### ERP Transaction API Endpoints
All endpoints require `X-Secret-Key` header and `appId` query parameter.

**GET /api/erp/transactions?appId=...&externalId=...&status=ACTIVE,OVERDUE**
Returns circulation transactions. Use `externalId` to filter by student, `status` to filter by transaction status.

### ERP Catalog API Endpoints
All endpoints require `X-Secret-Key` header and `appId` query parameter.

**GET /api/erp/catalog/search-attributes?appId=...**
Returns all active search attribute types with their values for populating student filter UI.

**GET /api/erp/catalog/search?appId=...&attributeValueIds=1,4,7&q=keyword**
Searches the catalog using attribute filters and/or text search. At least one filter required.
- If results exceed the configurable limit (default: 50), returns `success: false` with a message to refine search
- The limit is configurable in Settings > Catalog Settings (`erp_catalog_limit` config key)

### Security Features
- Token signature verification with length validation
- Timestamp expiration check (5-minute window)
- Origin/Referer whitelist validation
- Secret key hash/salt verification
- HTTP-only session cookies
- Secure cookies in production

**Storage Layer**
- Storage interface defined in `server/storage.ts` providing abstraction over database operations
- CRUD operations for all major entities
- Search functionality for books
- Relationship queries for circulation and inventory tracking

**Schema Validation**
- Zod schemas generated from Drizzle tables using `drizzle-zod`
- Separate insert and select schemas for create vs. read operations
- Client and server share validation schemas through the `shared/` directory

### External Dependencies

**Database Service**
- Neon Serverless PostgreSQL (configured via `@neondatabase/serverless`)
- Connection string provided through `DATABASE_URL` environment variable
- Serverless-optimized for reduced connection overhead

**UI Component Libraries**
- Radix UI component primitives (25+ components including dialogs, dropdowns, tooltips, etc.)
- Lucide React for iconography
- embla-carousel-react for carousel functionality
- cmdk for command palette functionality
- react-day-picker for calendar/date selection

**Form & Validation**
- React Hook Form for form state management
- Zod for runtime type validation
- @hookform/resolvers for Zod integration with React Hook Form
- zod-validation-error for human-readable error messages

**Utility Libraries**
- date-fns for date manipulation
- clsx and class-variance-authority for conditional CSS classes
- tailwind-merge for merging Tailwind classes
- nanoid for unique ID generation

**Development Tools**
- TypeScript compiler with strict mode enabled
- ESBuild for fast server bundling
- Vite plugins for development experience (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer for Replit integration)
- Custom meta images plugin for OpenGraph image handling

**Fonts**
- Google Fonts: Inter (primary UI font) and JetBrains Mono (monospace)
- Loaded via CDN in the HTML template

**Replit-Specific Integrations**
- Custom Vite plugins for Replit development environment
- Meta image plugin automatically updates OpenGraph images with Replit deployment URLs
- Development banner and error overlay in development mode only

## Circulation & Direct Checkout

### Frontend Flow
The Circulation page (`client/src/modules/circulation/CirculationPage.tsx`) provides:
- **Direct Checkout**: Select member from dropdown, enter book ISBN, look up book, review confirmation dialog (member ID, name, book details, issue/return dates), then confirm issue
- **Quick Return**: Enter ISBN, see borrower details and due status, process return
- **Active Transactions**: Searchable table showing all active/overdue checkouts with inline return action
- **Checkout New (Reset)**: Resets the form after issuing

### ERP Transaction API
- **GET /api/erp/transactions?appId=...** - Returns circulation transactions for ERP integration
  - Requires `X-Secret-Key` header
  - Optional filters: `externalId` (filter by student), `status` (comma-separated: ACTIVE,RETURNED,OVERDUE,LOST)
  - Returns enriched transaction data with member and book details