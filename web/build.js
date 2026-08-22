// Inlines SheetJS into template.html to produce the self-contained app,
// otterly-export.html — a single local file that Alexandra opens directly.
// (Netlify hosts only the proxy function, not this app; see netlify.toml.)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const template = readFileSync(join(here, "template.html"), "utf8");
const sheetjs = readFileSync(join(root, "node_modules", "xlsx", "dist", "xlsx.full.min.js"), "utf8");

const out = template.replace("<!--SHEETJS-->", () => `<script>\n${sheetjs}\n</script>`);

const dest = join(root, "otterly-export.html");
writeFileSync(dest, out);
console.log(`Built otterly-export.html (${(out.length / 1024).toFixed(0)} KB) — send this file to Alexandra.`);
