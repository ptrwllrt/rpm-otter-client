// Column catalog + file naming, shared by the CLI. The web app (web/template.html)
// keeps an inline copy of this same logic — keep the two in sync.

// Available CSV columns, in output order. Each maps a response (with derived
// context) to a cell. Snake_case names follow Otterly's own export style.
export const COLUMNS = {
  prompt: (c) => c.p.prompt,
  engine: (c) => c.resp.engine,
  brand_mentioned: (c) => (c.mainMentions > 0 ? "true" : "false"),
  brand_sentiment: (c) => (c.nss == null ? "" : c.nss),   // main brand's per-prompt Net Sentiment Score
  competitors_mentioned: (c) => c.competitors.join(", "),
  response_text: (c) => c.resp.content ?? "",
  citations: (c) => (c.resp.citations ?? []).map((x) => x.link).join("\n"),
  country: (c) => c.country,
  run_date: (c) => c.resp.runDate,
  state: (c) => c.resp.state,
  brand_mentions_count: (c) => c.mainMentions,
  overview_available: (c) => c.resp.overviewAvailable,
  web_search_query: (c) => (c.resp.webSearchQuery ?? []).join(" | "),
  citations_json: (c) => JSON.stringify(c.resp.citations ?? []),
  brand_mentions_json: (c) => JSON.stringify(c.resp.brandMentions ?? []),
  ads_json: (c) => JSON.stringify(c.resp.ads ?? []),
  shopping_json: (c) => JSON.stringify(c.resp.shopping ?? []),
  prompt_id: (c) => c.p.id,
  run_id: (c) => c.resp.runId,
};

export const DEFAULT_COLUMNS = [
  "prompt", "engine", "brand_mentioned", "brand_sentiment",
  "competitors_mentioned", "response_text", "citations",
];

function rowContext(country, p, resp, nss) {
  const mentions = resp.brandMentions ?? [];
  const main = mentions.find((m) => m.isMainBrand);
  return {
    country, p, resp, nss,
    mainMentions: (main && main.mentions) || 0,
    competitors: mentions.filter((m) => !m.isMainBrand && m.mentions > 0).map((m) => m.brand),
  };
}

// `nss` is the main brand's Net Sentiment Score for this prompt (or null/undefined
// when unavailable), pulled from prompt details — see mainBrandNss below.
export function toRow(cols, country, p, resp, nss) {
  const c = rowContext(country, p, resp, nss);
  const row = {};
  for (const k of cols) row[k] = COLUMNS[k] ? COLUMNS[k](c) : "";
  return row;
}

// Extract the main brand's Net Sentiment Score from a prompt-details payload.
// brandRank has no isMainBrand flag, so match by the report's brand name.
export function mainBrandNss(detail, brandName) {
  const entry = (detail?.brandRank ?? []).find((b) => b.brand === brandName);
  return entry?.sentiment?.nss ?? null;
}

// Resolve a user-supplied column list ("a,b,c") against the catalog; returns the
// valid ones in catalog order, or the default set when none given.
export function resolveColumns(spec, { all = false } = {}) {
  if (all) return Object.keys(COLUMNS);
  if (!spec) return DEFAULT_COLUMNS.slice();
  const want = new Set(spec.split(",").map((s) => s.trim()).filter(Boolean));
  const cols = Object.keys(COLUMNS).filter((k) => want.has(k));
  return cols.length ? cols : DEFAULT_COLUMNS.slice();
}

// ---------- file naming ----------
// otterly_raw_answers_<brand>_<reportLabel>_<prompt|all>
export function sanitize(s, max) {
  let out = String(s ?? "").replace(/[\/\\:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (max && out.length > max) out = out.slice(0, max).trim();
  return out;
}
export function reportLabel(report) {
  const m = /\(([^)]+)\)/.exec(report.reportTitle || "");
  return sanitize(m ? m[1] : "", 40).toLowerCase();
}
export function fileBase(report, promptOrAll) {
  const tail = promptOrAll === "all" ? "all" : sanitize(promptOrAll, 50);
  return ["otterly_raw_answers", sanitize(report.brand, 40), reportLabel(report), tail]
    .filter((s) => s).join("_");
}
