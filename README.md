# Otterly brand-report exporter

Pulls every prompt and every AI response from an [Otterly.ai](https://otterly.ai) brand
report into **Excel or CSV** — one file/sheet per prompt by default (or everything merged) —
ready for review and for further analysis (e.g. by an AI like Claude).

There are two ways to use it:

- **`otterly-export.html`** — a single self-contained web page. No install, no terminal.
  Just open it in a browser, pick a brand, choose columns, and export. Built for a
  locked-down (MDM-managed) Mac where installing apps is hard. **This is the one for
  Alexandra.**
- **The Node.js CLI** (`npm run …`) — for development and scripting on this machine.

## The web app (local file, no install)

`otterly-export.html` is a single local file Alexandra opens directly (double-click, or
AirDrop/email it to her Mac). She pastes the API key once, picks a **brand** and **report**,
chooses the columns and how the files are split, and exports. Nothing to install.

Build the file (after any change to `web/template.html`):

```bash
npm run build:web
```

### The Netlify proxy (why it's needed)

Otterly's API returns the CORS header only on the preflight, not on the actual response, so
a browser can't read the payload when a page calls `data.otterly.ai` directly. So the app
routes through a tiny proxy — a Netlify function (`netlify/functions/proxy.mjs`) that
forwards each request to `data.otterly.ai` and re-adds the CORS header. The app points at it
via `PROXY_BASE` in `web/template.html`.

Netlify hosts **only** the proxy (see `netlify.toml`, which publishes the neutral
placeholder in `site/`); the app itself is not published there. The proxy only ever forwards
to `data.otterly.ai` and adds no key of its own — a caller still needs a valid Otterly key,
which lives in Alexandra's browser (localStorage) and is sent through the proxy per request.

Deploy / redeploy the proxy (uses your Netlify account):

```bash
npx netlify-cli deploy --prod
```

### Export options in the web app

- **Format** — Excel (`.xlsx`) or CSV. The Excel writer is hand-rolled on top of a tiny
  zip packer (no library), so there's nothing large to load and no `XLSX is not defined`.
- **Aufteilung** — one per prompt, or everything together. Per-prompt means one sheet (tab)
  per prompt for Excel, or a `.zip` of CSVs for CSV.
- **Spalten** — pick which columns to include; defaults to the seven listed below.
- **Zeitraum / Engines** — look-back window (default 14 days) and an optional single engine.

## The CLI (developer use)

## One-time setup

1. Install [Node.js](https://nodejs.org) (v18 or newer).
2. In this folder, install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and paste in your Otterly API key:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and set `OTTERLY_API_KEY`.

## Everyday use

**1. See your brand reports** (to get the report's id):
```bash
npm run list
```

**2. Pull everything for one report:**
```bash
npm run pull -- <reportId>
```

By default this writes **one CSV per prompt** into the `output/` folder (last 14 days, every
country the report tracks), named with the pattern below.

### Options

```bash
npm run pull -- <reportId> --single                       # one merged CSV instead of per-prompt
npm run pull -- <reportId> --columns prompt,engine,response_text
npm run pull -- <reportId> --all-columns
npm run pull -- <reportId> --days 90
npm run pull -- <reportId> --start 2026-07-01 --end 2026-07-31
npm run pull -- <reportId> --country us,uk
npm run pull -- <reportId> --engine chatgpt
```

## What's in the export

The columns are the same whether you export Excel or CSV (Excel is a web-app option; the CLI
writes CSV). One row per AI response. The default columns are:

`prompt`, `engine`, `brand_mentioned`, `brand_sentiment`, `competitors_mentioned`,
`response_text`, `citations`.

Notes:
- `brand_sentiment` is the main brand's **Net Sentiment Score (nss, −100…+100)** for that
  prompt, aggregated over the date window (from the prompt-details endpoint's
  `brandRank[].sentiment`). It is a per-prompt value, so it repeats across that prompt's
  response rows; it's blank when the brand isn't ranked for the prompt in the window.
  Including this column costs one extra API call per prompt.
- `brand_mentioned` is `true`/`false`, `competitors_mentioned` is a comma-separated list of
  other brands mentioned, `citations` is the citation links (one per line).
- More columns are available (`country`, `run_date`, `state`, `brand_mentions_count`,
  `overview_available`, `web_search_query`, the raw `*_json` fields, `prompt_id`, `run_id`) —
  select them in the web app's **Spalten** panel or via `--columns` / `--all-columns`.

The file is UTF-8 with a BOM and semicolon separators, so it opens straight into Excel
(incl. the German locale) with umlauts intact.

### File naming

Files follow `otterly_raw_answers_<brand>_<reportLabel>_<prompt|all>`, where `<reportLabel>`
is the parenthetical in the report title (e.g. `Packsys US (explore)` → `explore`) and
`<prompt>` is the prompt text truncated to 50 characters. Per-prompt files use the prompt;
the merged file uses `all`. Example: `otterly_raw_answers_Packsys_explore_local service….csv`.

## Notes

- The API key is **read-only** and never leaves your machine except in requests to Otterly.
- `.env` and `output/` are git-ignored so keys and pulled data are never committed.
