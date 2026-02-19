import type { Request } from "express";
import { storage } from "./storage";
import type { InsertAuditLog } from "@shared/schema";

const AUDIT_CATEGORIES = [
  'AUTHENTICATION', 'USER_MANAGEMENT', 'CATALOG', 'CIRCULATION',
  'FINES', 'INVENTORY', 'REPORTS', 'ERP_INTEGRATION',
  'SYSTEM_CONFIG', 'STAFF_ALLOCATION', 'API_ACCESS'
] as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[number];

interface AuditLogParams {
  category: AuditCategory;
  action: string;
  status?: 'SUCCESS' | 'FAILURE';
  userId?: number | null;
  userName?: string | null;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  errorMessage?: string;
}

let auditConfigCache: Record<string, boolean> = {};
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function loadAuditConfig(): Promise<Record<string, boolean>> {
  try {
    const configs = await storage.getAllSystemConfig();
    const result: Record<string, boolean> = {};
    for (const cat of AUDIT_CATEGORIES) {
      const key = `audit.${cat}`;
      const config = configs.find(c => c.key === key);
      if (config) {
        result[cat] = config.value === 'true';
      } else {
        result[cat] = cat !== 'API_ACCESS';
      }
    }
    auditConfigCache = result;
    cacheLoadedAt = Date.now();
    return result;
  } catch (err) {
    console.error('Failed to load audit config:', err);
    return auditConfigCache;
  }
}

export function invalidateAuditConfigCache(): void {
  cacheLoadedAt = 0;
}

async function isAuditEnabled(category: AuditCategory): Promise<boolean> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadAuditConfig();
  }
  const enabled = auditConfigCache[category];
  return enabled !== undefined ? enabled : (category !== 'API_ACCESS');
}

export function getClientInfo(req: Request) {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return { ipAddress, userAgent };
}

export async function logAudit(req: Request, params: AuditLogParams): Promise<void> {
  try {
    const enabled = await isAuditEnabled(params.category);
    if (!enabled) return;

    const { ipAddress, userAgent } = getClientInfo(req);
    const log: InsertAuditLog = {
      category: params.category,
      action: params.action,
      status: params.status || 'SUCCESS',
      userId: params.userId ?? null,
      userName: params.userName ?? null,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      details: params.details ?? null,
      ipAddress,
      userAgent,
      errorMessage: params.errorMessage ?? null,
    };
    await storage.createAuditLog(log);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
