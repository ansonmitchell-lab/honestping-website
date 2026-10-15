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

// Whole phrases only. "Life" alone, "for a year", "lifelong", and "for lifestyle" stay allowed.
const APPROVED_FOUNDING =
  "$39 a year, locked for as long as your Founding Member plan stays active";

// "every evening" may be followed only by the exact words "HonestPing is open".
// "each evening" and "every night" may also use "while HonestPing is open".
// Brand spelling in the qualifier is case-sensitive. "while" is not.
const HONESTPING_OPEN = /^\s+HonestPing is open\b/;
const WHILE_HONESTPING_OPEN = /^\s+[Ww][Hh][Ii][Ll][Ee]\s+HonestPing is open\b/;

function lifeHits(text) {
  const stripped = text.split(APPROVED_FOUNDING).join("\n");
  const hits = [];
  if (/\bfor life\b/i.test(stripped)) hits.push("for life");
  if (/\blifetime\b/i.test(stripped)) hits.push("lifetime");
  return hits;
}

function eveningHits(text) {
  const hits = [];
  const add = (label) => {
    if (!hits.includes(label)) hits.push(label);
  };
  const re = /\b(every evening|each evening|every night)\b/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const phrase = match[1].toLowerCase();
    const rest = text.slice(match.index + match[0].length);
    if (phrase === "every evening") {
      if (!HONESTPING_OPEN.test(rest)) {
        add('every evening without "HonestPing is open"');
      }
      continue;
    }
    if (!HONESTPING_OPEN.test(rest) && !WHILE_HONESTPING_OPEN.test(rest)) {
      add(phrase + " without an open-app qualifier");
    }
  }
  return hits;
}

function copyHits(text) {
  return [
    ...lifeHits(text).map((phrase) => "banned phrase " + phrase),
    ...eveningHits(text)
  ];
}

function selfTest() {
  const expect = [
    ["locked for life", true],
    ["lifetime price", true],
    ["FOR LIFE", true],
    ["LifeTime deal", true],
    ["$39 a year, locked for as long as your Founding Member plan stays active", false],
    ["locked for life. $39 a year, locked for as long as your Founding Member plan stays active", true],
    ["$39 a year, locked for as long as your Founding Member plan stays active for life", true],
    ["for a year", false],
    ["Life is short", false],
    ["lifelong plan", false],
    ["for lifestyle", false],
    ["every evening HonestPing is open", false],
    ["A gamer test every evening HonestPing is open", false],
    ["One gamer test every evening HonestPing is open, for a week.", false],
    ["Every evening HonestPing is open", false],
    ["every evening  HonestPing is open", false],
    ["each evening while HonestPing is open", false],
    ["Each evening while HonestPing is open", false],
    ["EACH EVENING WHILE HonestPing is open", false],
    ["each evening HonestPing is open", false],
    ["every night HonestPing is open", false],
    ["every night while HonestPing is open", false],
    ["every night WHILE HonestPing is open", false],
    ["Prime time is the evening.", false],
    ["in the evening, when more people are online", false],
    ["delivered at least 90% of advertised download speed in evening hours.", false],
    ["on a game night", false],
    ["Your evenings may differ.", false],
    ["That can show up more in the evening.", false],
    ["A gamer test every evening", true],
    ["every evening of the week", true],
    ["every evening while HonestPing is open", true],
    ["every evening WHILE HonestPing is open", true],
    ["every evening honestping is open", true],
    ["every evening Honestping is open", true],
    ["every evening HonestPing Is Open", true],
    ["One gamer test each evening, for a week.", true],
    ["each evening while honestping is open", true],
    ["We test every night.", true],
    ["every night the app is open", true]
  ];
  const problems = [];
  for (const [text, bad] of expect) {
    const hits = copyHits(text);
    if (bad && !hits.length) problems.push("missed " + JSON.stringify(text));
    if (!bad && hits.length) problems.push("false hit " + JSON.stringify(hits) + " on " + JSON.stringify(text));
  }
  const both = lifeHits("a lifetime, locked for life");
  if (both.join("|") !== "for life|lifetime") {
    problems.push("expected both life phrases, got " + JSON.stringify(both));
  }
  const bareEvenings = eveningHits("We test each evening and every night.");
  const expectedEvenings = [
    "each evening without an open-app qualifier",
    "every night without an open-app qualifier"
  ];
  if (bareEvenings.join("|") !== expectedEvenings.join("|")) {
    problems.push("expected both bare evening phrases, got " + JSON.stringify(bareEvenings));
  }
  const secondEvening = eveningHits("every evening HonestPing is open, then every evening again");
  if (!secondEvening.includes('every evening without "HonestPing is open"')) {
    problems.push("missed a later unqualified every evening");
  }
  return problems;
}

function walk(folder, out = []) {
  for (const name of fs.readdirSync(folder)) {
    const abs = path.join(folder, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(html|css|js)$/.test(name)) out.push(abs);
  }
  return out;
}

const selfProblems = selfTest();
if (selfProblems.length) {
  console.error("speed test copy checker self-test failed: " + selfProblems.join("; "));
  process.exit(1);
}

const problems = [];
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
  for (const phrase of lifeHits(text)) {
    problems.push(rel + " has banned phrase: " + phrase);
  }
  for (const hit of eveningHits(text)) {
    problems.push(rel + " has " + hit);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test copy check ok");
