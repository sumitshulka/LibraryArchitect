import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LibraTech API',
      version: '1.0.0',
      description: `
# LibraTech Enterprise Library Management System API

This API documentation covers all endpoints for the LibraTech library management system, with focus on ERP integration and user provisioning.

## Authentication Modes

The system supports three authentication modes:
- **LOCAL** - Traditional username/password authentication
- **ERP** - SSO-only authentication via configured ERP integrations  
- **HYBRID** - Both local and SSO authentication available

## User Categories

- **STAFF** - Library administrators and librarians (roles: ADMIN, LIBRARIAN)
- **PATRON** - Library users (roles: STUDENT, FACULTY)

## SSO Token Flow

1. ERP system generates a signed token with user data
2. Token includes: externalId, name, email, erpRole, timestamp, signature
3. Token is Base64URL encoded and sent to \`/api/sso/callback\`
4. Library system verifies signature using HMAC-SHA256
5. Token expires after 5 minutes; sessions last 24 hours

## User Provisioning Rules

**Library Staff (Admin/Librarian):**
- Must be pre-provisioned via API before SSO login is allowed
- Use \`POST /api/erp/library-users\` to create staff accounts

**Library Patrons (Students/Faculty):**
- Auto-provisioned on first SSO login
- No pre-provisioning required
      `,
      contact: {
        name: 'LibraTech Support',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Local authentication endpoints',
      },
      {
        name: 'SSO',
        description: 'Single Sign-On endpoints for ERP integration',
      },
      {
        name: 'ERP User Provisioning',
        description: 'Endpoints for ERP systems to provision library users',
      },
      {
        name: 'ERP Integrations',
        description: `Manage ERP integration configurations and outbound communication.

**Outbound Integration Flow (Library → ERP):**
1. **Configure Auth Settings** - Set API secret, login URL override (optional), and token TTL
2. **Test Connection** - Authenticates with ERP using App ID + API Secret, obtains JWT token, and stores it
3. **Lookup User** - Uses stored JWT token in Authorization header to fetch user details from ERP

**Authentication Mechanism:**
- Library sends POST to ERP login endpoint with App ID and API Secret
- ERP returns JWT token with expiration time
- Library caches token and uses it for subsequent API calls
- Token is automatically refreshed when expired

**Token Usage:**
- All outbound API calls include: \`Authorization: Bearer <jwt_token>\`
- Pull endpoints use the cached token to fetch student/faculty data on demand`,
      },
      {
        name: 'System Configuration',
        description: 'System-wide configuration settings',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Books',
        description: 'Book catalog management',
      },
      {
        name: 'Circulation',
        description: 'Book checkout and return operations',
      },
      {
        name: 'ERP Transactions',
        description: `API endpoints for ERP systems to retrieve circulation transactions (issued/returned books).

**Common Use Cases:**
- Show a student the books currently issued to them in the ERP student portal
- Display overdue books and fine information
- Get the complete borrowing history for a student or staff member

**Usage:**
- Pass \`externalId\` (student roll number or employee ID) to filter transactions for a specific user
- Pass \`status=ACTIVE\` to get only currently issued books, or \`status=ACTIVE,OVERDUE\` to include overdue items
- Omit both filters to get all transactions across all users`,
      },
      {
        name: 'ERP Books',
        description: 'List, look up status, and reserve books from an ERP. All endpoints are authenticated with `appId` (query/body) + `X-Secret-Key` header.',
      },
      {
        name: 'ERP Reservations',
        description: 'Create reservations on behalf of patrons known to the ERP via their externalId.',
      },
      {
        name: 'ERP Fines',
        description: 'Per-patron fine breakdown and ERP-wide fine summary.',
      },
      {
        name: 'ERP Catalog',
        description: `API endpoints for ERP systems to browse the library catalog on behalf of students.

**Flow:**
1. ERP calls \`GET /api/erp/catalog/search-attributes\` to get available filter options (attribute types and their values)
2. Student selects desired attribute values in the ERP console
3. ERP calls \`GET /api/erp/catalog/search\` with the selected attribute value IDs
4. If results exceed the configured limit (default: 50), the API returns a message asking the student to refine the search
5. The catalog limit is configurable by the library admin in Settings > Catalog Settings

**Authentication:** All endpoints require the \`X-Secret-Key\` header matching the ERP integration's secret key, and the \`appId\` query parameter.`,
      },
      {
        name: 'ERP Digital Resources',
        description: `API endpoints for ERP systems to search the digital resources repository (e-books, videos, lecture notes, etc.) on behalf of students/faculty.

**Flow:**
1. ERP calls \`GET /api/erp/digital-resources/search-attributes\` to get available filter options (shares the same attribute taxonomy as the book catalog)
2. User selects desired attribute values in the ERP console
3. ERP calls \`GET /api/erp/digital-resources/search\` with the selected attribute value IDs and/or a text query
4. If results exceed the configured limit (shared with the catalog limit, default: 50), the API returns a message asking to refine the search

**Visibility:** Only \`PUBLISHED\` resources with \`INSTITUTION\`-wide visibility are returned — resources scoped to a specific department, course, batch, role, or user list are not exposed via this external API.

**Authentication:** All endpoints require the \`X-Secret-Key\` header matching the ERP integration's secret key, and the \`appId\` query parameter.`,
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session_id',
          description: 'Session cookie obtained after login',
        },
        erpSecretKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Secret-Key',
          description: 'ERP integration secret key for provisioning APIs',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'jdoe' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'jdoe@university.edu' },
            role: { type: 'string', enum: ['ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY'], example: 'LIBRARIAN' },
            category: { type: 'string', enum: ['STAFF', 'PATRON'], example: 'STAFF' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], example: 'ACTIVE' },
            department: { type: 'string', nullable: true, example: 'Library Services' },
            employeeId: { type: 'string', nullable: true, example: 'EMP001' },
            studentId: { type: 'string', nullable: true, example: null },
            phone: { type: 'string', nullable: true, example: '+1-555-0123' },
            externalId: { type: 'string', nullable: true, description: 'External ID from ERP system', example: 'ERP_USER_001' },
            erpIntegrationId: { type: 'integer', nullable: true, description: 'ID of associated ERP integration', example: 1 },
            isLocalUser: { type: 'boolean', description: 'Whether user has local credentials', example: true },
            joinedDate: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'admin123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', example: 'oldPassword123' },
            newPassword: { type: 'string', example: 'newSecurePassword456' },
          },
        },
        ERPIntegration: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'University ERP' },
            appId: { type: 'string', example: 'UNIV_ERP_001' },
            secretKeyHash: { type: 'string', description: 'Hashed secret key (not exposed)' },
            secretKeySalt: { type: 'string', description: 'Salt for secret key (not exposed)' },
            allowedOrigins: { type: 'array', items: { type: 'string' }, example: ['https://erp.university.edu'] },
            allowedReferers: { type: 'array', items: { type: 'string' }, example: ['https://erp.university.edu/'] },
            staffRoleMapping: { type: 'object', example: { 'LIBRARY_ADMIN': 'ADMIN', 'LIBRARIAN': 'LIBRARIAN' } },
            patronRoleMapping: { type: 'object', example: { 'STUDENT': 'STUDENT', 'FACULTY': 'FACULTY' } },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ERPUserProvisionRequest: {
          type: 'object',
          required: ['appId', 'externalId', 'name', 'email', 'role'],
          properties: {
            appId: { type: 'string', description: 'ERP integration App ID', example: 'UNIV_ERP_001' },
            externalId: { type: 'string', description: 'Unique user ID in ERP system', example: 'EMP001' },
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'jane.doe@university.edu' },
            role: { type: 'string', enum: ['LIBRARY_ADMIN', 'LIBRARIAN'], description: 'ERP role to map to library role', example: 'LIBRARIAN' },
            department: { type: 'string', nullable: true, example: 'Library Services' },
          },
        },
        ERPUserProvisionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Library user provisioned successfully' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 5 },
                externalId: { type: 'string', example: 'EMP001' },
                name: { type: 'string', example: 'Jane Doe' },
                email: { type: 'string', example: 'jane.doe@university.edu' },
                role: { type: 'string', example: 'LIBRARIAN' },
                status: { type: 'string', example: 'ACTIVE' },
              },
            },
          },
        },
        SSOToken: {
          type: 'object',
          required: ['externalId', 'name', 'email', 'erpRole', 'timestamp', 'signature'],
          properties: {
            externalId: { type: 'string', description: 'User ID in ERP system', example: 'STU12345' },
            name: { type: 'string', example: 'John Student' },
            email: { type: 'string', format: 'email', example: 'john.student@university.edu' },
            erpRole: { type: 'string', enum: ['LIBRARY_ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY'], example: 'STUDENT' },
            timestamp: { type: 'integer', description: 'Unix timestamp in milliseconds', example: 1706745600000 },
            signature: { type: 'string', description: 'HMAC-SHA256 signature', example: 'abc123...' },
          },
        },
        SystemConfig: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            key: { type: 'string', example: 'authMode' },
            value: { type: 'string', example: 'LOCAL' },
            description: { type: 'string', nullable: true },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error message' },
          },
        },
      },
    },
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with username and password',
          description: 'Authenticate a local user. Only available in LOCAL or HYBRID auth modes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
                examples: {
                  defaultAdmin: {
                    summary: 'Default admin login',
                    value: { username: 'admin', password: 'admin123' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            '401': {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '403': {
              description: 'Local login disabled (ERP-only mode)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user',
          description: 'Returns the currently authenticated user based on session cookie.',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'Current user info',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            '401': {
              description: 'Not authenticated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout current user',
          description: 'Invalidates the current session and clears the session cookie.',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'Logout successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/change-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change password (local users only)',
          description: 'Change password for the currently logged in local user. Not available for ERP users.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChangePasswordRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Password changed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password changed successfully' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid request or ERP user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '401': {
              description: 'Current password incorrect',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/sso/callback': {
        get: {
          tags: ['SSO'],
          summary: 'SSO callback endpoint',
          description: `
Handles SSO authentication from ERP systems. The token should be Base64URL encoded JSON containing user data and signature.

**Token Structure:**
\`\`\`json
{
  "externalId": "STU12345",
  "name": "John Student",
  "email": "john@university.edu",
  "erpRole": "STUDENT",
  "timestamp": 1706745600000,
  "signature": "HMAC-SHA256 signature"
}
\`\`\`

**Provisioning Rules:**
- Staff users (LIBRARY_ADMIN, LIBRARIAN) must be pre-provisioned via /api/erp/library-users
- Patron users (STUDENT, FACULTY) are auto-provisioned on first login
          `,
          parameters: [
            {
              name: 'token',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Base64URL encoded SSO token',
              example: 'eyJleHRlcm5hbElkIjoiU1RVMTIzNDUiLCJuYW1lIjoiSm9obiBTdHVkZW50IiwiZW1haWwiOiJqb2huQHVuaXZlcnNpdHkuZWR1IiwiZXJwUm9sZSI6IlNUVURFTlQiLCJ0aW1lc3RhbXAiOjE3MDY3NDU2MDAwMDAsInNpZ25hdHVyZSI6ImFiYzEyMyJ9',
            },
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '302': {
              description: 'Redirect to dashboard on success, or login with error on failure',
            },
          },
        },
      },
      '/api/sso/test/generate-token': {
        post: {
          tags: ['SSO'],
          summary: 'Generate SSO token for testing',
          description: `
Generates a valid signed SSO token for testing purposes. Use this to create tokens that can be used with the SSO callback endpoint.

**Steps to test SSO:**
1. Call this endpoint with your appId, secretKey, and user details
2. Copy the generated token from the response
3. Use the token with /api/sso/callback or the callbackUrl provided
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['appId', 'secretKey', 'userId', 'userType', 'name', 'email'],
                  properties: {
                    appId: { type: 'string', description: 'ERP integration App ID', example: 'LIB-9ACF6E312F2455467B57D62D7F3BFC70' },
                    secretKey: { type: 'string', description: 'ERP integration secret key', example: 'your-secret-key-here' },
                    userId: { type: 'string', description: 'User ID in ERP system', example: 'EMP001' },
                    userType: { type: 'string', enum: ['EMPLOYEE', 'STUDENT'], description: 'User type in ERP', example: 'EMPLOYEE' },
                    role: { type: 'string', enum: ['LIBRARY_ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY'], description: 'Role for staff users', example: 'LIBRARIAN' },
                    name: { type: 'string', example: 'John Doe' },
                    email: { type: 'string', format: 'email', example: 'john.doe@university.edu' },
                    department: { type: 'string', nullable: true, example: 'Library Services' },
                  },
                },
                examples: {
                  staff: {
                    summary: 'Generate token for staff user',
                    value: {
                      appId: 'LIB-9ACF6E312F2455467B57D62D7F3BFC70',
                      secretKey: 'your-secret-key-here',
                      userId: 'EMP001',
                      userType: 'EMPLOYEE',
                      role: 'LIBRARIAN',
                      name: 'Jane Librarian',
                      email: 'jane@university.edu',
                      department: 'Library Services',
                    },
                  },
                  student: {
                    summary: 'Generate token for student',
                    value: {
                      appId: 'LIB-9ACF6E312F2455467B57D62D7F3BFC70',
                      secretKey: 'your-secret-key-here',
                      userId: 'STU12345',
                      userType: 'STUDENT',
                      role: 'STUDENT',
                      name: 'John Student',
                      email: 'john.student@university.edu',
                      department: 'Computer Science',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token generated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string', description: 'Base64URL encoded signed token' },
                      callbackUrl: { type: 'string', description: 'Full URL to call for SSO login' },
                      expiresIn: { type: 'integer', description: 'Token expiry in seconds', example: 300 },
                      instructions: {
                        type: 'object',
                        properties: {
                          method: { type: 'string', example: 'GET' },
                          url: { type: 'string' },
                          headers: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Invalid secret key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '404': {
              description: 'ERP integration not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/sso/test/simulate-login': {
        post: {
          tags: ['SSO'],
          summary: 'Simulate complete SSO login',
          description: `
Simulates a complete SSO login flow without redirects. This is useful for testing the full authentication process programmatically.

**What this does:**
1. Generates a signed token
2. Verifies the token signature
3. Creates or finds the user (auto-provisions patrons)
4. Creates a session
5. Returns user and session details

**Note:** Staff users (LIBRARY_ADMIN, LIBRARIAN) must be pre-provisioned via /api/erp/library-users before SSO login.
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['appId', 'secretKey', 'userId', 'userType', 'name', 'email'],
                  properties: {
                    appId: { type: 'string', description: 'ERP integration App ID', example: 'LIB-9ACF6E312F2455467B57D62D7F3BFC70' },
                    secretKey: { type: 'string', description: 'ERP integration secret key', example: 'your-secret-key-here' },
                    userId: { type: 'string', description: 'User ID in ERP system', example: 'STU12345' },
                    userType: { type: 'string', enum: ['EMPLOYEE', 'STUDENT'], description: 'User type in ERP', example: 'STUDENT' },
                    role: { type: 'string', enum: ['LIBRARY_ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY'], description: 'Role', example: 'STUDENT' },
                    name: { type: 'string', example: 'John Student' },
                    email: { type: 'string', format: 'email', example: 'john.student@university.edu' },
                    department: { type: 'string', nullable: true, example: 'Computer Science' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'SSO login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      userCreated: { type: 'boolean', description: 'Whether user was newly created', example: true },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 5 },
                          name: { type: 'string', example: 'John Student' },
                          email: { type: 'string', example: 'john.student@university.edu' },
                          category: { type: 'string', example: 'PATRON' },
                          role: { type: 'string', example: 'STUDENT' },
                          department: { type: 'string', nullable: true },
                        },
                      },
                      session: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          expiresAt: { type: 'string', format: 'date-time' },
                        },
                      },
                      tokenDetails: {
                        type: 'object',
                        properties: {
                          signatureValid: { type: 'boolean', example: true },
                          mappedRole: { type: 'string', example: 'STUDENT' },
                          mappedCategory: { type: 'string', example: 'PATRON' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Invalid secret key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '403': {
              description: 'Staff user not pre-provisioned',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: { error: 'Staff user must be pre-provisioned before SSO login' },
                },
              },
            },
          },
        },
      },
      '/api/erp/library-users': {
        post: {
          tags: ['ERP User Provisioning'],
          summary: 'Provision a library staff user',
          description: `
Creates or updates a library staff user (Admin or Librarian). This endpoint must be called by the ERP system before the user can log in via SSO.

**Required Header:** \`X-Secret-Key\` matching the ERP integration's secret key.

**Role Mapping:**
- LIBRARY_ADMIN → ADMIN
- LIBRARIAN → LIBRARIAN
          `,
          security: [{ erpSecretKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ERPUserProvisionRequest' },
                examples: {
                  librarian: {
                    summary: 'Provision a librarian',
                    value: {
                      appId: 'UNIV_ERP_001',
                      externalId: 'EMP001',
                      name: 'Jane Doe',
                      email: 'jane.doe@university.edu',
                      role: 'LIBRARIAN',
                      department: 'Library Services',
                    },
                  },
                  admin: {
                    summary: 'Provision a library admin',
                    value: {
                      appId: 'UNIV_ERP_001',
                      externalId: 'EMP002',
                      name: 'Bob Admin',
                      email: 'bob.admin@university.edu',
                      role: 'LIBRARY_ADMIN',
                      department: 'Library Administration',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'User provisioned successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ERPUserProvisionResponse' },
                },
              },
            },
            '400': {
              description: 'Invalid request data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: { error: 'Invalid role. Only LIBRARY_ADMIN and LIBRARIAN roles can be provisioned.' },
                },
              },
            },
            '401': {
              description: 'Invalid or missing secret key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '404': {
              description: 'ERP integration not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        get: {
          tags: ['ERP User Provisioning'],
          summary: 'List provisioned library staff users',
          description: 'Returns all library staff users provisioned for a specific ERP integration.',
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '200': {
              description: 'List of provisioned users',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      users: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 5 },
                            externalId: { type: 'string', example: 'EMP001' },
                            name: { type: 'string', example: 'Jane Doe' },
                            email: { type: 'string', example: 'jane.doe@university.edu' },
                            role: { type: 'string', example: 'LIBRARIAN' },
                            status: { type: 'string', example: 'ACTIVE' },
                            department: { type: 'string', nullable: true, example: 'Library Services' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Invalid or missing secret key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/erp/library-users/{externalId}': {
        delete: {
          tags: ['ERP User Provisioning'],
          summary: 'Deactivate a library staff user',
          description: 'Deactivates a library staff user (sets status to INACTIVE). This is a soft delete to preserve audit history.',
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'externalId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'External user ID from ERP system',
              example: 'EMP001',
            },
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '200': {
              description: 'User deactivated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'User deactivated successfully' },
                    },
                  },
                },
              },
            },
            '404': {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/erp-integrations': {
        get: {
          tags: ['ERP Integrations'],
          summary: 'List all ERP integrations',
          description: 'Returns all configured ERP integrations. Secret keys are not exposed.',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'List of ERP integrations',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ERPIntegration' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['ERP Integrations'],
          summary: 'Create a new ERP integration',
          description: 'Creates a new ERP integration configuration. Returns the generated secret key (shown only once).',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'appId'],
                  properties: {
                    name: { type: 'string', example: 'University ERP System' },
                    appId: { type: 'string', example: 'UNIV_ERP_001' },
                    allowedOrigins: { type: 'array', items: { type: 'string' }, example: ['https://erp.university.edu'] },
                    allowedReferers: { type: 'array', items: { type: 'string' }, example: ['https://erp.university.edu/'] },
                    staffRoleMapping: { type: 'object', example: { 'LIBRARY_ADMIN': 'ADMIN', 'LIBRARIAN': 'LIBRARIAN' } },
                    patronRoleMapping: { type: 'object', example: { 'STUDENT': 'STUDENT', 'FACULTY': 'FACULTY' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Integration created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      integration: { $ref: '#/components/schemas/ERPIntegration' },
                      secretKey: { type: 'string', description: 'Plain text secret key (shown only once)', example: 'sk_live_abc123xyz789' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/erp-integrations/{id}/auth-config': {
        put: {
          tags: ['ERP Integrations'],
          summary: 'Step 1: Configure outbound authentication settings',
          description: `Configure authentication settings for outbound ERP communication.

**Required Settings:**
- **authClientSecret**: API secret provided by ERP for authentication (required for outbound calls)
- **authTokenTtlSeconds**: How long to cache the JWT token before refreshing (default: 3600 seconds)

**Optional Settings:**
- **authLoginUrl**: Override the login endpoint URL. If not set, defaults to \`{outboundBaseUrl}/auth/login\`

The Library uses these credentials to authenticate with ERP and obtain a JWT token for API calls.`,
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'ERP Integration ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authLoginUrl: { type: 'string', example: 'https://erp.university.edu/api/auth/login' },
                    authClientSecret: { type: 'string', example: 'secret123' },
                    authTokenTtlSeconds: { type: 'integer', example: 3600, description: 'Token TTL in seconds (default: 3600)' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Authentication configuration updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      authLoginUrl: { type: 'string' },
                      authTokenTtlSeconds: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '404': { description: 'ERP integration not found' },
          },
        },
      },
      '/api/erp-integrations/{id}/test-connection': {
        post: {
          tags: ['ERP Integrations'],
          summary: 'Step 2: Test connection and obtain JWT token',
          description: `Tests the outbound connection to ERP by performing the full authentication flow:

1. Sends POST request to ERP login endpoint with App ID and API Secret
2. Receives JWT token from ERP response
3. Stores the token for subsequent API calls
4. Reports token expiration time

**Request sent to ERP:**
\`\`\`json
POST {loginUrl}
{
  "appId": "{integration.appId}",
  "secret": "{authClientSecret}"
}
\`\`\`

**Expected ERP Response:**
\`\`\`json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600
}
\`\`\`

Use this endpoint to verify your authentication configuration is correct before using lookup endpoints.`,
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'ERP Integration ID',
            },
          ],
          responses: {
            '200': {
              description: 'Connection test result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      tokenExpiry: { type: 'string', format: 'date-time', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/erp-integrations/{id}/lookup/{userType}/{identifier}': {
        get: {
          tags: ['ERP Integrations'],
          summary: 'Step 3: Fetch user details from ERP using JWT token',
          description: `Fetches student or faculty details from ERP on demand.

**Authentication Flow:**
1. Uses cached JWT token (obtained via test-connection or auto-refresh)
2. If token expired, automatically authenticates and gets new token
3. Sends request to configured pull endpoint with Authorization header

**Request sent to ERP:**
\`\`\`
GET {pullEndpoint.url}?{identifier_param}={identifier}
Authorization: Bearer {jwt_token}
\`\`\`

**Response Mapping:**
The response from ERP is mapped using the configured field mappings in pull endpoints.

**Prerequisites:**
- Outbound authentication must be configured (auth-config)
- A pull endpoint must be configured for the user type (student/faculty)`,
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'ERP Integration ID',
            },
            {
              name: 'userType',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['student', 'faculty'] },
              description: 'Type of user to look up',
            },
            {
              name: 'identifier',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'User identifier (registration number, employee ID, etc.)',
              example: 'STU2024001',
            },
          ],
          responses: {
            '200': {
              description: 'User details from ERP',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      userType: { type: 'string' },
                      identifier: { type: 'string' },
                      details: {
                        type: 'object',
                        properties: {
                          registrationNumber: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          programName: { type: 'string' },
                          batchName: { type: 'string' },
                          session: { type: 'string' },
                          department: { type: 'string' },
                          userType: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid userType (must be STUDENT or FACULTY)' },
            '404': { description: 'User not found in ERP system' },
          },
        },
      },
      '/api/erp/verify-user': {
        post: {
          tags: ['ERP User Provisioning'],
          summary: 'Verify user exists in ERP',
          description: 'Verify a student or faculty member exists in the ERP system. Used for circulation and fine verification.',
          security: [{ erpSecretKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['appId', 'userType', 'identifier'],
                  properties: {
                    appId: { type: 'string', example: 'UNIV_ERP_001' },
                    userType: { type: 'string', enum: ['STUDENT', 'FACULTY'] },
                    identifier: { type: 'string', example: 'STU2024001' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' },
                      user: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          registrationNumber: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          program: { type: 'string' },
                          batch: { type: 'string' },
                          session: { type: 'string' },
                          department: { type: 'string' },
                          userType: { type: 'string' },
                        },
                      },
                      message: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing required fields' },
            '404': { description: 'ERP integration not found' },
          },
        },
      },
      '/api/system-config': {
        get: {
          tags: ['System Configuration'],
          summary: 'Get all system configuration',
          description: 'Returns all system configuration settings.',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'System configuration',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/SystemConfig' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/system-config/{key}': {
        get: {
          tags: ['System Configuration'],
          summary: 'Get a specific configuration value',
          description: 'Returns a specific system configuration setting by key.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Configuration key',
              example: 'authMode',
            },
          ],
          responses: {
            '200': {
              description: 'Configuration value',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SystemConfig' },
                },
              },
            },
            '404': {
              description: 'Configuration not found',
            },
          },
        },
        put: {
          tags: ['System Configuration'],
          summary: 'Update a configuration value',
          description: 'Updates a system configuration setting.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'key',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'authMode',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['value'],
                  properties: {
                    value: { type: 'string', example: 'HYBRID' },
                    description: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Configuration updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SystemConfig' },
                },
              },
            },
          },
        },
      },
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'List all users',
          description: 'Returns all users in the system.',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': {
              description: 'List of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Users'],
          summary: 'Create a new local user',
          description: 'Creates a new local user account.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'name', 'email', 'role', 'category'],
                  properties: {
                    username: { type: 'string', example: 'newuser' },
                    name: { type: 'string', example: 'New User' },
                    email: { type: 'string', example: 'newuser@library.edu' },
                    role: { type: 'string', enum: ['ADMIN', 'LIBRARIAN', 'STUDENT', 'FACULTY'] },
                    category: { type: 'string', enum: ['STAFF', 'PATRON'] },
                    password: { type: 'string', description: 'Optional, defaults to a random password' },
                    department: { type: 'string', nullable: true },
                    phone: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
      '/api/users/category/{category}': {
        get: {
          tags: ['Users'],
          summary: 'List users by category',
          description: 'Returns users filtered by category (STAFF or PATRON).',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'category',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['STAFF', 'PATRON'] },
              description: 'User category',
            },
          ],
          responses: {
            '200': {
              description: 'List of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/erp/catalog/search-attributes': {
        get: {
          tags: ['ERP Catalog'],
          summary: 'Get available search attribute filters',
          description: `Returns all active search attribute types and their values that students can use to filter the catalog.

The ERP system should call this endpoint to populate filter dropdowns/checkboxes in the student's catalog browsing interface.

**Example response structure:**
Each attribute type (e.g., "Program", "Semester", "Subject Type") contains its available values that students can select to narrow their search.`,
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '200': {
              description: 'List of search attribute types with their values',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      searchAttributes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            name: { type: 'string', example: 'Program' },
                            description: { type: 'string', nullable: true, example: 'Academic program' },
                            values: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'integer', example: 1 },
                                  value: { type: 'string', example: 'Computer Science' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  examples: {
                    withData: {
                      summary: 'Attributes with values',
                      value: {
                        searchAttributes: [
                          {
                            id: 1,
                            name: 'Program',
                            description: 'Academic program the resource is relevant to',
                            values: [
                              { id: 1, value: 'Computer Science' },
                              { id: 2, value: 'Mechanical Engineering' },
                              { id: 3, value: 'Electronics' },
                            ],
                          },
                          {
                            id: 2,
                            name: 'Semester',
                            description: 'Semester relevance',
                            values: [
                              { id: 4, value: 'Semester 1' },
                              { id: 5, value: 'Semester 2' },
                              { id: 6, value: 'Semester 3' },
                            ],
                          },
                          {
                            id: 3,
                            name: 'Subject Type',
                            description: null,
                            values: [
                              { id: 7, value: 'Core' },
                              { id: 8, value: 'Elective' },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing appId parameter',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/catalog/search': {
        get: {
          tags: ['ERP Catalog'],
          summary: 'Search catalog by attributes',
          description: `Search the library catalog using search attribute filters and/or text search.

**Important behavior:**
- At least one filter must be provided: \`attributeValueIds\` and/or \`q\` (text search)
- If results exceed the configured maximum (default: 50, configurable in Settings), the API returns \`success: false\` with a message asking the student to refine the search — no book data is returned
- When results are within the limit, \`success: true\` and the matching books are returned
- The maximum result limit is configurable by the library admin under Settings > Catalog Settings

**Recommended flow:**
1. First call \`GET /api/erp/catalog/search-attributes\` to get filter options
2. Student selects attribute values (e.g., Program=CS, Semester=3)
3. Call this endpoint with the selected value IDs
4. If too many results, prompt student to select more filters`,
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
            {
              name: 'attributeValueIds',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Comma-separated list of search attribute value IDs to filter by. Get available IDs from the search-attributes endpoint.',
              example: '1,4,7',
            },
            {
              name: 'q',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Text search query to match against book title, author, or ISBN',
              example: 'data structures',
            },
          ],
          responses: {
            '200': {
              description: 'Search results (may indicate limit exceeded)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', description: 'false if results exceed the maximum allowed limit' },
                      message: { type: 'string', description: 'Present when success is false, asking user to refine search' },
                      totalCount: { type: 'integer', description: 'Total number of matching books' },
                      maxAllowed: { type: 'integer', description: 'Current configured maximum results limit' },
                      books: {
                        type: 'array',
                        description: 'Empty array when success is false (limit exceeded)',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            isbn: { type: 'string', example: '978-0-13-468599-1' },
                            title: { type: 'string', example: 'Data Structures and Algorithms' },
                            author: { type: 'string', example: 'Alfred V. Aho' },
                            publisher: { type: 'string', example: 'Pearson' },
                            publishedYear: { type: 'integer', example: 2018 },
                            category: { type: 'string', example: 'Programming' },
                            format: { type: 'string', enum: ['PHYSICAL', 'EBOOK', 'AUDIOBOOK'] },
                            status: { type: 'string', enum: ['AVAILABLE', 'CHECKED_OUT', 'RESERVED', 'LOST', 'MAINTENANCE'] },
                            coverUrl: { type: 'string', nullable: true },
                            shelfLocation: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                  },
                  examples: {
                    successfulSearch: {
                      summary: 'Successful search (within limit)',
                      value: {
                        success: true,
                        totalCount: 3,
                        maxAllowed: 50,
                        books: [
                          {
                            id: 1,
                            isbn: '978-0-13-468599-1',
                            title: 'Data Structures and Algorithms',
                            author: 'Alfred V. Aho',
                            publisher: 'Pearson',
                            publishedYear: 2018,
                            category: 'Programming',
                            format: 'PHYSICAL',
                            status: 'AVAILABLE',
                            coverUrl: null,
                            shelfLocation: 'A-12-3',
                          },
                        ],
                      },
                    },
                    limitExceeded: {
                      summary: 'Too many results — refine search',
                      value: {
                        success: false,
                        message: 'Your search returned 127 results which exceeds the maximum of 50. Please refine your search by selecting more specific filters.',
                        totalCount: 127,
                        maxAllowed: 50,
                        books: [],
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing required parameters or no filters provided',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/digital-resources/search-attributes': {
        get: {
          tags: ['ERP Digital Resources'],
          summary: 'Get available search attribute filters for digital resources',
          description: `Returns all active search attribute types and their values that can be used to filter digital resources (e-books, videos, lecture notes, etc.).

This is the same shared search-attribute taxonomy used by the physical book catalog (\`/api/erp/catalog/search-attributes\`) — attribute values assigned to digital resources come from the same pool.

The ERP system should call this endpoint to populate filter dropdowns/checkboxes before searching digital resources.`,
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '200': {
              description: 'List of search attribute types with their values',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      searchAttributes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            name: { type: 'string', example: 'Program' },
                            description: { type: 'string', nullable: true, example: 'Academic program' },
                            values: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'integer', example: 1 },
                                  value: { type: 'string', example: 'Computer Science' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  examples: {
                    withData: {
                      summary: 'Attributes with values',
                      value: {
                        searchAttributes: [
                          {
                            id: 3,
                            name: 'Course',
                            description: null,
                            values: [
                              { id: 4, value: 'Artificial Intelligence' },
                              { id: 5, value: 'Data Science' },
                            ],
                          },
                          {
                            id: 4,
                            name: 'Semester',
                            description: null,
                            values: [
                              { id: 9, value: 'Sem 1' },
                              { id: 10, value: 'Sem 2' },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing appId parameter',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/digital-resources/search': {
        get: {
          tags: ['ERP Digital Resources'],
          summary: 'Search digital resources by attributes',
          description: `Search published digital resources (e-books, videos, lecture notes, etc.) using search attribute filters and/or text search.

**Important behavior:**
- At least one filter must be provided: \`attributeValueIds\` and/or \`q\` (text search)
- Only resources with status \`PUBLISHED\` and visibility \`INSTITUTION\` (institution-wide) are returned — resources restricted to a department, course, batch, specific users, or specific roles are excluded from this external API for privacy
- If results exceed the configured maximum (shared with the catalog's \`erp_catalog_limit\` setting, default: 50), the API returns \`success: false\` with a message asking to refine the search — no resource data is returned
- When results are within the limit, \`success: true\` and the matching resources are returned

**Recommended flow:**
1. First call \`GET /api/erp/digital-resources/search-attributes\` to get filter options
2. User selects attribute values (e.g., Course=Data Science, Semester=3)
3. Call this endpoint with the selected value IDs and/or a text query
4. If too many results, prompt the user to select more filters`,
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
            {
              name: 'attributeValueIds',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Comma-separated list of search attribute value IDs to filter by. Get available IDs from the search-attributes endpoint.',
              example: '4,9',
            },
            {
              name: 'q',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Text search query to match against resource title, author, or subject',
              example: 'algorithms',
            },
          ],
          responses: {
            '200': {
              description: 'Search results (may indicate limit exceeded)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', description: 'false if results exceed the maximum allowed limit' },
                      message: { type: 'string', description: 'Present when success is false, asking user to refine search' },
                      totalCount: { type: 'integer', description: 'Total number of matching digital resources' },
                      maxAllowed: { type: 'integer', description: 'Current configured maximum results limit' },
                      resources: {
                        type: 'array',
                        description: 'Empty array when success is false (limit exceeded)',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 39 },
                            title: { type: 'string', example: 'Intro to Algorithms' },
                            shortDescription: { type: 'string', nullable: true },
                            resourceType: { type: 'string', example: 'PDF' },
                            category: { type: 'string', example: 'TEXTBOOK' },
                            author: { type: 'string', nullable: true },
                            department: { type: 'string', nullable: true },
                            subject: { type: 'string', nullable: true },
                            language: { type: 'string', nullable: true },
                            difficulty: { type: 'string', nullable: true, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
                            thumbnailUrl: { type: 'string', nullable: true },
                            allowDownload: { type: 'boolean' },
                            allowPreview: { type: 'boolean' },
                            publishDate: { type: 'string', format: 'date-time', nullable: true },
                            accessType: { type: 'string', enum: ['DOWNLOAD', 'EXTERNAL_LINK', 'NONE'], description: 'DOWNLOAD if the resource has an uploaded file, EXTERNAL_LINK if it only points to an external URL, NONE if neither' },
                            downloadUrl: { type: 'string', nullable: true, description: 'Full URL to call (GET, same ERP auth) to retrieve the file download link or external URL. Null when allowDownload is false.' },
                          },
                        },
                      },
                    },
                  },
                  examples: {
                    successfulSearch: {
                      summary: 'Successful search (within limit)',
                      value: {
                        success: true,
                        totalCount: 1,
                        maxAllowed: 50,
                        resources: [
                          {
                            id: 1,
                            title: 'Intro to Algorithms',
                            shortDescription: null,
                            resourceType: 'PDF',
                            category: 'TEXTBOOK',
                            author: null,
                            department: 'CS',
                            subject: null,
                            language: null,
                            difficulty: null,
                            thumbnailUrl: null,
                            allowDownload: true,
                            allowPreview: true,
                            publishDate: null,
                            accessType: 'DOWNLOAD',
                            downloadUrl: 'https://your-app.replit.app/api/erp/digital-resources/1/download',
                          },
                        ],
                      },
                    },
                    limitExceeded: {
                      summary: 'Too many results — refine search',
                      value: {
                        success: false,
                        message: 'Your search returned 84 results which exceeds the maximum of 50. Please refine your search by selecting more specific filters.',
                        totalCount: 84,
                        maxAllowed: 50,
                        resources: [],
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing required parameters or no filters provided',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/digital-resources/{id}/download': {
        get: {
          tags: ['ERP Digital Resources'],
          summary: 'Get the download link or external link for a digital resource',
          description: `Retrieves how to access a specific digital resource's content: either a direct file download URL (for resources hosted in the library system) or an external URL (for resources that link out to a third-party page/platform).

**Important behavior:**
- Only resources with status \`PUBLISHED\` and visibility \`INSTITUTION\` can be accessed via this endpoint (same restriction as the search endpoint)
- Returns 403 if downloads are disabled for the resource (\`allowDownload: false\`)
- \`accessType: "DOWNLOAD"\` — the resource has an uploaded file; \`fileUrl\` is a full, directly-downloadable URL to the file
- \`accessType: "EXTERNAL_LINK"\` — the resource only has an external URL (e.g. a link to a publisher's site or external video); navigate the user there instead of expecting a downloadable file
- Each successful call increments the resource's download counter, same as the in-app download action`,
          security: [{ erpSecretKey: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Digital resource ID',
              example: 1,
            },
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'ERP integration App ID',
              example: 'UNIV_ERP_001',
            },
          ],
          responses: {
            '200': {
              description: 'Access info for the resource',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessType: { type: 'string', enum: ['DOWNLOAD', 'EXTERNAL_LINK'] },
                      fileUrl: { type: 'string', description: 'Present when accessType is DOWNLOAD — full downloadable URL' },
                      fileName: { type: 'string', nullable: true },
                      fileSizeBytes: { type: 'integer', nullable: true },
                      externalUrl: { type: 'string', description: 'Present when accessType is EXTERNAL_LINK — URL to navigate the user to' },
                    },
                  },
                  examples: {
                    fileDownload: {
                      summary: 'Hosted file download',
                      value: {
                        accessType: 'DOWNLOAD',
                        fileUrl: 'https://your-app.replit.app/uploads/digital-resources/sample.pdf',
                        fileName: 'Intro to Algorithms.pdf',
                        fileSizeBytes: 2457600,
                      },
                    },
                    externalLink: {
                      summary: 'External link resource',
                      value: {
                        accessType: 'EXTERNAL_LINK',
                        externalUrl: 'https://publisher.example.com/book/12345',
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing appId or invalid resource id',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '403': {
              description: 'Resource not available via external API, or downloads disabled',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration or digital resource not found, or resource has no file/link',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/library-users/{externalId}/status': {
        patch: {
          tags: ['ERP User Provisioning'],
          summary: 'Update user status (activate/deactivate)',
          description: `Update the status of a library staff member or patron. 

**When set to INACTIVE:**
- **Staff (Admin/Librarian):** Cannot log in to the library console (both local login and SSO are blocked)
- **Patrons (Student/Faculty):** Cannot check out any books. SSO login is also blocked.

**When set back to ACTIVE:**
- User regains full access according to their role.

**Use Cases:**
- Student graduates or is suspended → ERP sends INACTIVE status
- Employee leaves the institution → ERP sends INACTIVE status
- Student rejoins or is reinstated → ERP sends ACTIVE status`,
          parameters: [
            {
              name: 'X-Secret-Key',
              in: 'header',
              required: true,
              schema: { type: 'string' },
              description: 'The secret key configured for this ERP integration',
            },
            {
              name: 'externalId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'The external ID of the user (student roll number, employee ID, etc.)',
            },
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'The ERP integration App ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['ACTIVE', 'INACTIVE'],
                      description: 'The new status for the user',
                    },
                  },
                },
                examples: {
                  deactivate: {
                    summary: 'Mark user as inactive',
                    value: { status: 'INACTIVE' },
                  },
                  reactivate: {
                    summary: 'Reactivate user',
                    value: { status: 'ACTIVE' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'User status updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string', example: 'User status updated to INACTIVE' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 5 },
                          externalId: { type: 'string', example: '202601001' },
                          name: { type: 'string', example: 'John Doe' },
                          role: { type: 'string', example: 'STUDENT' },
                          category: { type: 'string', example: 'PATRON' },
                          status: { type: 'string', example: 'INACTIVE' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing appId or invalid status value',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration or user not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/transactions': {
        get: {
          tags: ['ERP Transactions'],
          summary: 'Get circulation transactions',
          description: 'Retrieve circulation transactions (issued/returned books) for an ERP integration. Use the `externalId` filter to get books issued to a specific student or staff member. Use the `status` filter to get only active checkouts, returned books, or overdue items.',
          parameters: [
            {
              name: 'X-Secret-Key',
              in: 'header',
              required: true,
              schema: { type: 'string' },
              description: 'The secret key configured for this ERP integration',
            },
            {
              name: 'appId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'The ERP integration App ID',
            },
            {
              name: 'externalId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Filter by student/staff external ID to get books issued to a specific user (e.g., student roll number or employee ID)',
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'ACTIVE,OVERDUE' },
              description: 'Comma-separated list of statuses to filter by. Valid values: ACTIVE, RETURNED, OVERDUE, LOST. Example: "ACTIVE" to get only currently issued books, or "ACTIVE,OVERDUE" to include overdue items.',
            },
          ],
          responses: {
            '200': {
              description: 'List of transactions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      totalCount: { type: 'integer', example: 2 },
                      transactions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            transactionId: { type: 'integer', example: 1 },
                            status: { type: 'string', enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'LOST'], example: 'ACTIVE' },
                            member: {
                              type: 'object',
                              properties: {
                                memberId: { type: 'string', example: '202601001', description: 'Student ID, employee ID, or external ID' },
                                name: { type: 'string', example: 'John Doe' },
                                email: { type: 'string', example: 'john@university.edu' },
                                role: { type: 'string', example: 'STUDENT' },
                              },
                            },
                            book: {
                              type: 'object',
                              properties: {
                                bookId: { type: 'integer', example: 1 },
                                isbn: { type: 'string', example: '9781234567890' },
                                title: { type: 'string', example: 'Data Structures' },
                                author: { type: 'string', example: 'Author Name' },
                                publisher: { type: 'string', example: 'Publisher' },
                                category: { type: 'string', example: 'Computer Science' },
                              },
                            },
                            issueDate: { type: 'string', format: 'date-time', example: '2026-03-01T10:00:00.000Z' },
                            dueDate: { type: 'string', format: 'date-time', example: '2026-03-15T10:00:00.000Z' },
                            returnDate: { type: 'string', format: 'date-time', nullable: true, example: null },
                            fineAmount: { type: 'string', nullable: true, example: '0' },
                            fineStatus: { type: 'string', nullable: true, example: null },
                            renewalCount: { type: 'integer', example: 0 },
                          },
                        },
                      },
                    },
                  },
                  examples: {
                    activeBooks: {
                      summary: 'Books currently issued to a student',
                      value: {
                        success: true,
                        totalCount: 2,
                        transactions: [
                          {
                            transactionId: 5,
                            status: 'ACTIVE',
                            member: { memberId: '202601001', name: 'Arijit Singh', email: 'arijit@university.edu', role: 'STUDENT' },
                            book: { bookId: 1, isbn: '9781234567890', title: 'Data Structures & Algorithms', author: 'Thomas Cormen', publisher: 'MIT Press', category: 'Computer Science' },
                            issueDate: '2026-03-01T10:00:00.000Z',
                            dueDate: '2026-03-15T10:00:00.000Z',
                            returnDate: null,
                            fineAmount: '0',
                            fineStatus: null,
                            renewalCount: 0,
                          },
                          {
                            transactionId: 7,
                            status: 'OVERDUE',
                            member: { memberId: '202601001', name: 'Arijit Singh', email: 'arijit@university.edu', role: 'STUDENT' },
                            book: { bookId: 3, isbn: '9780987654321', title: 'Operating Systems', author: 'Silberschatz', publisher: 'Wiley', category: 'Computer Science' },
                            issueDate: '2026-02-01T10:00:00.000Z',
                            dueDate: '2026-02-15T10:00:00.000Z',
                            returnDate: null,
                            fineAmount: '30',
                            fineStatus: 'PENDING',
                            renewalCount: 0,
                          },
                        ],
                      },
                    },
                    emptyResult: {
                      summary: 'No books issued to this student',
                      value: {
                        success: true,
                        totalCount: 0,
                        transactions: [],
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing appId parameter',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '401': {
              description: 'Missing or invalid secret key',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '403': {
              description: 'ERP integration is disabled',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '404': {
              description: 'ERP integration not found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/erp/books': {
        get: {
          tags: ['ERP Books'],
          summary: 'List books with optional search & attribute filters',
          description: 'Returns one or more books. Supports free-text search (`q`), ISBN lookup (`isbn`), and faceted filtering by `attributeValueIds` (CSV). Each book includes per-library copy availability.',
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'q', in: 'query', required: false, schema: { type: 'string' }, description: 'Free text search across title/author/ISBN' },
            { name: 'isbn', in: 'query', required: false, schema: { type: 'string' }, description: 'Exact ISBN lookup' },
            { name: 'attributeValueIds', in: 'query', required: false, schema: { type: 'string' }, description: 'Comma-separated search attribute value IDs' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50, maximum: 200 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
          ],
          responses: {
            '200': {
              description: 'List of books with availability per library',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  totalCount: { type: 'integer' },
                  limit: { type: 'integer' },
                  offset: { type: 'integer' },
                  books: { type: 'array', items: {
                    type: 'object',
                    properties: {
                      bookId: { type: 'integer' }, isbn: { type: 'string' }, title: { type: 'string' }, author: { type: 'string' },
                      publisher: { type: 'string' }, publishedYear: { type: 'integer' }, category: { type: 'string' }, format: { type: 'string' },
                      coverUrl: { type: 'string' },
                      totalCopies: { type: 'integer' }, availableCopies: { type: 'integer' },
                      libraries: { type: 'array', items: {
                        type: 'object',
                        properties: {
                          libraryId: { type: 'integer' }, libraryCode: { type: 'string' }, libraryName: { type: 'string' },
                          total: { type: 'integer' }, available: { type: 'integer' }, reserved: { type: 'integer' }, checkedOut: { type: 'integer' },
                        },
                      } },
                    },
                  } },
                },
              } } },
            },
            '401': { description: 'Missing/invalid secret key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'ERP integration not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/erp/books/{idOrIsbn}/status': {
        get: {
          tags: ['ERP Books'],
          summary: 'Get book status (availability + optional patron context)',
          description: 'Returns aggregate copy status for the book (available/reserved/checked out/lost/maintenance). When `externalId` is provided, also returns the patron\'s relationship to this book: `RESERVED`, `CHECKED_OUT`, `RETURNED`, or `NONE`.',
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'idOrIsbn', in: 'path', required: true, schema: { type: 'string' }, description: 'Book ID (numeric) or ISBN' },
            { name: 'externalId', in: 'query', required: false, schema: { type: 'string' }, description: 'Patron external ID for personalised status' },
          ],
          responses: {
            '200': {
              description: 'Book status',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  book: { type: 'object', properties: { bookId: { type: 'integer' }, isbn: { type: 'string' }, title: { type: 'string' }, author: { type: 'string' } } },
                  copies: { type: 'object', properties: { total: { type: 'integer' }, available: { type: 'integer' }, reserved: { type: 'integer' }, checkedOut: { type: 'integer' }, lost: { type: 'integer' }, maintenance: { type: 'integer' } } },
                  patronStatus: { type: 'object', nullable: true, properties: {
                    externalId: { type: 'string' }, found: { type: 'boolean' },
                    status: { type: 'string', enum: ['NONE', 'RESERVED', 'CHECKED_OUT', 'RETURNED'] },
                    patron: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
                    reservation: { type: 'object', nullable: true },
                    checkout: { type: 'object', nullable: true },
                    lastReturned: { type: 'object', nullable: true },
                  } },
                },
              } } },
            },
            '404': { description: 'Book or integration not found' },
          },
        },
      },
      '/api/erp/reservations': {
        post: {
          tags: ['ERP Reservations'],
          summary: 'Create a book reservation on behalf of a patron',
          description: 'Reserves an available copy for a patron known to the ERP. If `libraryId` is omitted, the system picks the first library that has an available copy and atomically holds it.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['appId', 'externalId'],
              properties: {
                appId: { type: 'string' },
                externalId: { type: 'string', description: 'Patron external ID known to the ERP' },
                bookId: { type: 'integer', description: 'Either bookId or isbn is required' },
                isbn: { type: 'string' },
                libraryId: { type: 'integer', description: 'Optional. Auto-selected if omitted.' },
                reservedFor: { type: 'string', format: 'date-time', description: 'Defaults to now.' },
                notes: { type: 'string' },
              },
            } } },
          },
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '201': {
              description: 'Reservation created',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  reservation: { type: 'object', properties: {
                    reservationId: { type: 'integer' },
                    status: { type: 'string', example: 'ACTIVE' },
                    patron: { type: 'object' }, book: { type: 'object' }, library: { type: 'object' }, copy: { type: 'object' },
                    reservedFor: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' },
                  } },
                },
              } } },
            },
            '400': { description: 'Missing required fields' },
            '404': { description: 'Patron, book, or integration not found' },
            '409': { description: 'No copies available to reserve' },
          },
        },
      },
      '/api/erp/users/{externalId}/fines': {
        get: {
          tags: ['ERP Fines'],
          summary: 'Get fine information for a patron',
          description: 'Returns per-circulation fine, damage cost, payments, waivers, and live-accrued fine on currently open loans, plus aggregated totals.',
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'externalId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Patron fine breakdown',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  patron: { type: 'object', properties: { externalId: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
                  totals: { type: 'object', properties: { assessed: { type: 'number' }, paid: { type: 'number' }, waived: { type: 'number' }, outstanding: { type: 'number' }, accruedOnOpenLoans: { type: 'number' } } },
                  items: { type: 'array', items: {
                    type: 'object',
                    properties: {
                      circulationId: { type: 'integer' }, status: { type: 'string' }, isOverdue: { type: 'boolean' }, daysOverdue: { type: 'integer' },
                      book: { type: 'object' }, checkoutDate: { type: 'string', format: 'date-time' }, dueDate: { type: 'string', format: 'date-time' }, returnDate: { type: 'string', format: 'date-time', nullable: true },
                      fine: { type: 'object', properties: { assessed: { type: 'number' }, paid: { type: 'number' }, waived: { type: 'number' }, outstanding: { type: 'number' }, accruedIfOpen: { type: 'number' } } },
                      damage: { type: 'object', properties: { cost: { type: 'number' }, paid: { type: 'number' }, waived: { type: 'number' }, outstanding: { type: 'number' } } },
                    },
                  } },
                },
              } } },
            },
            '404': { description: 'Patron not found' },
          },
        },
      },
      '/api/erp/fines/summary': {
        get: {
          tags: ['ERP Fines'],
          summary: 'ERP-wide fine aggregates',
          description: 'Returns ERP-wide fine totals, open/overdue loan counts, and per-library breakdown. Scoped to patrons provisioned via the authenticating ERP integration.',
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' } },
            { name: 'appId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Aggregated fine information',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  totals: { type: 'object', properties: { assessed: { type: 'number' }, paid: { type: 'number' }, waived: { type: 'number' }, outstanding: { type: 'number' }, accruedOnOpenLoans: { type: 'number' } } },
                  loans: { type: 'object', properties: { open: { type: 'integer' }, overdue: { type: 'integer' }, total: { type: 'integer' } } },
                  byLibrary: { type: 'array', items: { type: 'object', properties: { libraryId: { type: 'integer' }, libraryName: { type: 'string' }, assessed: { type: 'number' }, paid: { type: 'number' }, waived: { type: 'number' }, outstanding: { type: 'number' } } } },
                },
              } } },
            },
            '401': { description: 'Missing or invalid secret key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'ERP integration disabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/erp/fine-payments': {
        post: {
          tags: ['ERP Fines'],
          summary: 'Push fine payment data from ERP',
          description: `Record one or more fine/damage payments for a patron via the ERP integration.

**Use case**: When a patron settles outstanding library fines through the ERP portal or any integrated payment gateway, the ERP calls this endpoint to reconcile the payment in LibraTech.

**Amount format**: All monetary amounts are in major currency units (e.g. \`25.50\` for ₹25.50 or $25.50). Do **not** send amounts in paise/cents.

**Payment method**: Use the \`code\` field of a configured LibraTech payment method (e.g. \`CASH\`, \`UPI\`, \`CARD\`). Inactive methods are rejected.

**Validation**: Each payment item is validated — amounts cannot exceed the outstanding balance for that circulation.`,
          parameters: [
            { name: 'X-Secret-Key', in: 'header', required: true, schema: { type: 'string' }, description: 'ERP secret key' },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['appId', 'externalId', 'paymentMethodCode', 'payments'],
              properties: {
                appId: { type: 'string', description: 'ERP application ID' },
                externalId: { type: 'string', description: 'Patron external ID as provisioned in the ERP' },
                paymentMethodCode: { type: 'string', description: 'Payment method code configured in LibraTech (e.g. CASH, UPI, CARD, BANK)', example: 'UPI' },
                referenceNumber: { type: 'string', description: 'Transaction / reference number from the payment gateway', example: 'TXN20260520001' },
                notes: { type: 'string', description: 'Optional notes about the payment batch' },
                payments: {
                  type: 'array',
                  minItems: 1,
                  description: 'List of per-circulation payment amounts. At least one of fineAmount or damageAmount must be provided per item.',
                  items: {
                    type: 'object',
                    required: ['circulationId'],
                    properties: {
                      circulationId: { type: 'integer', description: 'Circulation record ID (from GET /api/erp/users/:externalId/fines)' },
                      fineAmount: { type: 'number', format: 'float', description: 'Amount to apply towards the overdue fine (major currency units). Cannot exceed outstanding fine balance.', example: 15.00 },
                      damageAmount: { type: 'number', format: 'float', description: 'Amount to apply towards the damage cost (major currency units). Cannot exceed outstanding damage balance.', example: 0 },
                    },
                  },
                },
              },
              example: {
                appId: 'erp-main',
                externalId: 'STU2026001',
                paymentMethodCode: 'UPI',
                referenceNumber: 'TXN20260520001',
                payments: [
                  { circulationId: 42, fineAmount: 15.00, damageAmount: 0 },
                  { circulationId: 57, fineAmount: 8.50, damageAmount: 200.00 },
                ],
              },
            } } },
          },
          responses: {
            '200': {
              description: 'Payments applied successfully',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  patron: { type: 'object', properties: { externalId: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } },
                  paymentMethod: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' } } },
                  totalApplied: { type: 'number', description: 'Total amount applied across all items (major currency units)', example: 223.50 },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        circulationId: { type: 'integer' },
                        fineApplied: { type: 'number', description: 'Fine amount applied' },
                        damageApplied: { type: 'number', description: 'Damage amount applied' },
                        newFineOutstanding: { type: 'number', description: 'Remaining fine balance after this payment' },
                        newDamageOutstanding: { type: 'number', description: 'Remaining damage balance after this payment' },
                        newFineStatus: { type: 'string', enum: ['OUTSTANDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED'] },
                        newDamageStatus: { type: 'string', enum: ['NONE', 'OUTSTANDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED'] },
                      },
                    },
                  },
                },
              },
              examples: {
                success: {
                  summary: 'Two circulations settled',
                  value: {
                    success: true,
                    patron: { externalId: 'STU2026001', name: 'Arijit Singh', email: 'arijit@university.edu' },
                    paymentMethod: { code: 'UPI', name: 'UPI' },
                    totalApplied: 223.50,
                    items: [
                      { circulationId: 42, fineApplied: 15.00, damageApplied: 0, newFineOutstanding: 0, newDamageOutstanding: 0, newFineStatus: 'PAID', newDamageStatus: 'NONE' },
                      { circulationId: 57, fineApplied: 8.50, damageApplied: 200.00, newFineOutstanding: 0, newDamageOutstanding: 0, newFineStatus: 'PAID', newDamageStatus: 'PAID' },
                    ],
                  },
                },
              },
              } },
            },
            '400': {
              description: 'Validation error — missing fields, unknown payment method, or payment exceeds outstanding balance',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' },
                examples: {
                  missingField: { summary: 'Missing externalId', value: { error: 'externalId is required' } },
                  unknownMethod: { summary: 'Unknown payment method', value: { error: "Payment method 'CHEQUE' not found or inactive" } },
                  overflow: { summary: 'Payment exceeds balance', value: { error: 'Fine payment (2000) exceeds outstanding (1500) for circulation 42' } },
                },
              } },
            },
            '401': { description: 'Missing or invalid secret key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'ERP integration disabled or circulation belongs to a different patron', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Patron or circulation not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'LibraTech API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
