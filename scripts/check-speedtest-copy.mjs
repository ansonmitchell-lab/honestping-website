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

const pagePath = path.join(dir, "index.html");
const pageJsPath = path.join(dir, "speedtest-page.js");
const shortfallPath = path.join(dir, "speedtest-shortfall.js");
const page = fs.readFileSync(pagePath, "utf8");
const pageJs = fs.readFileSync(pageJsPath, "utf8");
const shortfallJs = fs.readFileSync(shortfallPath, "utf8");
const requiredInBoth = [
  "See your evenings. Join the waitlist for the HonestPing app for Windows, then add a 7-day Pro report when you want the full week.",
  "Details in our privacy policy.",
  "Free to download for Windows when it launches. Pro and the 7-day report are paid.",
  "Thanks, you're on the waitlist. We'll email you when the HonestPing app for Windows is ready to download. Every email has an unsubscribe link.",
  "That email doesn't look right. Please check it and try again.",
  "See your evenings. Get the HonestPing app for Windows, then add a 7-day Pro report when you want the full week.",
  "Free to download for Windows. Pro and the 7-day report are paid."
];
for (const line of requiredInBoth) {
  if (!page.includes(line)) problems.push("test/index.html is missing approved line: " + line);
  if (!pageJs.includes(line)) problems.push("test/speedtest-page.js is missing approved line: " + line);
}
for (const line of ["Your email", "Join the waitlist"]) {
  if (!page.includes(line)) problems.push("test/index.html is missing approved line: " + line);
}
if (!page.includes('action="mailto:hello@honestping.com"')) {
  problems.push("test/index.html waitlist is not the mailto form");
}
if (!page.includes('href="/privacy"')) {
  problems.push("test/index.html privacy link is missing");
}
const waitlistBlock = (page.match(/<div data-variant-waitlist>([\s\S]*?)<\/div>/) || ["", ""])[1];
if (!waitlistBlock) problems.push("test/index.html is missing the waitlist block");
if (waitlistBlock.includes("src=")) problems.push("test/index.html waitlist block has a source tag");
if (/<input[^>]*type="checkbox"/i.test(waitlistBlock)) {
  problems.push("test/index.html waitlist block has a checkbox");
}

const snapshotLine = "One test is a snapshot. Your evenings may differ.";
const varyLine = "Speeds vary with Wi-Fi, devices and time of day, and plans usually promise speeds 'up to' a number.";
const planHelper = 'Optional. Your plan speeds stay in this page. Tick "Remember my plan" to keep them in this browser.';
const fullGood = "Good news is worth knowing. A week of tests shows whether evenings hold up too.";
for (const line of [snapshotLine]) {
  if (!page.includes(line)) problems.push("test/index.html is missing approved line: " + line);
  if (!pageJs.includes(line)) problems.push("test/speedtest-page.js is missing approved line: " + line);
}
for (const line of [
  varyLine,
  "About {n}% of your plan's download and {m}% of its upload on this test.",
  "About {n}% of your plan's download on this test.",
  "About {n}% of your plan's upload on this test."
]) {
  if (!shortfallJs.includes(line)) problems.push("test/speedtest-shortfall.js is missing approved line: " + line);
}
for (const line of [
  fullGood,
  "This test came in under your plan.",
  "Lots of things can shape one test, at home and along the way. A week of tests, checked against your plan, gives a clearer picture.",
  "Ping moved around a lot during this test. A week of tests shows whether that's a one off or a pattern.",
  "Some connections are hard to read in one go. The app can test over a week and show what's typical."
]) {
  if (!pageJs.includes(line)) problems.push("test/speedtest-page.js is missing approved line: " + line);
}
const waitlistLine = "We'll only use your email to tell you when HonestPing is ready to download. We won't send anything else unless you sign up for it.";
for (const line of [varyLine, planHelper, waitlistLine, "Forget my plan", "Remember my plan"]) {
  if (!page.includes(line)) problems.push("test/index.html is missing approved line: " + line);
}
function withoutFullGood(text) {
  return text.split(fullGood).join("");
}
for (const [label, text] of [
  ["test/index.html", page],
  ["test/speedtest-page.js", pageJs],
  ["test/speedtest-shortfall.js", shortfallJs]
]) {
  if (withoutFullGood(text).includes("Good news is worth knowing.")) {
    problems.push(label + " has Good news is worth knowing. without the full prompt");
  }
}
const privacy = fs.readFileSync(path.join(root, "privacy", "index.html"), "utf8");
const privacyPlan = "If you tick 'Remember my plan', your plan speeds are saved in your browser only, and you can clear them with 'Forget my plan'.";
if (!privacy.includes(privacyPlan)) {
  problems.push("privacy page plan wording is not the Forget my plan line");
}
const retired = [
  "You may not be getting the speed you pay for.",
  "One test is a snapshot. A 7-day report shows the full week.",
  "About {n}% of your plan's download speed in this test.",
  "About {n}% of your plan's upload speed in this test.",
  "speeds up to a number.",
  "Waitlist mail is only used to notify you when HonestPing is available. No extra newsletters unless you ask."
];
for (const line of retired) {
  if (page.includes(line)) problems.push("test/index.html still has retired line: " + line);
  if (pageJs.includes(line)) problems.push("test/speedtest-page.js still has retired line: " + line);
  if (shortfallJs.includes(line)) problems.push("test/speedtest-shortfall.js still has retired line: " + line);
}
const services = [
  "netflix", "youtube", "twitch", "hulu", "disney", "zoom", "skype", "facetime",
  "discord", "whatsapp", "fortnite", "valorant", "spotify", "xbox", "playstation"
];
const configJs = fs.readFileSync(path.join(dir, "speedtest-config.js"), "utf8");
for (const file of [pagePath, pageJsPath, shortfallPath, path.join(dir, "speedtest-config.js")]) {
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  const rel = path.relative(root, file);
  for (const name of services) {
    if (text.includes(name)) problems.push(rel + " names a service: " + name);
  }
}
if (!configJs.includes("export var THRESHOLDS")) {
  problems.push("test/speedtest-config.js is missing the thresholds config");
}
for (const line of [
  "Looks calm enough for a call in this snapshot.",
  "A call may notice the delay in this snapshot.",
  "Looks playable in this snapshot.",
  "A game may feel the delay in this snapshot.",
  "This snapshot has room for a high quality stream.",
  "A stream may step down in quality on this snapshot.",
  "A stream may pause on this snapshot.",
  "High for live calls and games",
  "Fine for most uses",
  "Higher while the line is busy",
  "Close to the idle ping"
]) {
  if (!configJs.includes(line)) problems.push("test/speedtest-config.js is missing approved rating: " + line);
}

for (const file of [pagePath, pageJsPath, shortfallPath, path.join(dir, "speedtest-config.js")]) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  if (/\$\s*\d/.test(text)) problems.push(rel + " has a dollar figure");
  if (/cheaper plan/i.test(text)) problems.push(rel + " pitches a cheaper plan");
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test copy check ok");
