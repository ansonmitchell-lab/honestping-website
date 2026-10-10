# Planned privacy policy text

Not published. These sections and sentences are marked planned in the privacy draft. They are left out of `/privacy` until those features ship. The wording below is the draft text, unchanged.

## This ships with enabling auto-send as a policy update with an in-app notice

Not on the live page. In this version, crash reports are saved on the PC and are not sent.

**Before enabling**

Before enabling: the scrubber removes file names under user folders, not just the username segment.

**What happens.** If HonestPing closes unexpectedly, it sends us a short report the next time it starts, so we can fix the problem. Personal and network details are removed first. If sending fails, it tries once more on the next launch. Then the file is deleted either way.

**Your choice.** Crash reports are controlled by **Settings → Privacy → Send crash reports automatically**. You can change this anytime in Settings → Privacy.

- **US and most other regions:** on by default. You can turn it off at any time. When you do, HonestPing shows "Crash reports are off. Any report waiting to be sent was deleted." and nothing is sent after that.
- **The EEA, the UK, Switzerland and Canada, or if your region is unknown:** Crash reports and provider name lookup happen only if you allow them. In these regions they stay off until you turn them on in Settings. HonestPing decides this on your PC from your Windows region setting. It doesn't look up your location.

Two things are sent automatically, and you can turn off both: crash reports and provider name lookup.

**What a crash report contains**

- HonestPing version and Windows version
- The error, and where in HonestPing's code it happened
- Which screen was open, for example "Speed test"
- A few lines of HonestPing's own log, with personal and network details removed

**Never included:** your files, history, test results, settings, Wi-Fi names, IP addresses, device names, Windows username or provider name.

Your IP address reaches our server like any connection. We don't store it.

Raw reports are deleted within 90 days.

**How details are removed.** Before the report leaves your PC, HonestPing removes the following, and our server checks again and removes anything left: your Windows username and folder paths, your computer's name, IP addresses (public, private, router, DNS server, and route hops), MAC addresses, Wi-Fi network names and router IDs, your internet provider's name, hostnames and custom monitor targets, names of devices on your network, email addresses, share codes and license keys, and your test results. Crash reports never include your files, history, settings values, or anything from other apps.

**Your IP address.** Your IP address reaches our server like any connection. We don't store it. It's used only in passing to deliver the report and to block abuse through our host's automatic rate limits.

**How we use crash reports.** Only to find and fix bugs, group similar crashes, and check whether a new version is more stable. An AI service helps us sort reports. It works only for us and can't train on them. Reports aren't used for decisions about you. The AI service can't use reports to train its models and keeps them for no more than 30 days. People at HonestPing review its suggestions.

**How long we keep them.** Raw reports are deleted within 90 days. We keep short crash "signatures" (the error type, where it happened in our code, the app version, and a count of how many installs hit it) for up to 24 months, but only if they contain no file paths, usernames, computer names or IP addresses. Otherwise we delete them within 90 days. They contain no log text or messages.

If a report can't be sent, HonestPing tries once more the next time it starts, then deletes it. Turning crash reports off deletes any report waiting to be sent.

A local crash file is deleted after it's sent, after one failed retry, or when you turn crash reports off.

Subprocessors line, not on the live subprocessors page until auto-send is enabled: We'll add our AI service here before any reports are shared with it.

Service-provider line parked with that update: an AI service provider listed on our subprocessors page (crash and bug analysis).

## 3.5 Sharing a report with your internet provider [PLANNED – remove until shipped]

You can choose to share a report with your internet provider. Nothing is shared unless you press **Share** on a screen that shows exactly what your provider will see.

**Your provider sees:** the report you picked (test times and results, outages and where on the path they happened, your plan speeds if you entered them, and whether each test counted). They also see a short connection summary: wired or Wi-Fi, the Wi-Fi band (2.4, 5 or 6 GHz), whether your router answered, and whether a VPN was on. If you include a trace, they see the part of the path that's on their own network.

**Your provider never sees:** your router or anything inside your home (we always remove your router and every step before it), your device list (the device scan never leaves your PC), your Wi-Fi name, your IP addresses, your PC's name, or your other history.

**Who else sees it:** no other provider, and not the public. On our owner dashboard we see only counts, like "3 traces shared this week," never addresses. We use your IP address only to confirm which provider the report belongs to, then drop it.

**Your control:** shares expire after [7] days (you can pick up to 30). You can revoke a share at any time and see each time it was opened. Sharing with your provider is your direction to disclose, not a sale. Your provider is responsible for how it handles your report once it receives it, under our ISP Data Terms and its own privacy policy.

## 3.6 Daily check-in [PLANNED – remove until shipped]

If you say **yes** when HonestPing asks (the question is never preselected), the app sends a small check-in once a day: a random install ID, the app version, Windows version, Free or Pro, and counts of which features you used (for example, "speed test: 3"). It never includes your name, email, license, IP address, Wi-Fi names, devices, test results, or files. The install ID isn't linked to your email, purchase, license, waitlist signup or bug reports. Our server works out your approximate region (country and state) once from the connection, then discards the IP address without storing it. You can see the last 7 check-ins word for word, turn this off, or delete your check-in data in **Settings → Privacy**. Per-install records are kept [13] months, then only totals remain.

## 3.7 Area speed sharing [PLANNED – remove until shipped]

A separate, optional switch, off unless you turn it on. When on, HonestPing sends summarized test results (speeds, pings, outages, connection type, local hour) with a rotating random token. It never includes your IP address, location, Wi-Fi name, devices, or hop addresses. Your approximate area is worked out from the connection, and the IP address is discarded. Results are combined into area totals that are shown, including to internet providers, **only when at least [10] different households contributed** [ATTORNEY: final threshold], so no household can be picked out. Raw contributions are deleted after 90 days. Area totals are kept up to 25 months. Turning it off stops sending right away, and **Delete what I've contributed** removes what's still tied to your current token. [IF AREA TRENDS ARE SOLD OR LICENSED: say so here plainly, for example: "We may license area totals to internet providers. These totals can't identify any household."]

## 5. Microsoft Store [PLANNED – if listed]

If you get HonestPing from the Microsoft Store, Microsoft handles your Store account, download and any Store purchase under the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement). Microsoft may share sales and diagnostic information with us as the publisher, under its terms [CONFIRM what Partner Center provides]. Everything else in this policy applies the same way to the Store version.

## Inline phrases removed from otherwise current sections

Bug reports, original sentence:

> You can delete a report you sent from **Help → Your reports** [PLANNED] or by emailing us.

The live page keeps only: "You can delete a report you sent by emailing us."

Who we share information with, original bullet:

> **with your internet provider, only when you share a report** with it [PLANNED].

Grouped and de-identified data, original example:

> (for example, "crash-free rate for version 1.9" or [PLANNED] area totals)

The live page keeps: (for example, "crash-free rate for version 1.9")

Your choices, original settings sentence:

> **In the app:** turn off crash reports, provider lookup, LAN compare [and, when available, check-ins and area sharing] in **Settings → Privacy**. Revoke any share. Delete local data by removing `%LOCALAPPDATA%\PingTray`.

The live page leaves out the bracketed check-in and area-sharing clause.

Retention table rows left out:

| Information | How long |
|---|---|
| [PLANNED] Check-ins | Per-install records [13] months, then totals only |
| [PLANNED] Area contributions | Raw data 90 days. Area totals up to 25 months |
| [PLANNED] Shared reports | Until the share expires or you revoke it, then deleted within 24 hours. Open-log 12 months |

## Sentences taken off the live page

These were on `/privacy` and are parked until the feature ships. The live page no longer includes them.

Short version, parked phrase:

> sharing a report with your internet provider

The live page says: "Everything else is sent only when you choose: joining the waitlist."

Your choices, parked sentence:

> Revoke any share.

Legal bases, parked flows:

> check-ins, area sharing, sharing with your provider

Legal basis parked with purchases:

> contract (your Pro license)

What this policy covers, parked clauses:

> and purchases of HonestPing Pro
> That includes the company that processes your payment (see §4) and the Microsoft Store (see §5).

Crash reports, parked until the three-way control exists:

> [OPTIONAL MODE:] You can also choose **Ask me each time**, which shows what would be sent and waits for you to press Send.

Contact, parked form clause:

> **Contact and ISP inquiries.** If you email us or use the "For ISPs" form, we get what you send: your name, company, work email, approximate subscriber count, and your message. We use it to reply and, for ISPs, to discuss a partnership.

Security, parked clause:

> and audit logs on our owner dashboard

Who we share information with, parked clause:

> and the merchant of record where it acts on our behalf

Deletion requests, parked sentence:

> Some purchase records must be kept for tax law even after a deletion request.

## Site analytics (not enabled)

Removed from the live page. Cloudflare Web Analytics is not turned on.

**Site analytics (no cookies).** [IF ENABLED:] We use Cloudflare Web Analytics to count page views and download clicks. Cloudflare says it doesn't use cookies or local storage and doesn't fingerprint visitors. We see totals only, like "120 visits to the home page this week," not individuals. [Currently not enabled. Remove this paragraph or keep "if enabled" until it's turned on.]

## 4. Purchases (HonestPing Pro)

Parked until checkout exists.

Pro is sold by our merchant of record, **[Lemon Squeezy (Sold through Link, LLC) / Stripe – DECISION]**. It is the seller on your receipt and processes your payment, billing address, tax and refunds under **its own privacy policy** [LINK]. We never see your full card number. From the merchant of record, we receive [your name, email, country, order ID, plan, price paid, tax collected, license key, and refund or chargeback status], which we use to deliver and support your license, handle refunds, and keep business and tax records. The license key and activation records are kept for the life of your license plus 12 months. Order records are kept for [7] years for tax and accounting reasons [ACCOUNTANT/ATTORNEY]. [If license activation contacts our server, describe what it sends here: license key, install ID?, app version, and the IP in transit, not stored.]

Retention rows parked with purchases:

| Information | How long |
|---|---|
| Purchase records | [7] years (tax and accounting). The merchant of record keeps its own records |
| License records | Life of the license plus 12 months |
