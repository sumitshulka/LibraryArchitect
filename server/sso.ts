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
  
  return crypto.timingSafeEqual(
    Buffer.from(payload.signature),
    Buffer.from(expectedSignature)
  );
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

export function mapERPUserToLibraryUser(payload: SSOTokenPayload): ValidatedSSOUser {
  let category: 'STAFF' | 'PATRON';
  let role: 'ADMIN' | 'LIBRARIAN' | 'STUDENT' | 'FACULTY';
  let employeeId: string | undefined;
  let studentId: string | undefined;
  
  if (payload.userType === 'EMPLOYEE') {
    category = 'STAFF';
    if (payload.role?.toUpperCase() === 'ADMIN' || payload.role?.toUpperCase() === 'ADMINISTRATOR') {
      role = 'ADMIN';
    } else {
      role = 'LIBRARIAN';
    }
    employeeId = payload.userId;
  } else if (payload.userType === 'FACULTY') {
    category = 'PATRON';
    role = 'FACULTY';
    studentId = payload.userId;
  } else {
    category = 'PATRON';
    role = 'STUDENT';
    studentId = payload.userId;
  }
  
  return {
    externalId: payload.userId,
    name: payload.name,
    email: payload.email,
    category,
    role,
    department: payload.department,
    employeeId,
    studentId
  };
}

export function generateSessionId(): string {
  return nanoid(32);
}

export function isOriginWhitelisted(
  origin: string | undefined,
  referer: string | undefined,
  whitelist: ErpWhitelist[]
): boolean {
  if (whitelist.length === 0) return true;
  
  const sourceUrl = origin || referer;
  if (!sourceUrl) return false;
  
  return whitelist.some(entry => {
    if (!entry.isActive) return false;
    
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
