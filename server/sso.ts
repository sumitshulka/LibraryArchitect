import crypto from 'crypto';
import { nanoid } from 'nanoid';
import type { User, ErpIntegration, ErpWhitelist } from '@shared/schema';

export interface SSOTokenPayload {
  appId: string;
  userId: string;
  userType: 'EMPLOYEE' | 'STUDENT' | 'FACULTY';
  role?: string;
  name: string;
  email: string;
  department?: string;
  timestamp: number;
  signature: string;
}

export interface ValidatedSSOUser {
  externalId: string;
  name: string;
  email: string;
  category: 'STAFF' | 'PATRON';
  role: 'ADMIN' | 'LIBRARIAN' | 'STUDENT' | 'FACULTY';
  department?: string;
  employeeId?: string;
  studentId?: string;
}

const TOKEN_EXPIRY_SECONDS = 300;

export function generateSSOToken(
  payload: Omit<SSOTokenPayload, 'signature' | 'timestamp'>,
  secretKey: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const dataToSign = JSON.stringify({
    appId: payload.appId,
    userId: payload.userId,
    userType: payload.userType,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    department: payload.department,
    timestamp
  });
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(dataToSign)
    .digest('hex');
  
  const fullPayload: SSOTokenPayload = {
    ...payload,
    timestamp,
    signature
  };
  
  return Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
}

export function decodeToken(token: string): SSOTokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as SSOTokenPayload;
  } catch {
    return null;
  }
}

export function verifyTokenSignature(
  payload: SSOTokenPayload,
  secretKey: string
): boolean {
  try {
    const dataToSign = JSON.stringify({
      appId: payload.appId,
      userId: payload.userId,
      userType: payload.userType,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      department: payload.department,
      timestamp: payload.timestamp
    });
    
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(dataToSign)
      .digest('hex');
    
    const providedBuffer = Buffer.from(payload.signature || '', 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function isTokenExpired(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (now - timestamp) > TOKEN_EXPIRY_SECONDS;
}

export function verifySecretKey(
  providedSecret: string,
  storedHash: string,
  salt: string
): boolean {
  const hashToVerify = crypto
    .pbkdf2Sync(providedSecret, salt, 10000, 64, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hashToVerify),
    Buffer.from(storedHash)
  );
}

export function hashSecretKey(secretKey: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto
    .pbkdf2Sync(secretKey, salt, 10000, 64, 'sha512')
    .toString('hex');
  return { hash, salt };
}

export interface RoleMappingResult {
  success: boolean;
  user?: ValidatedSSOUser;
  error?: string;
}

export function mapERPUserToLibraryUser(payload: SSOTokenPayload): RoleMappingResult {
  let category: 'STAFF' | 'PATRON';
  let role: 'ADMIN' | 'LIBRARIAN' | 'STUDENT' | 'FACULTY';
  let employeeId: string | undefined;
  let studentId: string | undefined;
  
  const erpRole = payload.role?.toUpperCase() || '';
  
  if (payload.userType === 'EMPLOYEE') {
    // Only specific library roles are allowed for employees
    if (erpRole === 'LIBRARY_ADMIN' || erpRole === 'LIBRARYADMIN') {
      category = 'STAFF';
      role = 'ADMIN';
      employeeId = payload.userId;
    } else if (erpRole === 'LIBRARIAN' || erpRole === 'LIBRARY_STAFF') {
      category = 'STAFF';
      role = 'LIBRARIAN';
      employeeId = payload.userId;
    } else {
      // Employees without library-specific roles are not authorized
      return {
        success: false,
        error: `Employee role '${payload.role || 'none'}' is not authorized for library access. Only LIBRARY_ADMIN or LIBRARIAN roles are permitted.`
      };
    }
  } else if (payload.userType === 'FACULTY') {
    category = 'PATRON';
    role = 'FACULTY';
    studentId = payload.userId;
  } else if (payload.userType === 'STUDENT') {
    category = 'PATRON';
    role = 'STUDENT';
    studentId = payload.userId;
  } else {
    return {
      success: false,
      error: `Unknown user type '${payload.userType}'. Expected EMPLOYEE, FACULTY, or STUDENT.`
    };
  }
  
  return {
    success: true,
    user: {
      externalId: payload.userId,
      name: payload.name,
      email: payload.email,
      category,
      role,
      department: payload.department,
      employeeId,
      studentId
    }
  };
}

export function generateSessionId(): string {
  return nanoid(32);
}

export function isOriginWhitelisted(
  origin: string | undefined,
  referer: string | undefined,
  whitelist: ErpWhitelist[],
  requireWhitelist: boolean = false
): boolean {
  const activeWhitelist = whitelist.filter(e => e.isActive);
  
  if (activeWhitelist.length === 0) {
    return !requireWhitelist;
  }
  
  const sourceUrl = origin || referer;
  if (!sourceUrl) return false;
  
  return activeWhitelist.some(entry => {
    try {
      const url = new URL(sourceUrl);
      const pattern = entry.urlPattern;
      
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(url.origin) || regex.test(url.hostname);
      }
      
      return url.origin === pattern || url.hostname === pattern;
    } catch {
      return false;
    }
  });
}
