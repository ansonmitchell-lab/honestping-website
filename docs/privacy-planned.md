# Planned privacy policy text

Not published. These sections and sentences are marked planned in the privacy draft. They are left out of `/privacy` until those features ship. The wording below is the draft text, unchanged.

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
