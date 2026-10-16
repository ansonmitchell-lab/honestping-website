#!/usr/bin/env python3
"""Fail if Legal's standing banned phrases, or an em/en dash, return in marketing-site copy.

Scans user-visible strings on this repo's main tree: HTML text nodes, titles,
meta descriptions, aria-labels, alt text, placeholders, title tooltips, string
literals in inline scripts and in local scripts those pages load, and CSS
content values.

Em dash (U+2014) and en dash (U+2013) fail on those same surfaces. Ordinary
hyphen-minus (U+002D), as in "7-day" or "work-from-home", stays allowed.

"evidence" and "proof" are whole English words (Legal v2026-10-15h), same
spirit as verified, certified, and official. A dotted host such as
proof.ovh.net, a file name such as proof.png, and a code token such as
isp-proof are not those words.

Does not scan HTML comments, JS comments, CSS class names, file names,
PAGE-SUMMARY.md, or docs/. Those are not the shipped page.

privacy/history.html may quote older policy. List items that contain a clear
date are archival history, so phrases inside those entries are allowed. The
rest of that page (headings, nav, footer, undated text) is still scanned.
"""

import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Legal's approved Founding Member line. It is the only "for life" exception.
APPROVED_FOUNDING = (
    "$39 a year, locked for as long as your Founding Member plan stays active"
)

# Whole phrases only. "Life" alone, "for a year", "lifelong", and "for lifestyle"
# stay allowed. Case does not matter.
LIFE_PATTERNS = (
    ("for life", re.compile(r"\bfor life\b", re.I)),
    ("lifetime", re.compile(r"\blifetime\b", re.I)),
)

# "every evening" may be followed only by the exact words "HonestPing is open".
# "each evening" and "every night" may also use "while HonestPing is open".
# Brand spelling in the qualifier is case-sensitive. "while" is not.
# "High in the evenings?" does not match these schedule phrases.
EVENING_PROMISE = re.compile(r"\b(every evening|each evening|every night)\b", re.I)
HONESTPING_OPEN = re.compile(r"\s+HonestPing is open\b")
WHILE_HONESTPING_OPEN = re.compile(r"\s+(?i:while)\s+HonestPing is open\b")

# Whole words, any capitalization. "officially", "unofficial", and "certification"
# are not these words.
BANNED_WORDS = ("verified", "certified", "official", "ripped off")
WORD_PATTERNS = tuple(
    re.compile(r"\b" + re.escape(word) + r"\b", re.I) for word in BANNED_WORDS
)

# Legal v2026-10-15h. Whole words, any capitalization. "evidently", "proofs",
# "waterproof", and "proofread" are not these words. A dotted host or file name
# (proof.ovh.net, proof.png) is a token, not a marketing claim. A hyphenated or
# underscored token with no spaces (isp-proof, evidence-card) is a class or
# identifier. "evidence-based results" still fails: the word sits in a sentence.
EVIDENCE_PROOF_WORDS = ("evidence", "proof")
EVIDENCE_PROOF_RE = re.compile(r"\b(evidence|proof)\b", re.I)
CODE_TOKEN = re.compile(r"[.#]?[A-Za-z_][A-Za-z0-9_-]*")

# Standing HonestPing UI rule (app DiagnoseCheck case 299). Em dash and en dash
# are banned in user-visible copy. Hyphen-minus (U+002D) is not.
EM_DASH = "\u2014"
EN_DASH = "\u2013"

# Same list as website draft PR 35, scripts/check-speedtest-copy.mjs on
# cursor/speedtest-provider-blame-f5ae (app DiagnoseCheck case 327).
# Do not add phrases here. Case does not matter. Extra spaces and line breaks
# still count. A shorter phrase inside a longer one is reported too.
# "blameless", "blame your ISPs", "provider is at faulty", "blame the call app",
# "whose fault", bare "ISP" or "provider", and "an outage at home that isn't
# your provider's fault" stay allowed.
PROVIDER_BLAME = (
    "blame your ISP",
    "blame your provider",
    "blame the ISP",
    "blame the provider",
    "your ISP is at fault",
    "your provider is at fault",
    "ISP is at fault",
    "provider is at fault",
    "fault of your ISP",
    "fault of your provider",
    "your ISP ripped",
    "your provider ripped",
    "ISP is ripping",
    "provider is ripping",
    "your ISP is cheating",
    "your provider is cheating",
    "your ISP is lying",
    "your provider is lying",
    "sue your ISP",
    "sue your provider",
)

HISTORY_PAGE = "privacy/history.html"
# Dated bullets on the privacy history page are archival quotes, not current copy.
ARCHIVAL_HISTORY_ITEM = re.compile(
    r"<li\b[^>]*>.*?(?:"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2},?\s+\d{4}"
    r"|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{4}"
    r"|\d{4}-\d{2}-\d{2}"
    r").*?</li>",
    re.I | re.S,
)


class PageText(HTMLParser):
    """Collect visible text and classic script bodies. Style and JSON-LD are skipped."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.mode = ""
        self.parts = []
        self.scripts = []
        self._buf = []

    def handle_starttag(self, tag, attrs):
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag in ("script", "style") and not self.mode:
            kind = d.get("type", "").lower()
            if tag == "style" or "json" in kind:
                self.mode = "skip"
            else:
                self.mode = "script"
                self._buf = []
            return
        if self.mode:
            return
        for key in ("aria-label", "alt", "title", "placeholder"):
            value = d.get(key) or ""
            if value.strip():
                self.parts.append(value)
        if tag == "meta":
            name = d.get("name") or d.get("property") or ""
            content = d.get("content") or ""
            if content and any(bit in name for bit in ("description", "title")):
                self.parts.append(content)

    def handle_endtag(self, tag):
        if tag == "script" and self.mode == "script":
            self.scripts.append("".join(self._buf))
            self.mode = ""
            self._buf = []
            return
        if tag in ("script", "style") and self.mode == "skip":
            self.mode = ""

    def handle_data(self, data):
        if self.mode == "script":
            self._buf.append(data)
            return
        if self.mode == "skip":
            return
        if data.strip():
            self.parts.append(data.strip())


def pages():
    found = sorted(ROOT.glob("*.html"))
    privacy = ROOT / "privacy"
    if privacy.is_dir():
        found.extend(sorted(privacy.glob("*.html")))
    return found


def prepare_html(rel, html):
    """Drop dated privacy-history entries. They quote older policy on purpose."""
    if rel == HISTORY_PAGE:
        return ARCHIVAL_HISTORY_ITEM.sub("", html)
    return html


def referenced_scripts(page, html):
    found = []
    for src in re.findall(r"<script\b[^>]*\bsrc=[\"']([^\"']+)[\"']", html, flags=re.I):
        clean = src.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith(("http://", "https://", "//")):
            continue
        for candidate in ((page.parent / clean).resolve(), (ROOT / clean.lstrip("/")).resolve()):
            try:
                candidate.relative_to(ROOT)
            except ValueError:
                continue
            if candidate.is_file():
                found.append(candidate)
                break
    return found


def js_strings(source):
    """String literals only. Line and block comments are skipped."""
    found = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if ch == "/" and nxt == "/":
            i = source.find("\n", i)
            if i < 0:
                break
            continue
        if ch == "/" and nxt == "*":
            end = source.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            buf = []
            while i < n:
                c = source[i]
                if c == "\\":
                    if i + 1 < n and source[i + 1] == "u" and i + 5 < n and re.fullmatch(r"[0-9a-fA-F]{4}", source[i + 2:i + 6]):
                        buf.append(chr(int(source[i + 2:i + 6], 16)))
                        i += 6
                        continue
                    if i + 1 < n:
                        escaped = source[i + 1]
                        buf.append({"n": "\n", "t": "\t", "'": "'", '"': '"', "\\": "\\"}.get(escaped, escaped))
                        i += 2
                        continue
                if c == quote:
                    i += 1
                    break
                buf.append(c)
                i += 1
            raw = "".join(buf).strip()
            if raw:
                found.append(raw)
            continue
        i += 1
    return found


def escape_phrase(phrase):
    return r"\s+".join(re.escape(part) for part in phrase.split())


def provider_blame_hits(text):
    hits = []
    for phrase in PROVIDER_BLAME:
        pattern = re.compile(r"\b" + escape_phrase(phrase) + r"\b", re.I)
        if pattern.search(text):
            hits.append(phrase)
    return hits


def life_hits(text):
    stripped = text.replace(APPROVED_FOUNDING, "\n")
    return [phrase for phrase, pattern in LIFE_PATTERNS if pattern.search(stripped)]


def evening_hits(text):
    hits = []

    def add(label):
        if label not in hits:
            hits.append(label)

    for match in EVENING_PROMISE.finditer(text):
        phrase = match.group(1).lower()
        rest = text[match.end():]
        if phrase == "every evening":
            if HONESTPING_OPEN.match(rest) is None:
                add('every evening without "HonestPing is open"')
            continue
        if HONESTPING_OPEN.match(rest) is None and WHILE_HONESTPING_OPEN.match(rest) is None:
            add(f"{phrase} without an open-app qualifier")
    return hits


def _is_code_token(text):
    """A class, id, or identifier. The bare words evidence and proof are not."""
    token = text.strip()
    if not CODE_TOKEN.fullmatch(token):
        return False
    if "-" not in token and "_" not in token and token[:1] not in ".#":
        return False
    return True


def _in_host_or_filename(text, start, end):
    """True when the word is a label in a dotted host or file name.

    "proof.ovh.net" and "proof.png" qualify. "the proof." does not: a single
    trailing period is sentence punctuation.
    """
    i = start
    while i > 0 and (text[i - 1].isalnum() or text[i - 1] in ".-"):
        i -= 1
    j = end
    while j < len(text) and (text[j].isalnum() or text[j] in ".-"):
        j += 1
    token = text[i:j]
    core = token[:-1] if token.endswith(".") else token
    return "." in core


def evidence_proof_hits(text):
    if _is_code_token(text):
        return []
    found = set()
    for match in EVIDENCE_PROOF_RE.finditer(text):
        if _in_host_or_filename(text, match.start(), match.end()):
            continue
        found.add(match.group(1).lower())
    return [word for word in EVIDENCE_PROOF_WORDS if word in found]


def word_hits(text):
    hits = [word for word, pattern in zip(BANNED_WORDS, WORD_PATTERNS) if pattern.search(text)]
    hits.extend(evidence_proof_hits(text))
    return hits


def dash_hits(text):
    hits = []
    if EM_DASH in text:
        hits.append("em dash")
    if EN_DASH in text:
        hits.append("en dash")
    return hits


def lint_piece(text):
    hits = []
    hits.extend(f"banned phrase {phrase}" for phrase in life_hits(text))
    hits.extend(evening_hits(text))
    hits.extend(f"banned word {word}" for word in word_hits(text))
    hits.extend(f"provider blame {phrase}" for phrase in provider_blame_hits(text))
    hits.extend(f"banned dash {name}" for name in dash_hits(text))
    return hits


def css_content_values(source):
    return [match.group(2) for match in re.finditer(r"content:\s*([\"'])(.*?)\1", source, flags=re.S)]


def snippet(text):
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) > 140:
        return compact[:137] + "..."
    return compact


def pieces_from_html(rel, html):
    parser = PageText()
    parser.feed(prepare_html(rel, html))
    found = [("visible copy", piece) for piece in parser.parts]
    for piece in js_strings("\n".join(parser.scripts)):
        found.append(("inline script", piece))
    return found


def self_test():
    expect = (
        ("locked for life", True),
        ("lifetime price", True),
        ("FOR LIFE", True),
        ("LifeTime deal", True),
        (APPROVED_FOUNDING, False),
        ("locked for life. " + APPROVED_FOUNDING, True),
        (APPROVED_FOUNDING + " for life", True),
        ("for a year", False),
        ("Life is short", False),
        ("lifelong plan", False),
        ("for lifestyle", False),
        ("lifetimes", False),
        ("every evening HonestPing is open", False),
        ("A gamer test every evening HonestPing is open", False),
        ("One gamer test every evening HonestPing is open, for a week.", False),
        ("Every evening HonestPing is open", False),
        ("every evening  HonestPing is open", False),
        ("each evening while HonestPing is open", False),
        ("Each evening while HonestPing is open", False),
        ("EACH EVENING WHILE HonestPing is open", False),
        ("each evening HonestPing is open", False),
        ("every night HonestPing is open", False),
        ("every night while HonestPing is open", False),
        ("every night WHILE HonestPing is open", False),
        ("Prime time is the evening.", False),
        ("in the evening, when more people are online", False),
        ("High in the evenings?", False),
        ("slow evenings and chronic under-delivery", False),
        ("on a game night", False),
        ("a bad night on their side", False),
        ("A gamer test every evening", True),
        ("every evening of the week", True),
        ("every evening while HonestPing is open", True),
        ("every evening WHILE HonestPing is open", True),
        ("every evening honestping is open", True),
        ("every evening Honestping is open", True),
        ("every evening HonestPing Is Open", True),
        ("One gamer test each evening, for a week.", True),
        ("each evening while honestping is open", True),
        ("We test every night.", True),
        ("every night the app is open", True),
        ("This result is verified.", True),
        ("Certified partner", True),
        ("the official app", True),
        ("You got ripped off", True),
        ("RIPPED OFF", True),
        ("officially measured", False),
        ("an unofficial note", False),
        ("certification path", False),
        ("clear evidence", True),
        ("Solid proof", True),
        ("EVIDENCE", True),
        ("the Proof.", True),
        ("Have the proof that you need.", True),
        ("evidence-based results", True),
        ("evidence-based", False),
        ("proof.ovh.net", False),
        ("Reach proof.ovh.net from home", False),
        ("https://proof.ovh.net/status", False),
        ("See proof.ovh.net.", False),
        ("waterproof", False),
        ("proofread the note", False),
        ("evidently fine", False),
        ("proofs", False),
        ("isp-proof", False),
        (".isp-proof", False),
        ("evidence-card", False),
        ("proof.png", False),
        ("evidence.html", False),
        ("assets/proof.png", False),
        ("blame your ISP", True),
        ("blame your provider", True),
        ("blame the ISP", True),
        ("blame the provider", True),
        ("your ISP is at fault", True),
        ("your provider is at fault", True),
        ("ISP is at fault", True),
        ("provider is at fault", True),
        ("fault of your ISP", True),
        ("fault of your provider", True),
        ("your ISP ripped", True),
        ("your provider ripped", True),
        ("ISP is ripping", True),
        ("provider is ripping", True),
        ("your ISP is cheating", True),
        ("your provider is cheating", True),
        ("your ISP is lying", True),
        ("your provider is lying", True),
        ("sue your ISP", True),
        ("sue your provider", True),
        ("BLAME YOUR ISP", True),
        ("blame  your   ISP", True),
        ("blame\nyour\nISP", True),
        ("Don't blame your ISP.", True),
        ("Sue Your Provider", True),
        ("Before you blame the call app", False),
        ("whose fault it is", False),
        ("not my fault", False),
        ("Share a 7-day report with your ISP", False),
        ("talk to your ISP", False),
        ("contact your ISP", False),
        ("ask your ISP", False),
        ("When you call the ISP", False),
        ("ISP", False),
        ("provider", False),
        ("blameless", False),
        ("blame your ISPs", False),
        ("provider is at faulty", False),
        ("an outage at home that isn't your provider's fault", False),
        ("A clear result \u2014 no guesswork", True),
        ("Days 1\u20137", True),
        ("em\u2014and en\u2013together", True),
        ("7-day", False),
        ("work-from-home", False),
        ("well-known path", False),
        ("a spaced - hyphen", False),
    )
    problems = []
    for text, bad in expect:
        hits = lint_piece(text)
        if bad and not hits:
            problems.append(f"missed {text!r}")
        if not bad and hits:
            problems.append(f"false hit {hits} on {text!r}")

    both = life_hits("a lifetime, locked for life")
    if both != ["for life", "lifetime"]:
        problems.append(f"expected both life phrases, got {both!r}")
    nested = provider_blame_hits("your ISP is at fault")
    if nested != ["your ISP is at fault", "ISP is at fault"]:
        problems.append(f"expected both ISP fault phrases, got {nested!r}")
    nested_provider = provider_blame_hits("your provider is at fault")
    if nested_provider != ["your provider is at fault", "provider is at fault"]:
        problems.append(f"expected both provider fault phrases, got {nested_provider!r}")
    if provider_blame_hits(". ".join(PROVIDER_BLAME)) != list(PROVIDER_BLAME):
        problems.append("provider blame list did not match every phrase")
    if len(PROVIDER_BLAME) != 20:
        problems.append(f"provider blame list length is {len(PROVIDER_BLAME)}, expected 20")
    if dash_hits("range 1\u20136 \u2014 done") != ["em dash", "en dash"]:
        problems.append(f"expected both dash types, got {dash_hits('range 1\u20136 \u2014 done')!r}")
    combined = lint_piece("locked for life \u2014 verified")
    for needed in ("banned phrase for life", "banned word verified", "banned dash em dash"):
        if needed not in combined:
            problems.append(f"combined phrase and dash check missing {needed!r}: {combined!r}")
    if "\u002d" in "7-day" and dash_hits("7-day work-from-home"):
        problems.append("hyphen-minus was treated as a banned dash")
    both_words = word_hits("EVIDENCE and PROOF")
    if both_words != ["evidence", "proof"]:
        problems.append(f"expected evidence and proof, got {both_words!r}")
    if evidence_proof_hits("Target proof.ovh.net, then clear evidence") != ["evidence"]:
        problems.append("hostname proof was not ignored beside a real evidence hit")
    if word_hits("my_proof evidence_card") :
        problems.append("underscore identifiers were treated as English words")

    comment_html = """
    <!-- lifetime verified official ripped off, evidence, proof, blame your ISP, every evening -->
    <p>High in the evenings?</p>
    <script>
    // for life
    /* certified official */
    var label = "ok";
    </script>
    """
    comment_hits = [hit for _, piece in pieces_from_html("index.html", comment_html) for hit in lint_piece(piece)]
    if comment_hits:
        problems.append(f"comment or safe copy was flagged: {comment_hits!r}")
    if js_strings('var label = "ok"; // lifetime\n') != ["ok"]:
        problems.append("js comment was treated as a string")
    if js_strings('var label = "7-day"; // jitter 1\u20136 ms\n/* \u2014 */') != ["7-day"]:
        problems.append("js comment with a dash was treated as a string")

    dash_html = """
    <!-- lifetime \u2014 and a range 1\u20133 in a comment -->
    <p class="work-from-home">7-day trial</p>
    <p>Plain result &mdash; no guesswork</p>
    <img alt="Days 1&ndash;7" src="x.png">
    <span title="still &#x2014; here">ok</span>
    <script>
    // jitter 1\u20136 ms
    var ok = "work-from-home";
    var bad = "wait \u2014 now";
    var escaped = "range \\u2013 here";
    </script>
    """
    dash_hits_found = [hit for _, piece in pieces_from_html("index.html", dash_html) for hit in lint_piece(piece)]
    for needed in ("banned dash em dash", "banned dash en dash"):
        if needed not in dash_hits_found:
            problems.append(f"visible dash scan missing {needed!r}: {dash_hits_found!r}")
    if any(hit for hit in dash_hits_found if "banned dash" not in hit):
        problems.append(f"dash fixture flagged a non-dash rule: {dash_hits_found!r}")
    css_hits = [
        hit
        for piece in css_content_values('.ok::before { content: "7-day"; } .bad::before { content: "1\u20133"; }')
        for hit in lint_piece(piece)
    ]
    if css_hits != ["banned dash en dash"]:
        problems.append(f"CSS content dash scan got {css_hits!r}")

    history_html = """
    <ul>
      <li><span data-policy-updated>October 11, 2026</span>: We once said lifetime, verified, evidence, and proof.</li>
      <li>2024-03-01: every evening, blame your ISP</li>
    </ul>
    <p>The current page stays plain.</p>
    """
    history_hits = [hit for _, piece in pieces_from_html(HISTORY_PAGE, history_html) for hit in lint_piece(piece)]
    if history_hits:
        problems.append(f"dated history entries were flagged: {history_hits!r}")
    live_history = "<p>locked for life</p>"
    live_hits = [hit for _, piece in pieces_from_html(HISTORY_PAGE, live_history) for hit in lint_piece(piece)]
    if not any("for life" in hit for hit in live_hits):
        problems.append("undated history copy was not flagged")
    dated_dash = "<ul><li>October 11, 2026: older line used an em dash \u2014 here.</li></ul><p>7-day note</p>"
    dated_dash_hits = [hit for _, piece in pieces_from_html(HISTORY_PAGE, dated_dash) for hit in lint_piece(piece)]
    if dated_dash_hits:
        problems.append(f"dated history dash was flagged: {dated_dash_hits!r}")
    live_dash = "<p>Current line \u2014 still live.</p>"
    live_dash_hits = [hit for _, piece in pieces_from_html(HISTORY_PAGE, live_dash) for hit in lint_piece(piece)]
    if "banned dash em dash" not in live_dash_hits:
        problems.append(f"undated history dash was not flagged: {live_dash_hits!r}")
    host_html = '<p>Lab host proof.ovh.net stays.</p><div class="isp-proof evidence-card">Clear results.</div><img alt="proof.png" src="proof.png">'
    host_hits = [hit for _, piece in pieces_from_html("index.html", host_html) for hit in lint_piece(piece)]
    if host_hits:
        problems.append(f"host, file name, or class was flagged: {host_hits!r}")
    proof_html = "<p>Solid proof.</p>"
    proof_hits = [hit for _, piece in pieces_from_html("index.html", proof_html) for hit in lint_piece(piece)]
    if "banned word proof" not in proof_hits:
        problems.append(f"visible proof was not flagged: {proof_hits!r}")
    return problems


def collect_failures():
    problems = self_test()
    if problems:
        return ["legal copy checker self-test failed: " + "; ".join(problems)]

    failures = []
    seen_scripts = set()
    for page in pages():
        html = page.read_text(encoding="utf-8")
        rel = page.relative_to(ROOT).as_posix()
        for kind, piece in pieces_from_html(rel, html):
            for hit in lint_piece(piece):
                failures.append(f"{rel}: {hit} in {kind}: {snippet(piece)!r}")
        for script in referenced_scripts(page, html):
            if script in seen_scripts:
                continue
            seen_scripts.add(script)
            script_rel = script.relative_to(ROOT).as_posix()
            for piece in js_strings(script.read_text(encoding="utf-8")):
                for hit in lint_piece(piece):
                    failures.append(f"{script_rel}: {hit} in page script: {snippet(piece)!r}")

    css = ROOT / "styles.css"
    if css.is_file():
        for piece in css_content_values(css.read_text(encoding="utf-8")):
            for hit in lint_piece(piece):
                failures.append(f"styles.css: {hit} in CSS content: {snippet(piece)!r}")
    return list(dict.fromkeys(failures))


def main():
    failures = collect_failures()
    if failures:
        for message in failures:
            print("FAIL:", message)
        raise SystemExit(1)
    print(
        f"OK: legal copy check passed on {len(pages())} pages "
        "(for life / lifetime, evening promises, banned marketing words, evidence/proof, provider blame, em/en dashes)"
    )


if __name__ == "__main__":
    main()
