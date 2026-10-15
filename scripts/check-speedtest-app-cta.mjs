/* The app download shows after every completed speed test on the app variant.
   Good, mixed, below, unclear, and poor all reveal the same block: the lead,
   the Get the app link, and the paid line. The poor/good branch panel does
   not gate that block. BRANCH_HOOKS_ENABLED stays false. */
import fs from "node:fs";
import path from "node:path";
import { BRANCH_HOOKS_ENABLED, BRANCH_COPY, THRESHOLDS, isPoorResult, ratePing, rateJitter, rateBusy, useLine, loadedBusyMs } from "../test/speedtest-config.js";
import { shortfallReport, SHORTFALL_COPY } from "../test/speedtest-shortfall.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pageSrc = fs.readFileSync(path.join(root, "test", "speedtest-page.js"), "utf8");
const html = fs.readFileSync(path.join(root, "test", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "test", "speedtest.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "_worker.js"), "utf8");

const APP_LEAD = "See your evenings. Get the HonestPing app for Windows, then add a 7-day Pro report when you want the full week.";
const APP_PAID = "Free to download for Windows. Pro and the 7-day report are paid.";

const problems = [];

function check(cond, message) {
  if (!cond) problems.push(message);
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

class TextNode {
  constructor(data) {
    this.nodeType = 3;
    this.data = data;
    this.textContent = data;
    this.parentElement = null;
    this.parentNode = null;
  }
}

class El {
  constructor(tag, attrs) {
    this.tag = tag;
    this.nodeType = 1;
    this.attrs = Object.assign({}, attrs);
    this.children = [];
    this.childNodes = [];
    this.parentElement = null;
    this.parentNode = null;
    this._listeners = {};
    this._value = undefined;
    this._checked = Object.prototype.hasOwnProperty.call(this.attrs, "checked");
    this._disabled = false;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, String(name).toLowerCase());
  }

  getAttribute(name) {
    name = String(name).toLowerCase();
    return this.hasAttribute(name) ? this.attrs[name] : null;
  }

  setAttribute(name, value) {
    this.attrs[String(name).toLowerCase()] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[String(name).toLowerCase()];
  }

  get hidden() {
    return this.hasAttribute("hidden");
  }

  set hidden(value) {
    if (value) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }

  get inert() {
    return this.hasAttribute("inert");
  }

  set inert(value) {
    if (value) this.setAttribute("inert", "");
    else this.removeAttribute("inert");
  }

  get value() {
    if (this._value !== undefined) return this._value;
    return this.getAttribute("value") || "";
  }

  set value(value) {
    this._value = String(value);
  }

  get checked() {
    return this._checked;
  }

  set checked(value) {
    this._checked = !!value;
  }

  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    this._disabled = !!value;
  }

  get textContent() {
    let out = "";
    for (const child of this.childNodes) out += child.textContent;
    return out;
  }

  set textContent(value) {
    const text = new TextNode(String(value));
    text.parentElement = this;
    text.parentNode = this;
    this.children = [];
    this.childNodes = [text];
  }

  get classList() {
    const el = this;
    const tokens = () => (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    const write = (list) => {
      if (list.length) el.setAttribute("class", list.join(" "));
      else el.removeAttribute("class");
    };
    return {
      contains(name) {
        return tokens().includes(name);
      },
      add(...names) {
        const list = tokens();
        for (const name of names) {
          if (name && !list.includes(name)) list.push(name);
        }
        write(list);
      },
      remove(...names) {
        write(tokens().filter((name) => !names.includes(name)));
      },
      toggle(name, force) {
        const has = tokens().includes(name);
        const next = force === undefined ? !has : !!force;
        if (next) this.add(name);
        else this.remove(name);
        return next;
      }
    };
  }

  appendChild(child) {
    if (child.parentElement) {
      const parent = child.parentElement;
      parent.children = parent.children.filter((node) => node !== child);
      parent.childNodes = parent.childNodes.filter((node) => node !== child);
    }
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    this.childNodes.push(child);
    return child;
  }

  appendText(data) {
    const text = new TextNode(data);
    text.parentElement = this;
    text.parentNode = this;
    this.childNodes.push(text);
  }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }

  dispatchEvent(type) {
    const list = this._listeners[type] || [];
    for (const fn of list) fn({ preventDefault() {}, target: this, currentTarget: this });
  }

  querySelector(selector) {
    return queryAll(this, selector, false)[0] || null;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector, false);
  }

  getBoundingClientRect() {
    return { top: 120, left: 0, right: 400, bottom: 400, width: 400, height: 280 };
  }

  focus() {}

  scrollIntoView() {}
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/=]+)))?/g;
  let match;
  while ((match = re.exec(raw))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function parseHtml(source) {
  const root = new El("#document", {});
  const stack = [root];
  let i = 0;
  while (i < source.length) {
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<!", i)) {
      const end = source.indexOf(">", i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source[i] === "<" && source[i + 1] === "/") {
      const end = source.indexOf(">", i);
      const name = source.slice(i + 2, end).trim().toLowerCase();
      i = end + 1;
      for (let s = stack.length - 1; s > 0; s--) {
        const popped = stack.pop();
        if (popped.tag === name) break;
      }
      continue;
    }
    if (source[i] === "<") {
      const end = source.indexOf(">", i);
      let raw = source.slice(i + 1, end);
      i = end + 1;
      let selfClose = false;
      if (raw.endsWith("/")) {
        selfClose = true;
        raw = raw.slice(0, -1);
      }
      const nameMatch = /^([a-zA-Z0-9:-]+)/.exec(raw);
      if (!nameMatch) continue;
      const tag = nameMatch[1].toLowerCase();
      const node = new El(tag, parseAttrs(raw.slice(nameMatch[0].length)));
      stack[stack.length - 1].appendChild(node);
      if (selfClose || VOID.has(tag)) continue;
      if (tag === "script" || tag === "style") {
        const close = new RegExp("</" + tag + "\\s*>", "i");
        const rest = source.slice(i);
        const found = close.exec(rest);
        node.textContent = found ? rest.slice(0, found.index) : rest;
        i += found ? found.index + found[0].length : rest.length;
        continue;
      }
      stack.push(node);
      continue;
    }
    const next = source.indexOf("<", i);
    const text = source.slice(i, next === -1 ? source.length : next);
    i = next === -1 ? source.length : next;
    if (text.trim()) stack[stack.length - 1].appendText(text);
  }
  return root;
}

function parsePart(part) {
  let i = 0;
  let tag = null;
  let id = null;
  const classes = [];
  const attrs = [];
  while (i < part.length) {
    if (part[i] === ".") {
      i += 1;
      const match = /^[a-zA-Z0-9_-]+/.exec(part.slice(i));
      classes.push(match[0]);
      i += match[0].length;
    } else if (part[i] === "#") {
      i += 1;
      const match = /^[a-zA-Z0-9_-]+/.exec(part.slice(i));
      id = match[0];
      i += match[0].length;
    } else if (part[i] === "[") {
      const end = part.indexOf("]", i);
      const body = part.slice(i + 1, end);
      const eq = body.indexOf("=");
      if (eq === -1) attrs.push({ name: body.trim().toLowerCase(), value: null });
      else {
        let value = body.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        attrs.push({ name: body.slice(0, eq).trim().toLowerCase(), value });
      }
      i = end + 1;
    } else {
      const match = /^[a-zA-Z0-9:-]+/.exec(part.slice(i));
      tag = match[0].toLowerCase();
      i += match[0].length;
    }
  }
  return { tag, id, classes, attrs };
}

function matches(el, sel) {
  if (sel.tag && el.tag !== sel.tag) return false;
  if (sel.id && el.getAttribute("id") !== sel.id) return false;
  for (const name of sel.classes) {
    if (!el.classList.contains(name)) return false;
  }
  for (const attr of sel.attrs) {
    if (attr.value == null) {
      if (!el.hasAttribute(attr.name)) return false;
    } else if (el.getAttribute(attr.name) !== attr.value) return false;
  }
  return true;
}

function descendants(el) {
  const out = [];
  (function walk(node) {
    for (const child of node.children) {
      out.push(child);
      walk(child);
    }
  })(el);
  return out;
}

function queryAll(root, selector, includeSelf) {
  const parts = selector.trim().split(/\s+/).filter(Boolean).map(parsePart);
  const pool = includeSelf ? [root, ...descendants(root)] : descendants(root);
  let matched = pool.filter((el) => matches(el, parts[0]));
  for (let i = 1; i < parts.length; i++) {
    const next = [];
    for (const el of matched) {
      for (const child of descendants(el)) {
        if (matches(child, parts[i])) next.push(child);
      }
    }
    matched = next;
  }
  return matched;
}

function makeDocument(source) {
  const tree = parseHtml(source);
  const documentElement = tree.children.find((node) => node.tag === "html");
  if (!documentElement) throw new Error("speed test page has no html element");
  documentElement.setAttribute("data-st-variant", "app");
  return {
    documentElement,
    querySelector(selector) {
      return queryAll(documentElement, selector, true)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(documentElement, selector, true);
    },
    getElementById(id) {
      return queryAll(documentElement, "#" + id, true)[0] || null;
    },
    addEventListener() {}
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

const pageBody = pageSrc.replace(/^import\s.+$/gm, "");
const pageFn = new Function(
  "window",
  "document",
  "location",
  "localStorage",
  "createEngine",
  "count",
  "mountRabbit",
  "BRANCH_HOOKS_ENABLED",
  "BRANCH_COPY",
  "THRESHOLDS",
  "isPoorResult",
  "ratePing",
  "rateJitter",
  "rateBusy",
  "useLine",
  "loadedBusyMs",
  "shortfallReport",
  "SHORTFALL_COPY",
  pageBody
);

function boot(hostname) {
  const document = makeDocument(html);
  const location = {
    hostname,
    search: "",
    href: "https://" + hostname + "/test"
  };
  const store = memoryStorage();
  let sample = null;
  const window = {
    document,
    location,
    innerHeight: 800,
    matchMedia() {
      return { matches: true };
    },
    setTimeout() {
      return 0;
    },
    addEventListener() {},
    requestAnimationFrame() {
      return 0;
    },
    cancelAnimationFrame() {}
  };
  pageFn(
    window,
    document,
    location,
    store,
    function createEngine() {
      return {
        start(_onUpdate, onDone) {
          onDone(sample);
          return function cancel() {};
        }
      };
    },
    function count() {},
    function mountRabbit() {
      return { phase() {}, sample() {} };
    },
    BRANCH_HOOKS_ENABLED,
    BRANCH_COPY,
    THRESHOLDS,
    isPoorResult,
    ratePing,
    rateJitter,
    rateBusy,
    useLine,
    loadedBusyMs,
    shortfallReport,
    SHORTFALL_COPY
  );
  return {
    document,
    finish(next) {
      sample = Object.assign({}, next);
      document.querySelector("[data-start]").dispatchEvent("click");
    }
  };
}

function ancestorHidden(el) {
  let node = el;
  while (node) {
    if (node.hidden) return true;
    node = node.parentElement;
  }
  return false;
}

function inside(el, ancestor) {
  let node = el;
  while (node) {
    if (node === ancestor) return true;
    node = node.parentElement;
  }
  return false;
}

function appCtaProblem(document) {
  if (document.documentElement.getAttribute("data-st-variant") !== "app") return "variant is not app";
  const result = document.querySelector("[data-result]");
  if (!result || !result.classList.contains("is-ready")) return "result is not revealed";
  const grow = result.querySelector("[data-result-grow]");
  if (!grow) return "result block is missing";
  if (grow.hasAttribute("aria-hidden")) return "result block is still hidden from assistive tech";
  if (grow.inert) return "result block is still inert";
  const anchor = document.querySelector("[data-app-anchor]");
  if (!anchor) return "app anchor is missing";
  if (anchor.hidden) return "app anchor is hidden";
  const block = anchor.querySelector("[data-variant-app]");
  if (!block) return "app block is missing from the anchor";
  if (block.hidden) return "app block is hidden";
  const branch = document.querySelector("[data-branch]");
  if (branch && inside(block, branch)) return "app block sits inside the branch panel";
  if (ancestorHidden(block)) return "app block has a hidden ancestor";
  const lead = block.querySelector("[data-cta-lead]");
  if (!lead || lead.hidden) return "cta lead is hidden";
  if (lead.textContent.trim() !== APP_LEAD) return "cta lead text changed: " + lead.textContent.trim();
  const link = block.querySelector("a[data-cta]");
  if (!link || link.hidden) return "Get the app link is hidden";
  if (ancestorHidden(link)) return "Get the app link has a hidden ancestor";
  if (link.textContent.trim() !== "Get the app") return "Get the app link text changed: " + link.textContent.trim();
  if (link.getAttribute("href") !== "/?src=webtest") return "Get the app link target changed";
  const paid = block.querySelector(".st-app-paid");
  if (!paid || paid.hidden) return "paid line is hidden";
  if (paid.textContent.trim() !== APP_PAID) return "paid line changed: " + paid.textContent.trim();
  return "";
}

const FIXTURES = [
  {
    name: "good",
    down: "",
    up: "",
    plans: { down: null, up: null },
    sample: { downloadMbps: 150, uploadMbps: 30, pingMs: 18, jitterMs: 3, loadedDownMs: 24, loadedUpMs: 22 },
    head: "This test looks healthy.",
    poor: false,
    branch: "good"
  },
  {
    name: "mixed",
    down: "",
    up: "",
    plans: { down: null, up: null },
    sample: { downloadMbps: 100, uploadMbps: 30, pingMs: 20, jitterMs: 16, loadedDownMs: 25, loadedUpMs: 22 },
    head: "Mostly healthy, with one thing to watch.",
    poor: false,
    branch: "none"
  },
  {
    name: "below",
    down: "300",
    up: "30",
    plans: { down: 300, up: 30 },
    sample: { downloadMbps: 210, uploadMbps: 30, pingMs: 18, jitterMs: 3, loadedDownMs: 22, loadedUpMs: 20 },
    head: "This test came in under your plan.",
    poor: false,
    branch: "none"
  },
  {
    name: "unclear",
    down: "",
    up: "",
    plans: { down: null, up: null },
    sample: { downloadMbps: null, uploadMbps: null, pingMs: null, jitterMs: null, loadedDownMs: null, loadedUpMs: null },
    head: "We couldn't get a clear reading this time.",
    poor: false,
    branch: "none"
  },
  {
    name: "poor",
    down: "300",
    up: "30",
    plans: { down: 300, up: 30 },
    sample: { downloadMbps: 80, uploadMbps: 10, pingMs: 22, jitterMs: 3, loadedDownMs: 28, loadedUpMs: 24 },
    head: "This test came in under your plan.",
    poor: true,
    branch: "poor"
  }
];

const HOSTS = [
  { name: "production", hostname: "www.honestping.com", hooks: false },
  { name: "preview", hostname: "preview-web-speedtest.honestping.pages.dev", hooks: true }
];

check(BRANCH_HOOKS_ENABLED === false, "production flag stays off");
check(
  /variant === "waitlist" \? "\[data-variant-app\]" : "\[data-variant-waitlist\]"/.test(worker),
  "app variant keeps the app block when the worker rewrites the page"
);
check(
  /\.st-result\.is-ready \.st-result-grow\s*\{[^}]*opacity:\s*1/.test(css),
  "a revealed result is opaque"
);
check(
  /\.st-result\.is-ready \.st-result-grow\s*\{[^}]*grid-template-rows:\s*1fr/.test(css),
  "a revealed result expands"
);

const CTA_SELECTOR = /data-variant-app|data-app-anchor|data-cta-lead|st-app-download|st-app-paid/;
const ALLOWED_HIDE = new Set([
  '[data-st-variant="waitlist"] [data-variant-app]',
  "[data-app-anchor][hidden]"
]);
const strippedCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
let ruleMatch;
while ((ruleMatch = ruleRe.exec(strippedCss))) {
  const hides = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|content-visibility\s*:\s*hidden/.test(ruleMatch[2]);
  if (!hides) continue;
  for (const raw of ruleMatch[1].split(",")) {
    const selector = raw.replace(/\s+/g, " ").trim();
    if (!CTA_SELECTOR.test(selector)) continue;
    if (!ALLOWED_HIDE.has(selector)) problems.push("css hides the app download: " + selector);
  }
}
check(ALLOWED_HIDE.has('[data-st-variant="waitlist"] [data-variant-app]'), "waitlist variant is the only variant that drops the app block");

const probe = makeDocument(html);
for (const selector of ["[data-speedtest]", "[data-start]", "[data-result]", "[data-result-grow]", "[data-app-anchor]", "[data-variant-app]", "[data-cta-lead]", "[data-branch]", "[data-plan-down]", "[data-plan-up]", "[data-headline]"]) {
  check(probe.querySelector(selector), "page is missing " + selector);
}
const probeLead = probe.querySelector("[data-cta-lead]");
const probeLink = probe.querySelector("[data-variant-app] a[data-cta]");
check(probeLead && probeLead.textContent.trim() === APP_LEAD, "page lead is not the approved line");
check(probeLink && probeLink.textContent.trim() === "Get the app", "page is missing the Get the app link");
check(probe.querySelector(".st-app-paid").textContent.trim() === APP_PAID, "page paid line is not the approved line");
check(!probe.querySelector("[data-app-anchor]").hidden, "anchor starts without the hidden attribute");
check(probe.querySelector("[data-result-grow]").hasAttribute("aria-hidden"), "result starts hidden until a test finishes");

for (const fixture of FIXTURES) {
  check(isPoorResult(fixture.sample, fixture.plans) === fixture.poor, fixture.name + " fixture poor flag drifted");
}

if (!problems.length) {
  for (const host of HOSTS) {
    for (const fixture of FIXTURES) {
      const label = host.name + " " + fixture.name;
      let page;
      try {
        page = boot(host.hostname);
      } catch (error) {
        problems.push(label + " failed to boot: " + error.message);
        continue;
      }
      const before = page.document.querySelector("[data-app-anchor]");
      check(before && before.hidden, label + " shows the app download before a result");
      check(!page.document.querySelector("[data-result]").classList.contains("is-ready"), label + " reveals a result before the test");
      page.document.querySelector("[data-plan-down]").value = fixture.down;
      page.document.querySelector("[data-plan-up]").value = fixture.up;
      try {
        page.finish(fixture.sample);
      } catch (error) {
        problems.push(label + " failed to finish: " + error.message);
        continue;
      }
      const where = appCtaProblem(page.document);
      check(!where, label + " hides the app download: " + where);
      const head = page.document.querySelector("[data-headline]");
      check(head && !head.hidden && head.textContent.trim() === fixture.head, label + " headline was " + (head ? head.textContent.trim() : "missing"));
      const branch = page.document.querySelector("[data-branch]");
      const open = branch && !branch.hidden;
      if (host.hooks && fixture.branch !== "none") {
        check(open && branch.getAttribute("data-branch-kind") === fixture.branch, label + " branch did not open as " + fixture.branch);
      } else {
        check(!open, label + " opened the branch panel");
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("speed test app download check ok");
