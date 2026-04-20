import { storage } from "./storage";
import type { Circulation, Library, FinePayment } from "@shared/schema";

const DEFAULT_FINE_PER_DAY = 1;
const DEFAULT_GRACE_DAYS = 0;
const SECS_PER_DAY = 1000 * 60 * 60 * 24;

export const CIRCULATION_POLICY_KEY = "circulation_policy";

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
};

let cachedDefaults: { value: CirculationPolicy; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateCirculationPolicyCache() {
  cachedDefaults = null;
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

export function mergeCirculationPolicy(
  globalDefaults: CirculationPolicy | null | undefined,
  library: Library | null | undefined
): CirculationPolicy {
  const g = globalDefaults || {};
  const l = (library?.policies || {}) as CirculationPolicy;
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
  };
}

export function calculateAccruedFine(
  circ: Pick<Circulation, "dueDate" | "returnDate" | "status">,
  library: Library | null | undefined,
  asOfDate: Date = new Date(),
  globalDefaults: CirculationPolicy | null = null
): { fineCents: number; daysOverdue: number; isOverdue: boolean } {
  const policy = mergeCirculationPolicy(globalDefaults, library);

  if (policy.enableLateFines === false) {
    return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  }

  const finePerDay = Number(policy.finePerDay ?? DEFAULT_FINE_PER_DAY);
  const gracePeriodDays = Number(policy.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const maxFineCap = policy.maxFineCap !== undefined ? Number(policy.maxFineCap) : undefined;

  const referenceDate = circ.returnDate ?? asOfDate;
  const dueDate = new Date(circ.dueDate);

  if (referenceDate <= dueDate) {
    return { fineCents: 0, daysOverdue: 0, isOverdue: false };
  }

  const rawDaysOverdue = Math.ceil((referenceDate.getTime() - dueDate.getTime()) / SECS_PER_DAY);
  const billableDays = Math.max(0, rawDaysOverdue - gracePeriodDays);
  let fineCents = Math.round(billableDays * finePerDay * 100);
  if (maxFineCap !== undefined && maxFineCap > 0) {
    const capCents = Math.round(maxFineCap * 100);
    fineCents = Math.min(fineCents, capCents);
  }

  return { fineCents, daysOverdue: rawDaysOverdue, isOverdue: true };
}

export async function getCirculationFineSummary(circ: Circulation) {
  const library = circ.libraryId ? await storage.getLibrary(circ.libraryId) : null;
  const globalDefaults = await loadGlobalCirculationDefaults();
  const isReturned = circ.status === "RETURNED";

  let assessedFineCents: number;
  let daysOverdue: number;
  let isOverdue: boolean;

  if (isReturned) {
    assessedFineCents = circ.fineAmount ?? 0;
    const calc = calculateAccruedFine(circ, library, new Date(), globalDefaults);
    daysOverdue = calc.daysOverdue;
    isOverdue = calc.isOverdue;
  } else {
    const calc = calculateAccruedFine(circ, library, new Date(), globalDefaults);
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
