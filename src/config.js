// Minimal .env loader + shared config helpers. No external dependency.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

// Resolve the date window. Priority: explicit START_DATE/END_DATE, else last N days.
export function resolveDateWindow({ startDate, endDate, days } = {}) {
  const envStart = startDate ?? process.env.OTTERLY_START_DATE;
  const envEnd = endDate ?? process.env.OTTERLY_END_DATE;
  if (envStart && envEnd) return { startDate: envStart, endDate: envEnd };

  const n = Number(days ?? process.env.OTTERLY_DAYS ?? 14);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (Number.isFinite(n) ? n : 14));
  return { startDate: fmt(start), endDate: fmt(end) };
}

export const ROOT_DIR = ROOT;
export const OUTPUT_DIR = join(ROOT, "output");

const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
