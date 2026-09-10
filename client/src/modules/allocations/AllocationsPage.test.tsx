import { describe, expect, it } from "vitest";
import { appendScannedSsns, parseMappedSsns, parseOrderedSsns } from "./allocation-ssn";

describe("allocation SSN import parsing", () => {
  it("parses one supplied SSN per non-empty line", () => {
    expect(parseOrderedSsns(" LIB-001 \n\nLIB-002\r\nLIB-003 ")).toEqual([
      "LIB-001",
      "LIB-002",
      "LIB-003",
    ]);
  });

  it("appends scanner input in arrival order", () => {
    expect(appendScannedSsns(["LIB-001"], " LIB-002\n\nLIB-003 ")).toEqual([
      "LIB-001",
      "LIB-002",
      "LIB-003",
    ]);
  });

  it("parses headered CSV, quoted values, and tab-separated mappings", () => {
    expect(parseMappedSsns('\n barcode,ssn\n"BC-10","LIB,001"\nBC-11\tLIB-002')).toEqual({
      rows: [
        { barcode: "BC-10", ssn: "LIB,001" },
        { barcode: "BC-11", ssn: "LIB-002" },
      ],
      invalidLineNumbers: [],
    });
  });

  it("reports malformed mapped rows without silently importing them", () => {
    expect(parseMappedSsns("BC-10,LIB-001\nmissing-delimiter")).toEqual({
      rows: [{ barcode: "BC-10", ssn: "LIB-001" }],
      invalidLineNumbers: [2],
    });
  });
});