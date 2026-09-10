---
name: Copy identity during SSN migration
description: Defines how existing library SSNs, generated Internal SSNs, and system barcodes coexist during copy allocation.
---

Imported library SSNs are stored as user-defined SSNs. Existing system barcodes are retained and are not replaced. Barcode labels encode the user-defined SSN when present, otherwise the generated Internal SSN.

**Why:** The system barcode already identifies the database copy, while a migrating library needs to preserve its operational SSN. Replacing the system barcode would break existing references and make migration mapping unsafe.

**How to apply:** Allocation and future import flows must map SSNs explicitly to copy IDs, validate the whole batch before writing, and keep generated and supplied SSN paths distinct.

For ordered migrations, users can scan or type one library SSN at a time. Each accepted value is assigned to the next selected copy; the queue supports individual removal before submission.

**Why:** The user selected ordered scanning for workflows where a scanner supplies one existing SSN per copy and no barcode-to-copy pairing is needed.

**How to apply:** Keep ordered scanning separate from barcode/CSV mapping; scanner input should behave like keyboard input and submit on Enter without introducing camera or device-specific dependencies.