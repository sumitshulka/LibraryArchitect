---
name: Copy identity during SSN migration
description: Defines how existing library SSNs, generated Internal SSNs, and system barcodes coexist during copy allocation.
---

Imported library SSNs are stored as user-defined SSNs. Existing system barcodes are retained and are not replaced. Barcode labels encode the user-defined SSN when present, otherwise the generated Internal SSN.

**Why:** The system barcode already identifies the database copy, while a migrating library needs to preserve its operational SSN. Replacing the system barcode would break existing references and make migration mapping unsafe.

**How to apply:** Allocation and future import flows must map SSNs explicitly to copy IDs, validate the whole batch before writing, and keep generated and supplied SSN paths distinct.