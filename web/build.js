// Produces otterly-export.html — a single local file that Alexandra opens
// directly. The app exports CSV + JSON with no libraries, so this is just a copy
// of the template (kept as a build step so the workflow/paths stay stable).
// (Netlify hosts only the proxy function, not this app; see netlify.toml.)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = readFileSync(join(here, "template.html"), "utf8");

const dest = join(root, "otterly-export.html");
writeFileSync(dest, out);
console.log(`Built otterly-export.html (${(out.length / 1024).toFixed(0)} KB) — send this file to Alexandra.`);
