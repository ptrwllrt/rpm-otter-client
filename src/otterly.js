// Thin client for the Otterly.ai public API.
// Docs: https://docs.otterly.ai/api-reference  •  Base URL: https://data.otterly.ai
// Read-only. Auth is a Bearer token passed in the Authorization header.

const BASE_URL = "https://data.otterly.ai";

export class OtterlyError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "OtterlyError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class OtterlyClient {
  constructor(apiKey) {
    if (!apiKey) throw new OtterlyError("Missing API key. Set OTTERLY_API_KEY in your .env file.");
    this.apiKey = apiKey;
  }

  // Low-level GET with retry on 429 (quota / rate limit) and transient 5xx.
  async #get(path, params = {}) {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }

    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
        });
      } catch (err) {
        if (attempt < maxAttempts) {
          await sleep(500 * attempt);
          continue;
        }
        throw new OtterlyError(`Network error calling ${url.pathname}: ${err.message}`, { url: url.toString() });
      }

      if (res.ok) return res.json();

      const body = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxAttempts) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
        await sleep(wait);
        continue;
      }

      const hint = {
        401: "Unauthorized — check your OTTERLY_API_KEY.",
        403: "Forbidden — your plan may not include API access, or the key lacks access to this resource.",
        400: "Validation failed — check the parameters (date format YYYY-MM-DD, country code lowercase).",
        429: "Quota exhausted — you have hit the API rate/usage limit.",
      }[res.status];
      throw new OtterlyError(
        `Otterly API ${res.status} on ${url.pathname}${hint ? ` — ${hint}` : ""}`,
        { status: res.status, url: url.toString(), body }
      );
    }
  }

  // GET /v1/reports/brand — list brand reports (optionally scoped to a workspace).
  async listBrandReports({ workspaceId } = {}) {
    const items = [];
    let cursor;
    do {
      const page = await this.#get("/v1/reports/brand", { workspaceId, cursor });
      items.push(...(page.items ?? []));
      cursor = page.paging?.hasMore ? page.paging.nextCursor : undefined;
    } while (cursor);
    return items;
  }

  // GET /v1/reports/brand/{reportId}/prompts — offset-paginated list of tracked prompts.
  async listReportPrompts(reportId, { startDate, endDate, country, limit = 100 } = {}) {
    const items = [];
    let offset = 0;
    for (;;) {
      const page = await this.#get(`/v1/reports/brand/${encodeURIComponent(reportId)}/prompts`, {
        startDate, endDate, country, offset, limit,
      });
      const batch = page.items ?? [];
      items.push(...batch);
      if (batch.length < limit) break;
      offset += batch.length;
    }
    return items;
  }

  // GET /v1/reports/brand/{reportId}/prompts/{promptId}/ai-responses — cursor-paginated.
  async listPromptResponses(reportId, promptId, { startDate, endDate, country, engine } = {}) {
    const items = [];
    let cursor;
    do {
      const page = await this.#get(
        `/v1/reports/brand/${encodeURIComponent(reportId)}/prompts/${encodeURIComponent(promptId)}/ai-responses`,
        { startDate, endDate, country, engine, cursor }
      );
      items.push(...(page.items ?? []));
      cursor = page.paging?.hasMore ? page.paging.nextCursor : undefined;
    } while (cursor);
    return items;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
