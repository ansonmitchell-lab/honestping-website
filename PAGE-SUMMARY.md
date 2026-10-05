# HonestPing landing page: summary

Static site for Cloudflare Pages. Upload this folder as-is (no build step). Copy rule: no em dashes anywhere in site copy.

## Visual system

Mirrors the HonestPing Windows app **navy Neon** theme from `theme-tokens.json`:

- Surfaces: `bg #07131f`, `surface #0d1e2e`, `subtle #122a3a`, `line #203c4e`
- Text: `#edf5fa` / muted `#abc0ce`
- Brand ring: green `#00e6a6` → cyan `#05d1e8` (hero live dial matches app `.hp-dial-rim`)
- Status chips: healthy green, warn amber, bad red, same roles as Overview
- Typography: Segoe UI Variable / Segoe UI stack; 12px card radius; app-like primary buttons

## Sections


1. **Header**: App-style brand lockup (icon + name + tagline subtitle), nav (For gamers, For work, In-Home Streaming, What you get, The gap, Preview, About Us), waitlist CTA  
2. **Hero**: Tagline exactly *Network health, explained*; value prop; live Overview dial (SVG + CSS + `gauge.js`) matching app `.hp-dial-rim` / `.hp-dial-face` / `.hp-dial-value`, ping ticks 22 to 36 ms around 28 ms, jitter and packet loss beside it; reduced motion freezes at 28 ms; single Join the waitlist CTA (no creator credit in the hero)  
3. **ISP accountability** (`#isp`): Featured gradient-ringed band directly under the hero. Lead message: are you getting the speed you pay for? Four-step flow (enter advertised download speed · realistic speed tests over time · compare to the promise · clear verdict: getting what you pay for or getting ripped off) beside an example verdict card (500 Mbps advertised vs 212 Mbps measured, 42%). ISP detection shown as a supporting line. Waitlist CTA.
4. **For gamers** (`#gamers`, live): Featured band after ISP, before value. Message: network health you can see while you play. Free: quality word (Healthy / Degraded) in the ring center. Pro: live ping number in the ring plus jitter and packet-loss tracking. Abstract trademark-safe visuals only (dial mocks, geometric HUD, controller silhouette; no game/platform brand marks). Header nav link "For gamers". Marked with HTML draft comment and `data-draft="gamers"`; small muted Preview chip. Approved and published.
5. **For work / WFH** (`#wfh`, live): Featured band after gamers, before value. Hook: tired of wondering whether it’s your internet when a video call isn’t working. Features named only as they exist: live connection-quality ring, jitter and packet-loss tracking, “Is it just me?” check, Trace, Wi-Fi details, History & evidence. Abstract trademark-safe visuals (unlabeled call tiles, waveform, path hops; no meeting-app brand marks). Header nav link "For work". Approved and published.
6. **In-Home Streaming** (`#streaming`, live): Featured band after WFH, before value. Hook: know whether a glitch is your internet or your favorite streaming service (no named services). Features: “Is it just me?” check, streaming-service status icons, live connection-quality ring, packet loss, speed test, Wi-Fi details. Abstract icons only. Nav: In-Home Streaming. Approved and published.
7. **What it does for you**: Four concrete client-value cards: bars lie / evidence / history / next steps  
8. **The gap on the market**: Contrast: radio bars · vanity speed tests · opaque enterprise monitors · **HonestPing**  
9. **Day to day**: Three practical moments (calls, reboot triage, ISP tickets)  
10. **Inside the app**: `overview-navy` preview in window chrome  
11. **Waitlist**: mailto `hello@honestping.com?subject=HonestPing%20waitlist` (+ email field via JS)  
12. **Footer**: © Anson Mitchell and Matt Lewis (equal plain text) · About Us · www.honestping.com · privacy-light waitlist note  

## About Us (`about.html`)

Same header/nav/footer chrome. Product blurb (*Network health, explained*), then two identical co-creator cards (initials badge, name, "Co-creator" role): **Anson Mitchell** and **Matt Lewis**. No personal links for either creator. Waitlist CTA links back to `index.html#waitlist`.

## Credits

Co-created by Anson Mitchell and Matt Lewis, always with equal prominence. On the homepage, credit appears only in the footer (plain, muted text). The site contains no links or references to any personal domain.

## Primary CTA

**Join the waitlist** → `mailto:hello@honestping.com` (no public download yet).

## Assets

Under `assets/`: logo (png/webp), icon-display, app-preview (png/webp), favicons, og-image.

Only the current product name HonestPing appears in user-facing copy.

## Shipped 2026-10-05 (hero + gamers emotional)

- Hero H1: You’re not crazy. It might be your connection. Brand kicker: HonestPing. Tagline unchanged.
- Hero dial: simulated Live demo · Example reading; loss mostly 0% with 0.1–0.6% blips; jitter ~1–6 ms; prefers-reduced-motion kept; no third-party target names (Internet target · ICMP).
- #gamers H2: Your ping is the difference between life and death. Plan tags: Free plan / Pro plan (not status-style Free pills).
- Company rule: no third-party service/game brand names or logos on site.
