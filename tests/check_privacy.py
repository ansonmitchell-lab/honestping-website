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
        if rel:
            html = ROOT / f"{rel}.html"
            index = ROOT / rel / "index.html"
            if html.is_file():
                self.path = f"/{rel}.html"
            elif index.is_file():
                self.path = f"/{rel}/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        return


def pages():
    found = sorted(ROOT.glob("*.html"))
    privacy_dir = ROOT / "privacy"
    if privacy_dir.is_dir():
        found.extend(sorted(privacy_dir.glob("*.html")))
    return found


def visible_text(html):
    text = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    text = re.sub(r"<script\b[^>]*>.*?</script>", "", text, flags=re.S | re.I)
    text = re.sub(r"<style\b[^>]*>.*?</style>", "", text, flags=re.S | re.I)
    return re.sub(r"<[^>]+>", " ", text)


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
            "Quebec",
            "[TODO ENGINEERING: the Windows region setting is country-level, so confirm how Canada is detected, or whether all of Canada gets this version and the page should say so.]",
        )
        for phrase in absent:
            check(phrase not in body, f"/privacy still contains: {phrase}")
        present = (
            "stored on your PC",
            "stores these only on your PC",
            "One thing is sent automatically, and you can turn it off: a lookup of your provider's name.",
            "In this version, crash reports are saved on your PC and aren't sent to us.",
            "The public version of the app doesn't send bug reports or feature requests to us.",
            "If you email us instead, your message stays in our email (Google) until we no longer need it, and we'll delete it if you ask.",
            "In the EEA, the UK, Switzerland and Canada, or if your region is unknown, it runs only if you allow it.",
            "Provider name lookup",
            "Show my provider's name",
            "We don't receive it.",
            "LAN compare is off until you turn it on.",
            "on your home network",
            "Public version: not sent to us",
            "<td>Feedback service</td>",
            "<td>12 months</td>",
            "Last updated:",
            "October 10, 2026",
            "bug reports you've written but haven't sent yet",
            "an app log, which stays on your PC unless you choose to attach recent lines to a bug report or feature request",
            "Cloudflare (website hosting, security, and our feedback service's servers and storage)",
            "Cloudflare, which hosts our website, processes standard connection data such as your IP address and browser type to deliver the site and protect it from attacks.",
            "We don't use this data to identify visitors.",
            "We use your email only to tell you when HonestPing is available.",
            "We don't send marketing email unless you ask for it.",
            "The form opens your email app and sends to",
            "Our email is hosted by Google.",
            "This site doesn't use cookies.",
            "When you press",
            "Check for updates",
            "Saved on your PC. Not sent to us",
            'href="/privacy/subprocessors"',
            'href="/privacy/history"',
            "Depending on where you live, you may have the right to access, correct, delete, or get a copy of your personal information",
            "We don't sell personal information or use it for targeted advertising.",
        )
        for phrase in present:
            check(phrase in body, f"/privacy is missing canonical text: {phrase}")
        privacy_emails = emails_in(body)
        check(privacy_emails == {"hello@honestping.com"}, f"/privacy emails: {sorted(privacy_emails)}")
        check(body.lower().count("hello@honestping.com") >= 4, "expected hello@honestping.com on each contact line")
        check("1500 N Grant" not in body, "/privacy includes the street address")
        check("GitHub" not in body, "/privacy names GitHub")
        check("Site analytics" not in body, "/privacy still contains the analytics paragraph")
        check("An AI service" not in body, "/privacy still describes an AI service")
        check("90 days" not in body, "/privacy still states a 90-day retention period")
        check("Two things are sent automatically" not in body, "/privacy still says two things are sent automatically")
        check(
            "bug reports you've written but haven't sent yet, which you can delete" not in body,
            "/privacy still has the old unsent bug report list item",
        )
        check("personal details masked" not in body, "/privacy still says personal details are masked")
        check(
            "In this version, this website does not receive bug reports or feature requests." not in body,
            "old bug-report sentence is still on /privacy",
        )
        preview = re.sub(r"\s+", " ", visible_text(body)).strip()
        preview_paragraph = (
            "Preview features. If you turn on preview features and send a bug report or feature request from the app, "
            "it goes to our feedback service, which runs on Cloudflare. It includes what you type, any screenshot you add, "
            "and only the details you tick: app version, Windows version, and the screen you were on. "
            "Recent log lines are attached only if you tick the box. We try to remove personal details from them, and you can preview them before sending. "
            "We don't check screenshots, and we can't catch everything you type, so please leave out passwords, account numbers, names, phone numbers and street addresses. "
            "We delete reports and screenshots after 12 months, or sooner if you ask at hello@honestping.com."
        )
        check(preview_paragraph in preview, "/privacy is missing the Preview features paragraph")

        updated_js = (ROOT / "privacy-updated.js").read_text(encoding="utf-8")
        date_match = re.search(r'HONESTPING_POLICY_UPDATED = "([^"]+)"', updated_js)
        policy_date = date_match.group(1) if date_match else ""
        check(policy_date == "October 10, 2026", f"policy date constant is {policy_date!r}")

        publication_paths = ("/privacy", "/privacy/subprocessors", "/privacy/history")
        for path in publication_paths:
            with urlopen(f"http://127.0.0.1:{port}{path}") as response:
                page_body = response.read().decode("utf-8")
                page_status = response.status
            check(page_status == 200, f"{path} status {page_status}, expected 200")
            shown = visible_text(page_body)
            check("[" not in shown, f"{path} has a visible bracket placeholder")
            check("TODO" not in shown, f"{path} has a visible TODO")
            if path != "/privacy/subprocessors":
                check(policy_date in shown, f"{path} does not show the policy date {policy_date}")
            check(CREDIT in page_body, f"{path} footer credit line does not match")
            check(PRIVACY_HREF in page_body, f"{path} footer is missing the Privacy link")

        with urlopen(f"http://127.0.0.1:{port}/privacy/subprocessors") as response:
            sub_body = response.read().decode("utf-8")
        check("Cloudflare (website hosting, security, and our feedback service's servers and storage)" in sub_body, "subprocessors page is missing Cloudflare")
        check("Google (email)" in sub_body, "subprocessors page is missing Google")
        check("GitHub" not in sub_body, "subprocessors page names GitHub")
        check(
            "We'll add our AI service here before any reports are shared with it." not in sub_body,
            "subprocessors page still has the AI service line",
        )
        check("An AI service" not in sub_body, "subprocessors page still describes an AI service")
        with urlopen(f"http://127.0.0.1:{port}/privacy/history") as response:
            history_body = response.read().decode("utf-8")
        check("First published." in history_body, "history page is missing the first published entry")

        html_pages = pages()
        check(html_pages, "no HTML pages found")
        for page in html_pages:
            text = page.read_text(encoding="utf-8")
            check(PRIVACY_HREF in text, f"{page.name} footer is missing a link to /privacy")
            check(CREDIT in text, f"{page.name} footer credit line does not match")
            extra = emails_in(text) - ALLOWED_EMAILS
            check(not extra, f"{page.name} has unexpected email addresses: {sorted(extra)}")
            if page.name == "privacy.html" or (page.parent.name == "privacy" and page.name == "index.html"):
                check("Created by" not in text, "privacy page meta description includes a Created by phrase")

        index = (ROOT / "index.html").read_text(encoding="utf-8")
        check("you@example.com" in index, "waitlist placeholder you@example.com was removed")
        about = (ROOT / "about.html").read_text(encoding="utf-8")
        check('id="creators"' in about, "about.html is missing the creators section from main")

        planned = (ROOT / "docs" / "privacy-planned.md").read_text(encoding="utf-8")
        check("Cloudflare Web Analytics" in planned, "planned doc is missing the analytics text")
        check(
            "This ships with enabling auto-send as a policy update with an in-app notice" in planned,
            "planned doc is missing the auto-send heading",
        )
        check("The AI service can't use reports to train its models and keeps them for no more than 30 days." in planned, "planned doc is missing the AI retention line")
        check("We'll add our AI service here before any reports are shared with it." in planned, "planned doc is missing the subprocessors AI line")
        check("Raw reports are deleted within 90 days." in planned, "planned doc is missing the 90-day crash deletion line")
        check(
            'We keep short crash "signatures" (the error type, where it happened in our code, the app version, and a count of how many installs hit it) for up to 24 months, but only if they contain no file paths, usernames, computer names or IP addresses. Otherwise we delete them within 90 days.' in planned,
            "planned doc is missing the crash signatures sentence",
        )
        check(
            "Before enabling: the scrubber removes file names under user folders, not just the username segment." in planned,
            "planned doc is missing the auto-send scrubber gate",
        )
        check("We keep reports for 12 months." not in planned, "planned doc still keeps crash or bug reports for 12 months")
        check("We don't store it." in planned, "planned doc is missing the IP not stored line")
        check("If a report can't be sent, HonestPing tries once more the next time it starts, then deletes it." in planned, "planned doc is missing the retry line")
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
