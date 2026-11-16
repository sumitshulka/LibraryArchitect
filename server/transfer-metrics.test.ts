import { describe, expect, it } from "vitest";
import { buildTransferCatalogResults } from "./transfer-catalog";
import { calculatePendingTransferQuantities, canWithdrawTransferRequest } from "./transfer-metrics";

describe("transfer request metrics and policies", () => {
  it("allows only the requester or local admin to withdraw before approval", () => {
    expect(canWithdrawTransferRequest(12, 12, false, "PENDING_REVIEW")).toBe(true);
    expect(canWithdrawTransferRequest(12, 13, true, "PENDING_REVIEW")).toBe(true);
    expect(canWithdrawTransferRequest(12, 13, false, "PENDING_REVIEW")).toBe(false);
    expect(canWithdrawTransferRequest(12, 12, false, "APPROVED")).toBe(false);
  });

  it("counts approved outstanding quantities and excludes terminal or unapproved legs", () => {
    const legs = [
      { sourceLibraryId: 2, destinationLibraryId: 1, requestStatus: "APPROVED", status: "AWAITING_SOURCE", approvedQuantity: 5, acceptedQuantity: null, receivedQuantity: null },
      { sourceLibraryId: 1, destinationLibraryId: 3, requestStatus: "APPROVED", status: "ACCEPTED", approvedQuantity: 5, acceptedQuantity: 3, receivedQuantity: null },
      { sourceLibraryId: 2, destinationLibraryId: 1, requestStatus: "NEEDS_REALLOCATION", status: "DISCREPANCY", approvedQuantity: 4, acceptedQuantity: 3, receivedQuantity: 1 },
      { sourceLibraryId: 2, destinationLibraryId: 1, requestStatus: "CANCELLED", status: "AWAITING_SOURCE", approvedQuantity: 9, acceptedQuantity: null, receivedQuantity: null },
      { sourceLibraryId: 2, destinationLibraryId: 1, requestStatus: "APPROVED", status: "COMPLETED", approvedQuantity: 7, acceptedQuantity: 7, receivedQuantity: 7 },
      { sourceLibraryId: 2, destinationLibraryId: 1, requestStatus: "PENDING_REVIEW", status: "PREFERRED", approvedQuantity: 0, acceptedQuantity: null, receivedQuantity: null },
    ];

    expect(calculatePendingTransferQuantities(legs, 1)).toEqual({ incoming: 7, outgoing: 3 });
  });

  it("includes source availability and the requesting library's own holdings in catalog results", () => {
    const results = buildTransferCatalogResults(
      [{ id: 8, title: "Example Book" }],
      [{ bookId: 8, status: "AVAILABLE", quantity: 2 }, { bookId: 8, status: "CHECKED_OUT", quantity: 1 }],
      [{ bookId: 8, libraryId: 2, libraryName: "North", quantity: 4 }],
    );

    expect(results[0]).toMatchObject({
      localInventory: { total: 3, byStatus: { AVAILABLE: 2, CHECKED_OUT: 1 } },
      sources: [{ libraryId: 2, libraryName: "North", quantity: 4 }],
    });
  });
});
