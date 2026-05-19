import { storage } from "./storage";
import { db } from "./db";
import { circulationPolicyVersions } from "@shared/schema";
import { and, desc, eq, isNull, lte } from "drizzle-orm";
import type { Circulation, Library, CirculationPolicyVersion } from "@shared/schema";

const DEFAULT_FINE_PER_DAY = 1;
const DEFAULT_GRACE_DAYS = 0;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const CIRCULATION_POLICY_KEY = "circulation_policy";
export const FINE_CALCULATION_MODE_KEY = "fine_calculation_mode";

export type FineCalculationMode = "LOCK_TO_DUE_DATE" | "SEGMENT_PER_DAY";
export const DEFAULT_FINE_CALCULATION_MODE: FineCalculationMode = "LOCK_TO_DUE_DATE";

export type CirculationPolicy = {
  finePerDay?: number;
  gracePeriodDays?: number;
  maxFineCap?: number;
  loanPeriodDays?: number;
  maxBooksPerUser?: number;
  renewalLimit?: number;
  reservationDays?: number;
  allowRenewals?: boolean;
  enableLateFines?: boolean;
  allowInterLibraryLoan?: boolean;
};

let cachedDefaults: { value: CirculationPolicy; loadedAt: number } | null = null;
let cachedMode: { value: FineCalculationMode; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateCirculationPolicyCache() {
  cachedDefaults = null;
  cachedMode = null;
}

export async function loadGlobalCirculationDefaults(): Promise<CirculationPolicy> {
  if (cachedDefaults && Date.now() - cachedDefaults.loadedAt < CACHE_TTL_MS) {
    return cachedDefaults.value;
  }
  let value: CirculationPolicy = {};
  try {
    const row = await storage.getSystemConfig(CIRCULATION_POLICY_KEY);
    if (row?.value) {
      try { value = JSON.parse(row.value) as CirculationPolicy; } catch { value = {}; }
    }
  } catch {
    value = {};
  }
  cachedDefaults = { value, loadedAt: Date.now() };
  return value;
}

export async function loadFineCalculationMode(): Promise<FineCalculationMode> {
  if (cachedMode && Date.now() - cachedMode.loadedAt < CACHE_TTL_MS) {
    return cachedMode.value;
  }
  let value: FineCalculationMode = DEFAULT_FINE_CALCULATION_MODE;
  try {
    const row = await storage.getSystemConfig(FINE_CALCULATION_MODE_KEY);
    if (row?.value === "SEGMENT_PER_DAY" || row?.value === "LOCK_TO_DUE_DATE") {
      value = row.value as FineCalculationMode;
    }
  } catch { /* default */ }
  cachedMode = { value, loadedAt: Date.now() };
  return value;
}

export function mergeCirculationPolicy(
  globalDefaults: CirculationPolicy | null | undefined,
  libraryOverrides: CirculationPolicy | null | undefined
): CirculationPolicy {
  const g = globalDefaults || {};
  const l = libraryOverrides || {};
  const pick = <K extends keyof CirculationPolicy>(k: K): CirculationPolicy[K] =>
    (l[k] !== undefined && l[k] !== null ? l[k] : g[k]);
  return {
    finePerDay: pick("finePerDay"),
    gracePeriodDays: pick("gracePeriodDays"),
    maxFineCap: pick("maxFineCap"),
    loanPeriodDays: pick("loanPeriodDays"),
    maxBooksPerUser: pick("maxBooksPerUser"),
    renewalLimit: pick("renewalLimit"),
    reservationDays: pick("reservationDays"),
    allowRenewals: pick("allowRenewals"),
    enableLateFines: pick("enableLateFines"),
    allowInterLibraryLoan: pick("allowInterLibraryLoan"),
  };
}

/**
 * Resolve the policy snapshot that was effective at `atDate`.
 * Picks the latest GLOBAL version with effectiveFrom <= atDate, and (if libraryId given)
 * the latest LIBRARY version with effectiveFrom <= atDate, then merges (library over global).
 * Falls back to the current `system_config.circulation_policy` mirror and the library's
 * `policies` JSONB column when no versions exist yet (legacy data).
 */
export async function getEffectivePolicyForDate(
  libraryId: number | null,
  atDate: Date
): Promise<CirculationPolicy> {
  let globalSnap: CirculationPolicy | null = null;
  let librarySnap: CirculationPolicy | null = null;

  try {
    const [g] = await db
      .select()
      .from(circulationPolicyVersions)
      .where(and(
        eq(circulationPolicyVersions.scope, "GLOBAL"),
        lte(circulationPolicyVersions.effectiveFrom, atDate),
      ))
      .orderBy(desc(circulationPolicyVersions.effectiveFrom), desc(circulationPolicyVersions.id))
      .limit(1);
    if (g) globalSnap = g.policy as CirculationPolicy;
  } catch { /* ignore */ }

  if (libraryId) {
    try {
      const [l] = await db
        .select()
        .from(circulationPolicyVersions)
        .where(and(
          eq(circulationPolicyVersions.scope, "LIBRARY"),
          eq(circulationPolicyVersions.libraryId, libraryId),
          lte(circulationPolicyVersions.effectiveFrom, atDate),
        ))
        .orderBy(desc(circulationPolicyVersions.effectiveFrom), desc(circulationPolicyVersions.id))
        .limit(1);
      if (l) librarySnap = l.policy as CirculationPolicy;
    } catch { /* ignore */ }
  }

  // Legacy fallback when no version exists yet for this scope
  if (!globalSnap) globalSnap = await loadGlobalCirculationDefaults();
  if (libraryId && !librarySnap) {
    try {
      const lib = await storage.getLibrary(libraryId);
      librarySnap = (lib?.policies || null) as CirculationPolicy | null;
    } catch { librarySnap = null; }
  }

  return mergeCirculationPolicy(globalSnap, librarySnap);
}

function applyPolicyToDays(policy: CirculationPolicy, billableDays: number): number {
  const finePerDay = Number(policy.finePerDay ?? DEFAULT_FINE_PER_DAY);
  let fineCents = Math.round(billableDays * finePerDay * 100);
  const cap = policy.maxFineCap !== undefined && policy.maxFineCap !== null ? Number(policy.maxFineCap) : undefined;
  if (cap !== undefined && cap > 0) {
    fineCents = Math.min(fineCents, Math.round(cap * 100));
  }
  return fineCents;
}

/**
 * Compute the accrued fine using the date-aware policy resolution.
 * Mode `LOCK_TO_DUE_DATE` (default): use the policy effective on dueDate for the whole window.
 * Mode `SEGMENT_PER_DAY`: walk each billable day and charge that day's effective rate; cap by the
 * dueDate-effective `maxFineCap` for predictability.
 */
export async function computeAccruedFine(
  circ: Pick<Circulation, "dueDate" | "returnDate" | "status" | "libraryId">,
  asOfDate: Date = new Date()
): Promise<{ fineCents: number; daysOverdue: number; isOverdue: boolean }> {
  const referenceDate = circ.returnDate ?? asOfDate;
  const dueDate = new Date(circ.dueDate);
  if (referenceDate <= dueDate) {
    return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  }

  const libraryId = circ.libraryId ?? null;
  const baselinePolicy = await getEffectivePolicyForDate(libraryId, dueDate);
  if (baselinePolicy.enableLateFines === false) {
    return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  }

  const grace = Number(baselinePolicy.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const rawDaysOverdue = Math.ceil((referenceDate.getTime() - dueDate.getTime()) / MS_PER_DAY);
  const billableDays = Math.max(0, rawDaysOverdue - grace);
  if (billableDays === 0) {
    return { fineCents: 0, daysOverdue: rawDaysOverdue, isOverdue: true };
  }

  const mode = await loadFineCalculationMode();

  if (mode === "LOCK_TO_DUE_DATE") {
    const fineCents = applyPolicyToDays(baselinePolicy, billableDays);
    return { fineCents, daysOverdue: rawDaysOverdue, isOverdue: true };
  }

  // SEGMENT_PER_DAY: charge each billable day at the policy effective on that day.
  // Billable days start AFTER the grace window.
  const firstBillableDayStart = new Date(dueDate.getTime() + grace * MS_PER_DAY);
  let totalCents = 0;
  for (let i = 0; i < billableDays; i++) {
    const dayDate = new Date(firstBillableDayStart.getTime() + i * MS_PER_DAY);
    const dayPolicy = await getEffectivePolicyForDate(libraryId, dayDate);
    if (dayPolicy.enableLateFines === false) continue;
    const rate = Number(dayPolicy.finePerDay ?? DEFAULT_FINE_PER_DAY);
    totalCents += Math.round(rate * 100);
  }
  const cap = baselinePolicy.maxFineCap !== undefined && baselinePolicy.maxFineCap !== null
    ? Number(baselinePolicy.maxFineCap)
    : undefined;
  if (cap !== undefined && cap > 0) {
    totalCents = Math.min(totalCents, Math.round(cap * 100));
  }
  return { fineCents: totalCents, daysOverdue: rawDaysOverdue, isOverdue: true };
}

/**
 * @deprecated Use `computeAccruedFine` instead. Kept for backward compatibility; uses
 * the merged policy passed in (does NOT resolve by date).
 */
export function calculateAccruedFine(
  circ: Pick<Circulation, "dueDate" | "returnDate" | "status">,
  library: Library | null | undefined,
  asOfDate: Date = new Date(),
  globalDefaults: CirculationPolicy | null = null
): { fineCents: number; daysOverdue: number; isOverdue: boolean } {
  const policy = mergeCirculationPolicy(globalDefaults, (library?.policies || {}) as CirculationPolicy);
  if (policy.enableLateFines === false) return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  const finePerDay = Number(policy.finePerDay ?? DEFAULT_FINE_PER_DAY);
  const grace = Number(policy.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const cap = policy.maxFineCap !== undefined && policy.maxFineCap !== null ? Number(policy.maxFineCap) : undefined;
  const referenceDate = circ.returnDate ?? asOfDate;
  const dueDate = new Date(circ.dueDate);
  if (referenceDate <= dueDate) return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  const rawDaysOverdue = Math.ceil((referenceDate.getTime() - dueDate.getTime()) / MS_PER_DAY);
  const billableDays = Math.max(0, rawDaysOverdue - grace);
  let fineCents = Math.round(billableDays * finePerDay * 100);
  if (cap !== undefined && cap > 0) fineCents = Math.min(fineCents, Math.round(cap * 100));
  return { fineCents, daysOverdue: rawDaysOverdue, isOverdue: true };
}

export async function getCirculationFineSummary(circ: Circulation) {
  const library = circ.libraryId ? await storage.getLibrary(circ.libraryId) : null;
  const isReturned = circ.status === "RETURNED";

  let assessedFineCents: number;
  let daysOverdue: number;
  let isOverdue: boolean;

  const calc = await computeAccruedFine(circ);
  if (isReturned) {
    assessedFineCents = circ.fineAmount ?? 0;
    daysOverdue = calc.daysOverdue;
    isOverdue = calc.isOverdue;
  } else {
    assessedFineCents = calc.fineCents;
    daysOverdue = calc.daysOverdue;
    isOverdue = calc.isOverdue;
  }

  const finePaid = circ.finePaidAmount ?? 0;
  const fineWaived = circ.fineWaivedAmount ?? 0;
  const fineOutstanding = Math.max(0, assessedFineCents - finePaid - fineWaived);

  const damageCost = circ.damageCost ?? 0;
  const damagePaid = circ.damagePaidAmount ?? 0;
  const damageWaived = circ.damageWaivedAmount ?? 0;
  const damageOutstanding = Math.max(0, damageCost - damagePaid - damageWaived);

  return {
    assessedFineCents,
    finePaid,
    fineWaived,
    fineOutstanding,
    damageCost,
    damagePaid,
    damageWaived,
    damageOutstanding,
    daysOverdue,
    isOverdue,
    totalOutstanding: fineOutstanding + damageOutstanding,
    library,
  };
}

/**
 * Bootstrap: if no GLOBAL policy version exists, seed one from the current system_config snapshot
 * (or empty if none) with effectiveFrom = epoch so existing books resolve correctly.
 */
export async function ensureInitialCirculationPolicyVersion(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: circulationPolicyVersions.id })
      .from(circulationPolicyVersions)
      .where(eq(circulationPolicyVersions.scope, "GLOBAL"))
      .limit(1);
    if (existing) return;
    const current = await loadGlobalCirculationDefaults();
    await db.insert(circulationPolicyVersions).values({
      scope: "GLOBAL",
      libraryId: null,
      policy: current,
      effectiveFrom: new Date(0),
      reason: "Initial policy seed (migrated from system_config)",
      createdBy: null,
      createdByName: "system",
    } as InsertCirculationPolicyVersionLike);
  } catch (e) {
    console.error("ensureInitialCirculationPolicyVersion failed:", e);
  }
}

// Local helper type to satisfy Drizzle insert when omitted fields are not exported in scope
type InsertCirculationPolicyVersionLike = typeof circulationPolicyVersions.$inferInsert;
