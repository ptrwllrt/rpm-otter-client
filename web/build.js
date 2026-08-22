// Inlines SheetJS into template.html to produce the self-contained app.
// Emits two copies of the same file:
//   - public/index.html      → what Netlify publishes (uses the /api proxy)
//   - otterly-export.html     → a standalone copy for reference / local opening
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const template = readFileSync(join(here, "template.html"), "utf8");
const sheetjs = readFileSync(join(root, "node_modules", "xlsx", "dist", "xlsx.full.min.js"), "utf8");

const out = template.replace("<!--SHEETJS-->", () => `<script>\n${sheetjs}\n</script>`);

mkdirSync(join(root, "public"), { recursive: true });
const targets = [join(root, "public", "index.html"), join(root, "otterly-export.html")];
for (const dest of targets) writeFileSync(dest, out);
console.log(`Built ${targets.map((t) => t.replace(root + "/", "")).join(" and ")} (${(out.length / 1024).toFixed(0)} KB each)`);
