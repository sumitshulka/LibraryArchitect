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
