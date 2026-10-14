import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "test");
const banned = [
  "verified",
  "verify",
  "certified",
  "official",
  "ripped off",
  "overpaying",
  "silver",
  "bronze",
  "steel"
];
const vendors = ["cloudflare", "ookla", "fast.com", "librespeed", "speedtest.net", "netflix"];
const problems = [];

function walk(folder, out = []) {
  for (const name of fs.readdirSync(folder)) {
    const abs = path.join(folder, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(html|css|js)$/.test(name)) out.push(abs);
  }
  return out;
}

for (const file of walk(dir)) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  if (text.includes("\u2014") || text.includes("\u2013")) {
    problems.push(rel + " has an em or en dash");
  }
  const lower = text.toLowerCase();
  for (const word of banned) {
    if (lower.includes(word)) problems.push(rel + " has banned word: " + word);
  }
  if (/\bcsv\b/i.test(text)) problems.push(rel + " has banned word: csv");
  if (file.endsWith(".html") || file.endsWith(".css")) {
    for (const vendor of vendors) {
      if (lower.includes(vendor)) problems.push(rel + " names a third party: " + vendor);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test copy check ok");
