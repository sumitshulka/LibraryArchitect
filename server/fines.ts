import { storage } from "./storage";
import type { Circulation, Library, FinePayment } from "@shared/schema";

const DEFAULT_FINE_PER_DAY = 1; // 1 currency unit per day if not configured
const DEFAULT_GRACE_DAYS = 0;
const SECS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculate the fine accrued for a circulation as of a given date.
 * Returns the gross fine in cents (i.e., currency * 100).
 *
 * - finePerDay is treated as the major-unit per day (e.g., INR 5/day) and converted to cents.
 * - gracePeriodDays delays start of fine accrual.
 * - maxFineCap (optional) caps the total accrued.
 */
export function calculateAccruedFine(
  circ: Pick<Circulation, "dueDate" | "returnDate" | "status">,
  library: Library | null | undefined,
  asOfDate: Date = new Date()
): { fineCents: number; daysOverdue: number; isOverdue: boolean } {
  const policies = library?.policies || {};
  const finePerDay = Number(policies.finePerDay ?? DEFAULT_FINE_PER_DAY);
  const gracePeriodDays = Number(policies.gracePeriodDays ?? DEFAULT_GRACE_DAYS);
  const maxFineCap = policies.maxFineCap !== undefined ? Number(policies.maxFineCap) : undefined;

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

/**
 * Compute total fine outstanding for a circulation.
 * If the book has been returned, fineAmount is fixed. If still active/overdue,
 * fineAmount is computed live from the policy.
 */
export async function getCirculationFineSummary(circ: Circulation) {
  const library = circ.libraryId ? await storage.getLibrary(circ.libraryId) : null;
  const isReturned = circ.status === "RETURNED";

  let assessedFineCents: number;
  let daysOverdue: number;
  let isOverdue: boolean;

  if (isReturned) {
    assessedFineCents = circ.fineAmount ?? 0;
    const calc = calculateAccruedFine(circ, library);
    daysOverdue = calc.daysOverdue;
    isOverdue = calc.isOverdue;
  } else {
    const calc = calculateAccruedFine(circ, library);
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
