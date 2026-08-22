#!/usr/bin/env node
// CLI for pulling Otterly.ai brand-report responses.
//   node src/cli.js list                 → list your brand reports
//   node src/cli.js pull <reportId>      → pull all prompts + responses → CSV
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, resolveDateWindow, OUTPUT_DIR } from "./config.js";
import { OtterlyClient, OtterlyError } from "./otterly.js";
import { toCsv } from "./csv.js";
import { toRow, resolveColumns, fileBase } from "./columns.js";

loadEnv();

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "list":
      return listReports(new OtterlyClient(process.env.OTTERLY_API_KEY));
    case "pull":
      return pullReport(new OtterlyClient(process.env.OTTERLY_API_KEY), args);
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

function printUsage() {
  console.log(`
Otterly brand-report exporter

Usage:
  node src/cli.js list                       List your brand reports (id, brand, countries)
  node src/cli.js pull <reportId> [flags]    Pull all prompts + AI responses to CSV

Flags for pull:
  --country <code[,code]>   Only these countries (default: all tracked by the report)
  --engine  <engine>        Only one engine (chatgpt|google|perplexity|copilot|gemini|claude|google_ai_mode)
  --days    <n>             Look back n days (default: 14, or OTTERLY_DAYS)
  --start   <YYYY-MM-DD>    Explicit window start (with --end)
  --end     <YYYY-MM-DD>    Explicit window end
  --single                  One merged CSV instead of one file per prompt (default: per prompt)
  --columns <a,b,c>         Pick columns (default: prompt,engine,brand_mentioned,brand_sentiment,
                            competitors_mentioned,response_text,citations)
  --all-columns             Include every available column

Config (.env): OTTERLY_API_KEY (required), OTTERLY_DAYS, OTTERLY_START_DATE, OTTERLY_END_DATE
`.trim());
}

async function listReports(client) {
  const reports = await client.listBrandReports();
  if (!reports.length) {
    console.log("No brand reports found for this API key.");
    return;
  }
  console.log(`\nFound ${reports.length} brand report(s):\n`);
  for (const r of reports) {
    console.log(`  ${r.brand}  —  ${r.reportTitle ?? "(untitled)"}`);
    console.log(`     id:        ${r.id}`);
    console.log(`     countries: ${(r.countries ?? []).join(", ") || "(none)"}`);
    console.log("");
  }
  console.log("Pull one with:  node src/cli.js pull <id>\n");
}

// Flags that take no value; everything else consumes the next token.
const BOOL_FLAGS = new Set(["single", "all-columns"]);
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (BOOL_FLAGS.has(key)) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return flags;
}

async function pullReport(client, argv) {
  const reportId = argv.find((a) => !a.startsWith("--"));
  if (!reportId) {
    console.error("Error: pull requires a <reportId>. Run `node src/cli.js list` to find it.");
    process.exit(1);
  }
  const flags = parseFlags(argv);

  const reports = await client.listBrandReports();
  const report = reports.find((r) => r.id === reportId);
  if (!report) {
    console.error(`Error: no brand report with id "${reportId}" is accessible with this key.`);
    process.exit(1);
  }

  const window = resolveDateWindow({ startDate: flags.start, endDate: flags.end, days: flags.days });
  const countries = flags.country
    ? flags.country.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
    : report.countries ?? [];
  if (!countries.length) {
    console.error("Error: this report tracks no countries and none were given via --country.");
    process.exit(1);
  }

  const cols = resolveColumns(flags.columns, { all: "all-columns" in flags });
  const single = "single" in flags;   // one merged file instead of one per prompt

  console.log(`\nBrand:     ${report.brand} — ${report.reportTitle ?? ""}`);
  console.log(`Window:    ${window.startDate} → ${window.endDate}`);
  console.log(`Countries: ${countries.join(", ")}`);
  if (flags.engine) console.log(`Engine:    ${flags.engine}`);
  console.log(`Columns:   ${cols.join(", ")}`);
  console.log(`Output:    ${single ? "one merged CSV" : "one CSV per prompt"}`);
  console.log("");

  // Group rows by prompt so we can write one file per prompt (or merge them).
  const groups = [];             // [{ prompt, rows }]
  const byPrompt = new Map();    // prompt id -> group
  let total = 0, promptCount = 0;

  for (const country of countries) {
    const prompts = await client.listReportPrompts(report.id, { ...window, country });
    console.log(`[${country}] ${prompts.length} prompt(s)`);
    promptCount += prompts.length;

    for (const [i, p] of prompts.entries()) {
      const responses = await client.listPromptResponses(report.id, p.id, {
        ...window, country, engine: flags.engine,
      });
      total += responses.length;
      process.stdout.write(`\r[${country}] prompt ${i + 1}/${prompts.length} — ${responses.length} responses     `);

      let g = byPrompt.get(p.id);
      if (!g) { g = { prompt: p.prompt, rows: [] }; byPrompt.set(p.id, g); groups.push(g); }
      for (const resp of responses) g.rows.push(toRow(cols, country, p, resp));
    }
    process.stdout.write("\n");
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const written = [];
  if (single) {
    const allRows = groups.flatMap((g) => g.rows);
    const path = join(OUTPUT_DIR, fileBase(report, "all") + ".csv");
    writeFileSync(path, toCsv(cols, allRows));
    written.push(path);
  } else {
    const used = new Map();
    for (const g of groups) {
      let name = fileBase(report, g.prompt);
      const n = (used.get(name) || 0) + 1; used.set(name, n);   // de-dupe identical names
      if (n > 1) name += `_${n}`;
      const path = join(OUTPUT_DIR, name + ".csv");
      writeFileSync(path, toCsv(cols, g.rows));
      written.push(path);
    }
  }

  console.log(`\nDone. ${total} responses across ${promptCount} prompt/country pairs.`);
  console.log(`  ${written.length} file(s) in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  if (err instanceof OtterlyError) {
    console.error(`\n✗ ${err.message}`);
    if (err.body) console.error(`  ${String(err.body).slice(0, 300)}`);
  } else {
    console.error("\n✗ Unexpected error:", err);
  }
  process.exit(1);
});
