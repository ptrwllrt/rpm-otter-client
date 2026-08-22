# Otterly brand-report exporter

Pulls every prompt and every AI response from an [Otterly.ai](https://otterly.ai) brand
report into an **Excel workbook** (for review) and a **JSON file** (for analysis by an AI
like Claude).

There are two ways to use it:

- **`otterly-export.html`** — a single self-contained web page. No install, no terminal.
  Just open it in a browser, pick a brand, and click Export. Built for a locked-down
  (MDM-managed) Mac where installing apps is hard. **This is the one for Alexandra.**
- **The Node.js CLI** (`npm run …`) — for development and scripting on this machine.

## The web app (hosted on Netlify, no install)

Alexandra just opens a URL, pastes the API key once, picks a **brand** and **report**, and
clicks **Nach Excel exportieren**. The `.xlsx` downloads, plus a **JSON** link for the
analysis step. Nothing to install.

### Why it's hosted (and not a plain double-click file)

Otterly's API returns the CORS header only on the preflight, not on the actual response, so
a browser blocks the payload when a page calls the API directly. To work around it the app
is served from Netlify together with a tiny proxy function (`netlify/functions/proxy.mjs`)
at `/api/*`, which forwards each request to `data.otterly.ai` and re-adds the CORS header.
Because the app and the proxy share an origin, the browser is happy.

The proxy only ever forwards to `data.otterly.ai` and adds no key of its own — a caller
still needs a valid Otterly key. The key lives in Alexandra's browser (localStorage) and is
sent through the proxy on each request.

### Deploy / update it

One-time, from this folder (uses your Netlify account):

```bash
npx netlify-cli deploy --build --prod
```

The first run walks you through logging in and creating/linking the site; `netlify.toml`
already tells it to run `npm run build:web` and publish `public/` with the function. After
that, the same command redeploys any changes. Give Alexandra the resulting site URL.

### Local preview (developer)

```bash
npx netlify-cli dev
```

Serves the app and the proxy together at `http://localhost:8888` so you can test the full
flow before deploying.

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

Files land in the `output/` folder, named like `Brand_2026-08-22.xlsx` (and `.json`).

By default it pulls the **last 30 days** across **every country** the report tracks.

### Options

```bash
npm run pull -- <reportId> --days 90
npm run pull -- <reportId> --start 2026-07-01 --end 2026-07-31
npm run pull -- <reportId> --country us,uk
npm run pull -- <reportId> --engine chatgpt
```

## What's in the Excel file

- **Responses** — one row per AI response: country, prompt, engine, run date, whether the
  brand was mentioned, competitors mentioned, citations, and the full response text.
- **Prompts** — an overview of each tracked prompt (search volume, mentions, # responses).
- **About** — brand, date window, and counts, for provenance.

## Notes

- The API key is **read-only** and never leaves your machine except in requests to Otterly.
- `.env` and `output/` are git-ignored so keys and pulled data are never committed.
