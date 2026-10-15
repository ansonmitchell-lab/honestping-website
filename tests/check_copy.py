#!/usr/bin/env python3
"""Fail if shipped visible copy breaks HonestPing wording rules.

Scans HTML pages and the scripts those pages load. Visible copy means text
nodes, titles, meta descriptions, aria-labels, alt text, placeholders, title
tooltips, CSS content strings, and string literals in page scripts.

Does not scan CSS class names, file names, PAGE-SUMMARY.md, or docs/.
Legal privacy pages are scanned with the same rules. A UTC offset minus
(UTC-6 or UTC−6) is not sentence punctuation.

Also fails on the whole phrases "for life" and "lifetime" (any capitalization).
"Life" by itself is allowed. Legal's approved Founding Member line is allowed:
"$39 a year, locked for as long as your Founding Member plan stays active".
"""

import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DASH_NAMES = {
    "\u2013": "en dash",
    "\u2014": "em dash",
    "\u2015": "horizontal bar",
}
BANNED_WORDS = ("verified", "certified", "official", "ripped off")
BLAME_PHRASES = (
    "whose fault",
    "provider's fault",
    "provider is at fault",
    "blame the provider",
    "blame your provider",
    "your provider is lying",
    "the provider is lying",
    "problem is on your network",
    "when it is the network",
    "honestping verified",
)
ISP_VERIFY = re.compile(r"\bverif(?:y|ied|ies|ication|ications)\b", re.I)
SPACED_HYPHEN = re.compile(r"\s-\s")
WORD_PATTERNS = tuple(re.compile(r"\b" + re.escape(word) + r"\b", re.I) for word in BANNED_WORDS)
# Whole phrases only. "Life" alone, "for a year", and "lifelong" stay allowed.
LIFE_PHRASES = ("for life", "lifetime")
LIFE_PATTERNS = tuple(re.compile(r"\b" + re.escape(phrase) + r"\b", re.I) for phrase in LIFE_PHRASES)


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
    found = sorted(p for p in ROOT.glob("*.html"))
    privacy = ROOT / "privacy"
    if privacy.is_dir():
        found.extend(sorted(privacy.glob("*.html")))
    reports = ROOT / "r"
    if reports.is_dir():
        found.extend(sorted(reports.rglob("*.html")))
    return found


def is_isp_page(path, html):
    if path.name == "isp.html":
        return True
    title = re.search(r"<title>(.*?)</title>", html, flags=re.I | re.S)
    return bool(title and "for isps" in re.sub(r"\s+", " ", title.group(1)).lower())


def referenced_scripts(page, html):
    found = []
    for src in re.findall(r"<script\b[^>]*\bsrc=[\"']([^\"']+)[\"']", html, flags=re.I):
        clean = src.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith(("http://", "https://", "//")):
            continue
        for candidate in ((page.parent / clean).resolve(), (ROOT / clean.lstrip("/")).resolve()):
            if candidate.is_file() and ROOT in candidate.parents:
                found.append(candidate)
                break
    return found


def js_strings(source):
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


def lint_piece(text, isp):
    hits = []
    for mark, name in DASH_NAMES.items():
        if mark in text:
            hits.append(name)
    if SPACED_HYPHEN.search(text):
        hits.append("spaced hyphen")
    lowered = text.lower()
    for word, pattern in zip(BANNED_WORDS, WORD_PATTERNS):
        if pattern.search(text):
            hits.append(f"banned word {word}")
    for phrase, pattern in zip(LIFE_PHRASES, LIFE_PATTERNS):
        if pattern.search(text):
            hits.append(f"banned phrase {phrase}")
    for phrase in BLAME_PHRASES:
        if phrase in lowered:
            hits.append(f"provider blame ({phrase})")
    if isp and ISP_VERIFY.search(text):
        hits.append("verify language on a For ISPs page")
    return hits


def snippet(text):
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) > 140:
        return compact[:137] + "..."
    return compact


def self_test():
    expect = (
        ("Hello — world", False, True),
        ("Hello – world", False, True),
        ("From 1 - 5 days", False, True),
        ("7-day report", False, False),
        ("Wi-Fi and a fixed-wireless plan", False, False),
        ("All times Mountain Time (UTC−6).", False, False),
        ("All times Mountain Time (UTC-6).", False, False),
        ("Missing value: n/a", False, False),
        ("60 to 79%", False, False),
        ("This result is verified.", False, True),
        ("Certified partner", False, True),
        ("the official app", False, True),
        ("You got ripped off", False, True),
        ("Whose fault is the glitch?", False, True),
        ("If the problem is on your network, the app says so.", False, True),
        ("Shorter, calmer calls when it is the network.", False, True),
        ("Shorter, calmer calls when the path points past the home.", False, False),
        ("HonestPing badge", True, False),
        ("Please verify this badge.", True, True),
        ("Please verify this badge.", False, False),
        ("Your provider decides.", False, False),
        ("The app says where the measurements point, including past the home.", False, False),
        ("locked for life", False, True),
        ("lifetime price", False, True),
        ("FOR LIFE", False, True),
        ("$39 a year, locked for as long as your Founding Member plan stays active", False, False),
        ("for a year", False, False),
        ("Life is short", False, False),
        ("lifelong plan", False, False),
        ("for lifestyle", False, False),
    )
    problems = []
    for text, isp, bad in expect:
        hits = lint_piece(text, isp)
        if bad and not hits:
            problems.append(f"missed {text!r}")
        if not bad and hits:
            problems.append(f"false hit {hits} on {text!r}")
    decoded = js_strings('side.textContent = "The problem is on your coworker\\u2019s side."')
    if decoded != ["The problem is on your coworker\u2019s side."]:
        problems.append(f"js string decode failed: {decoded!r}")
    if lint_piece(decoded[0], False):
        problems.append("curly apostrophe was treated as a dash")
    return problems


def collect_failures():
    problems = self_test()
    if problems:
        return ["copy checker self-test failed: " + "; ".join(problems)]

    failures = []
    seen = set()
    for page in pages():
        html = page.read_text(encoding="utf-8")
        parser = PageText()
        parser.feed(html)
        isp = is_isp_page(page, html)
        rel = page.relative_to(ROOT).as_posix()
        for piece in parser.parts:
            for hit in lint_piece(piece, isp):
                failures.append(f"{rel}: {hit} in visible copy: {snippet(piece)!r}")
        for piece in js_strings("\n".join(parser.scripts)):
            for hit in lint_piece(piece, isp):
                failures.append(f"{rel}: {hit} in inline script: {snippet(piece)!r}")
        for script in referenced_scripts(page, html):
            key = (script, isp)
            if key in seen:
                continue
            seen.add(key)
            script_rel = script.relative_to(ROOT).as_posix()
            for piece in js_strings(script.read_text(encoding="utf-8")):
                for hit in lint_piece(piece, isp):
                    failures.append(f"{script_rel}: {hit} in page script: {snippet(piece)!r}")

    css = ROOT / "styles.css"
    if css.is_file():
        for match in re.finditer(r"content:\s*([\"'])(.*?)\1", css.read_text(encoding="utf-8"), flags=re.S):
            piece = match.group(2)
            for hit in lint_piece(piece, False):
                failures.append(f"styles.css: {hit} in CSS content: {snippet(piece)!r}")
    return list(dict.fromkeys(failures))


def main():
    failures = collect_failures()
    if failures:
        for message in failures:
            print("FAIL:", message)
        raise SystemExit(1)
    print(
        f"OK: visible copy on {len(pages())} pages has no em dashes, en dashes, "
        "spaced hyphens, banned words, or for life / lifetime"
    )


if __name__ == "__main__":
    main()
