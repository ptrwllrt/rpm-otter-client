// Builds the Excel workbook Alexandra opens. One row per AI response.
import ExcelJS from "exceljs";

export async function writeWorkbook(outPath, { report, window, rows, promptSummary }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "rpm-otter-client";
  wb.created = new Date();

  // --- Sheet 1: Responses (the core deliverable) ---
  const ws = wb.addWorksheet("Responses", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Country", key: "country", width: 9 },
    { header: "Prompt", key: "prompt", width: 50 },
    { header: "Engine", key: "engine", width: 14 },
    { header: "Run date", key: "runDate", width: 20 },
    { header: "State", key: "state", width: 10 },
    { header: "Brand mentioned", key: "brandMentioned", width: 15 },
    { header: "Main brand mentions", key: "mainBrandMentions", width: 18 },
    { header: "Competitors mentioned", key: "competitorsMentioned", width: 28 },
    { header: "# Citations", key: "citationCount", width: 11 },
    { header: "Citations", key: "citations", width: 50 },
    { header: "Response text", key: "content", width: 100 },
    { header: "Prompt ID", key: "promptId", width: 22 },
    { header: "Run ID", key: "runId", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = "A1:M1";

  for (const r of rows) {
    const row = ws.addRow(r);
    row.alignment = { vertical: "top", wrapText: true };
  }
  // Keep the long text columns readable rather than ballooning row height.
  ws.getColumn("content").alignment = { vertical: "top", wrapText: true };
  ws.getColumn("citations").alignment = { vertical: "top", wrapText: true };

  // --- Sheet 2: Prompts (overview) ---
  const ps = wb.addWorksheet("Prompts", { views: [{ state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "Country", key: "country", width: 9 },
    { header: "Rank", key: "rank", width: 7 },
    { header: "Prompt", key: "prompt", width: 60 },
    { header: "Search volume", key: "volume", width: 13 },
    { header: "Brand mentions", key: "brandMentions", width: 15 },
    { header: "Domain mentions", key: "domainMentions", width: 15 },
    { header: "# Responses", key: "responseCount", width: 12 },
    { header: "Tags", key: "tags", width: 24 },
    { header: "Prompt ID", key: "promptId", width: 22 },
  ];
  ps.getRow(1).font = { bold: true };
  ps.autoFilter = "A1:I1";
  for (const p of promptSummary) ps.addRow(p).alignment = { vertical: "top", wrapText: true };

  // --- Sheet 3: About (provenance for the analysis step) ---
  const about = wb.addWorksheet("About");
  about.columns = [{ width: 22 }, { width: 80 }];
  const meta = [
    ["Brand", report.brand],
    ["Report title", report.reportTitle],
    ["Report ID", report.id],
    ["Countries", (report.countries ?? []).join(", ")],
    ["Date window", `${window.startDate} → ${window.endDate}`],
    ["Prompts pulled", String(promptSummary.length)],
    ["Responses pulled", String(rows.length)],
    ["Generated", new Date().toISOString()],
    ["Source", "Otterly.ai public API (data.otterly.ai)"],
  ];
  for (const [k, v] of meta) {
    const row = about.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  }

  await wb.xlsx.writeFile(outPath);
}
