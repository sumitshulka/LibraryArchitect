import type { Request } from "express";
import { storage } from "./storage";
import type { InsertAuditLog } from "@shared/schema";

type AuditCategory = 
  | 'AUTHENTICATION' | 'USER_MANAGEMENT' | 'CATALOG' | 'CIRCULATION'
  | 'FINES' | 'INVENTORY' | 'REPORTS' | 'ERP_INTEGRATION'
  | 'SYSTEM_CONFIG' | 'STAFF_ALLOCATION';

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

export function getClientInfo(req: Request) {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
    || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return { ipAddress, userAgent };
}

export async function logAudit(req: Request, params: AuditLogParams): Promise<void> {
  try {
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
