import { describe, expect, it } from "vitest";
import { moduleForApiPath, moduleForPath } from "@shared/staff-modules";

describe("staff module access mapping", () => {
  it("maps nested application pages to their parent module", () => {
    expect(moduleForPath("/circulation/pending-fines")).toBe("fines");
    expect(moduleForPath("/transfers/acquisitions")).toBe("transfers");
    expect(moduleForPath("/")).toBe("dashboard");
  });

  it("maps API endpoints to the same restricted module", () => {
    expect(moduleForApiPath("/api/books/12/history")).toBe("catalog");
    expect(moduleForApiPath("/api/circulation/returns")).toBe("circulation");
    expect(moduleForApiPath("/api/transfers/5/review")).toBe("transfers");
    expect(moduleForApiPath("/api/unknown")).toBeNull();
  });
});
