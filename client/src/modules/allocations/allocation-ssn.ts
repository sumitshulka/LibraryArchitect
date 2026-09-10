export function parseOrderedSsns(input: string): string[] {
  return input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function parseDelimitedRow(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : ",";
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}

export function parseMappedSsns(input: string): {
  rows: Array<{ barcode: string; ssn: string }>;
  invalidLineNumbers: number[];
} {
  const rows: Array<{ barcode: string; ssn: string }> = [];
  const invalidLineNumbers: number[] = [];
  let firstNonEmptyLine = true;
  input.split(/\r?\n/).forEach((rawLine, index) => {
    if (!rawLine.trim()) return;
    const fields = parseDelimitedRow(rawLine);
    if (
      firstNonEmptyLine
      && fields[0]?.toLowerCase().replace(/\s+/g, "") === "barcode"
      && fields[1]?.toLowerCase().replace(/\s+/g, "") === "ssn"
    ) {
      firstNonEmptyLine = false;
      return;
    }
    firstNonEmptyLine = false;
    if (fields.length !== 2 || !fields[0] || !fields[1]) {
      invalidLineNumbers.push(index + 1);
      return;
    }
    rows.push({ barcode: fields[0], ssn: fields[1] });
  });
  return { rows, invalidLineNumbers };
}