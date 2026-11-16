export interface TransferMetricLeg {
  sourceLibraryId: number;
  destinationLibraryId: number;
  requestStatus: string;
  status: string;
  approvedQuantity: number;
  acceptedQuantity: number | null;
  receivedQuantity: number | null;
}

export function canWithdrawTransferRequest(
  requestedBy: number,
  actorId: number,
  isLocalAdmin: boolean,
  status: string,
): boolean {
  return status === "PENDING_REVIEW" && (isLocalAdmin || requestedBy === actorId);
}

const activeLegStatuses = new Set(["AWAITING_SOURCE", "ACCEPTED", "IN_TRANSIT", "DISCREPANCY"]);
const terminalRequestStatuses = new Set(["COMPLETED", "REJECTED", "CANCELLED"]);

export function calculatePendingTransferQuantities(
  legs: TransferMetricLeg[],
  libraryId: number,
): { incoming: number; outgoing: number } {
  return legs.reduce((counts, leg) => {
    if (!activeLegStatuses.has(leg.status) || terminalRequestStatuses.has(leg.requestStatus)) return counts;
    const approvedOrAccepted = leg.acceptedQuantity ?? leg.approvedQuantity;
    const outstanding = Math.max(0, approvedOrAccepted - (leg.receivedQuantity ?? 0));
    if (leg.destinationLibraryId === libraryId) counts.incoming += outstanding;
    if (leg.sourceLibraryId === libraryId) counts.outgoing += outstanding;
    return counts;
  }, { incoming: 0, outgoing: 0 });
}
