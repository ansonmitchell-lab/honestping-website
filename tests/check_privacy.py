#!/usr/bin/env python3
"""Serve the static site the way Cloudflare Pages serves HTML, then check /privacy."""

import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
CREDIT = "© <span id=\"year\">2026</span> <span class=\"footer-creator\">Anson Mitchell</span> and <span class=\"footer-creator\">Matt Lewis</span>"
PRIVACY_HREF = 'href="/privacy"'
ALLOWED_EMAILS = {"hello@honestping.com", "you@example.com"}


class PagesHandler(SimpleHTTPRequestHandler):
    """Map /privacy to privacy.html, matching Cloudflare Pages HTML routing."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        rel = path.lstrip("/")
        if rel and not (ROOT / rel).exists():
            html = ROOT / f"{rel}.html"
            if html.is_file():
                self.path = f"/{rel}.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        return


def pages():
    return sorted(ROOT.glob("*.html"))


def emails_in(text):
    found = set(re.findall(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text))
    return found


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), PagesHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    failures = []

    def check(cond, message):
        if not cond:
            failures.append(message)

    try:
        with urlopen(f"http://127.0.0.1:{port}/privacy") as response:
            body = response.read().decode("utf-8")
            status = response.status
        check(status == 200, f"/privacy status {status}, expected 200")
        check("<h1" in body and "HonestPing Privacy Policy" in body, "/privacy is missing the policy heading")
        check(PRIVACY_HREF in body, "/privacy footer is missing the Privacy link")
        check(CREDIT in body, "/privacy footer credit line does not match")
        check("[PLANNED]" not in body, "/privacy still contains a [PLANNED] marker")
        check("Daily check-in" not in body, "/privacy still contains the planned check-in section")
        check("Area speed sharing" not in body, "/privacy still contains the planned area-sharing section")
        check("5. Microsoft Store" not in body, "/privacy still contains the planned Microsoft Store section")
        check("privacy.microsoft.com" not in body, "/privacy still contains the planned Microsoft Store section")
        absent = (
            "Revoke any share",
            "Ask me each time",
            "For ISPs",
            "Microsoft Store",
            "audit logs on our owner dashboard",
            "check-ins",
            "area sharing",
            "sharing with your provider",
            "sharing a report with your internet provider",
            "HonestPing Pro",
            "your Pro license",
            "Some purchase records must be kept",
            "merchant of record",
            "OPTIONAL MODE",
            "30 days if the log excerpt is kept",
            "Speed test, step 2",
            "stored on your computer",
            "Provider (ISP name) lookup",
            "the UK and Quebec",
            "the UK, and Quebec",
        )
        for phrase in absent:
            check(phrase not in body, f"/privacy still contains: {phrase}")
        present = (
            "stored on your PC",
            "stores these only on your PC",
            "Two things are sent automatically, and you can turn off both:",
            "In the EEA, the UK, Switzerland and Canada, or if your region is unknown, both happen only if you allow them.",
            "If HonestPing closes unexpectedly, it sends us a short report the next time it starts, so we can fix the problem. Personal and network details are removed first.",
            "What a crash report contains",
            "Never included:",
            "Raw reports are deleted within 90 days.",
            "Provider name lookup.",
            "Show my provider's name",
            "We don't receive it.",
            "LAN compare is off until you turn it on.",
            "on your home network",
            "We keep report text for 12 months and screenshots and diagnostics for 90 days.",
            "Crash reports are off. Any report waiting to be sent was deleted.",
            "An AI service helps us sort reports. It works only for us and can't train on them.",
            "Nothing is sent until you press Submit.",
            "You can change this anytime in Settings",
            "Crash reports and provider name lookup happen only if you allow them.",
            "[DATE OF PUBLICATION]",
            "[MAILING ADDRESS]",
            "[TODO ATTORNEY: confirm regions and UK approach.]",
            "[TODO: zero retention / no more than 30 days]",
            "[TODO: subprocessor list, honestping.com/privacy/subprocessors]",
            "[ENGINEERING: confirm when an unsent report is deleted.]",
        )
        for phrase in present:
            check(phrase in body, f"/privacy is missing canonical text: {phrase}")
        privacy_emails = emails_in(body)
        check(privacy_emails == {"hello@honestping.com"}, f"/privacy emails: {sorted(privacy_emails)}")
        check(body.lower().count("hello@honestping.com") >= 4, "expected hello@honestping.com on each contact line")

        html_pages = pages()
        check(html_pages, "no HTML pages found")
        for page in html_pages:
            text = page.read_text(encoding="utf-8")
            check(PRIVACY_HREF in text, f"{page.name} footer is missing a link to /privacy")
            check(CREDIT in text, f"{page.name} footer credit line does not match")
            extra = emails_in(text) - ALLOWED_EMAILS
            check(not extra, f"{page.name} has unexpected email addresses: {sorted(extra)}")
            if page.name == "privacy.html":
                check("Created by" not in text, "privacy.html meta description includes a Created by phrase")

        index = (ROOT / "index.html").read_text(encoding="utf-8")
        check("you@example.com" in index, "waitlist placeholder you@example.com was removed")
        about = (ROOT / "about.html").read_text(encoding="utf-8")
        check('id="creators"' in about, "about.html is missing the creators section from main")

        planned = (ROOT / "docs" / "privacy-planned.md").read_text(encoding="utf-8")
        for heading in (
            "3.5 Sharing a report with your internet provider",
            "3.6 Daily check-in",
            "3.7 Area speed sharing",
            "Revoke any share",
            "Ask me each time",
            "For ISPs",
            "Microsoft Store",
            "audit logs on our owner dashboard",
            "check-ins, area sharing, sharing with your provider",
            "4. Purchases (HonestPing Pro)",
            "your Pro license",
            "Some purchase records must be kept for tax law even after a deletion request.",
            "merchant of record",
        ):
            check(heading in planned, f"planned doc is missing {heading}")
    finally:
        server.shutdown()

    if failures:
        for message in failures:
            print("FAIL:", message)
        raise SystemExit(1)
    print(f"OK: /privacy served on 127.0.0.1:{port}, footer link present on {len(pages())} pages")


if __name__ == "__main__":
    main()
