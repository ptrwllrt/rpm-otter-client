#!/usr/bin/env node
// CLI for pulling Otterly.ai brand-report responses.
//   node src/cli.js list                 → list your brand reports
//   node src/cli.js pull <reportId>      → pull all prompts + responses → Excel + JSON
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, resolveDateWindow, OUTPUT_DIR } from "./config.js";
import { OtterlyClient, OtterlyError } from "./otterly.js";
import { writeWorkbook } from "./excel.js";

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
  node src/cli.js pull <reportId> [flags]    Pull all prompts + AI responses to Excel + JSON

Flags for pull:
  --country <code[,code]>   Only these countries (default: all tracked by the report)
  --engine  <engine>        Only one engine (chatgpt|google|perplexity|copilot|gemini|claude|google_ai_mode)
  --days    <n>             Look back n days (default: 14, or OTTERLY_DAYS)
  --start   <YYYY-MM-DD>    Explicit window start (with --end)
  --end     <YYYY-MM-DD>    Explicit window end

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

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
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

  console.log(`\nBrand:     ${report.brand} — ${report.reportTitle ?? ""}`);
  console.log(`Window:    ${window.startDate} → ${window.endDate}`);
  console.log(`Countries: ${countries.join(", ")}`);
  if (flags.engine) console.log(`Engine:    ${flags.engine}`);
  console.log("");

  const rows = [];
  const promptSummary = [];

  for (const country of countries) {
    const prompts = await client.listReportPrompts(report.id, { ...window, country });
    console.log(`[${country}] ${prompts.length} prompt(s)`);

    for (const [i, p] of prompts.entries()) {
      const responses = await client.listPromptResponses(report.id, p.id, {
        ...window, country, engine: flags.engine,
      });
      process.stdout.write(`\r[${country}] prompt ${i + 1}/${prompts.length} — ${responses.length} responses     `);

      promptSummary.push({
        country,
        rank: p.rank,
        prompt: p.prompt,
        volume: p.volume,
        brandMentions: p.brandMentions,
        domainMentions: p.domainMentions,
        responseCount: responses.length,
        tags: (p.tags ?? []).map((t) => t.name).join(", "),
        promptId: p.id,
      });

      for (const resp of responses) {
        const mentions = resp.brandMentions ?? [];
        const main = mentions.find((m) => m.isMainBrand);
        const competitors = mentions.filter((m) => !m.isMainBrand && m.mentions > 0).map((m) => m.brand);
        rows.push({
          country,
          prompt: p.prompt,
          engine: resp.engine,
          runDate: resp.runDate,
          state: resp.state,
          brandMentioned: main && main.mentions > 0 ? "yes" : "no",
          mainBrandMentions: main?.mentions ?? 0,
          competitorsMentioned: competitors.join(", "),
          citationCount: (resp.citations ?? []).length,
          citations: (resp.citations ?? []).map((c) => c.link).join("\n"),
          content: resp.content ?? "",
          promptId: p.id,
          runId: resp.runId,
        });
      }
    }
    process.stdout.write("\n");
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeBrand = (report.brand ?? "report").replace(/[^\w-]+/g, "_");
  const base = `${safeBrand}_${stamp}`;
  const xlsxPath = join(OUTPUT_DIR, `${base}.xlsx`);
  const jsonPath = join(OUTPUT_DIR, `${base}.json`);

  await writeWorkbook(xlsxPath, { report, window, rows, promptSummary });
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { report: { id: report.id, brand: report.brand, reportTitle: report.reportTitle, countries }, window, prompts: promptSummary, responses: rows },
      null, 2
    )
  );

  console.log(`\nDone. ${rows.length} responses across ${promptSummary.length} prompt/country pairs.`);
  console.log(`  Excel: ${xlsxPath}`);
  console.log(`  JSON:  ${jsonPath}\n`);
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
