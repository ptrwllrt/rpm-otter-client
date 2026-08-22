// Serialize an array of flat objects to a UTF-8 CSV string.
// Matches the web app's format: BOM + semicolon-separated + every field quoted,
// so it opens cleanly in Excel (incl. the German locale) with umlauts intact and
// newlines/semicolons/quotes preserved inside cells.
export function toCsv(cols, rows) {
  const cell = (v) => '"' + (v == null ? "" : String(v)).replace(/"/g, '""') + '"';
  const lines = [cols.map(cell).join(";")];
  for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(";"));
  return "﻿" + lines.join("\r\n");
}
