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
2. **Hero**: Tagline exactly *Network health, explained*; H1 “You’re not crazy. It might be your connection.”; gaming hook link and For gamers button to `#gamers`; live Overview dial (SVG + CSS + `gauge.js`) matching app `.hp-dial-rim` / `.hp-dial-face` / `.hp-dial-value`, ping ticks 22 to 36 ms around 28 ms, jitter and packet loss beside it; reduced motion freezes at 28 ms; Join the waitlist CTA (no creator credit in the hero)  
3. **For gamers** (`#gamers`): After the free-to-start band. H2: a gamer test for how the connection feels in play. Grades ping, jitter, and packet loss. Example tier marks (Esports Ready, Silver, Bronze, Steel), labeled example data. Free includes 3 gamer tests. Unlimited 7-day reports in Pro cover regular and gaming reports. One line: Pro Gaming (coming soon). Sample dials kept. No HUD and no game brand marks.
4. **ISP accountability** (`#isp`): Featured gradient-ringed band. Lead message: are you getting the speed you pay for? Four-step flow (enter plan speed, 21 short tests morning to evening, compare to the plan, 7-day report). Example report uses a 100 Mbps plan, 78% typical, 21 tests, labeled example data, with a day-by-day strip. Share report stays. PDF is coming soon. Good-news line: "You got what you pay for!" Try a sample week runs in the browser (plan, bill, and home use). The 7-day report is in Pro, not included with Free.
5. **For work / WFH** (`#wfh`, live): Featured band after ISP, before streaming. Hook: tired of wondering whether it’s your internet when a video call isn’t working. Features named only as they exist: live connection-quality ring, jitter and packet-loss tracking, “Is it just me?” check, Trace, Wi-Fi details, History & evidence. Trace demo (`trace-demo.js`): hops appear one at a time (You, Router, ISP, Hop 4, Hop 5, Destination), latency tones, “Trace finished”, then loop; reduced motion shows the finished path. Caption: “Example Trace · Abstract path only”. No meeting-app brand marks. Header nav link "For work". Approved and published.
6. **In-Home Streaming** (`#streaming`, live): Featured band after WFH, before value. Hook: know whether a glitch is your internet or your favorite streaming service (no named services). Features: “Is it just me?” check, streaming-service status icons (play, pause, fast forward, stop), live connection-quality ring, packet loss, speed test, Wi-Fi details. Abstract icons only. Nav: In-Home Streaming. Approved and published.
7. **What it does for you**: Four concrete client-value cards: bars lie / evidence / history / next steps  
8. **The gap on the market**: Contrast: radio bars · vanity speed tests · opaque enterprise monitors · **HonestPing**  
9. **Day to day**: Three practical moments (calls, reboot triage, ISP tickets)  
10. **Inside the app**: `overview-navy` preview in window chrome  
11. **Closing line** (`#punch`): Just above the waitlist. Exact line: “One disputed internet bill can pay for your entire app.” Link to `#isp`. No dollar amounts or prices.
12. **Waitlist**: mailto `hello@honestping.com?subject=HonestPing%20waitlist` (+ email field via JS)  
13. **Footer**: `© <span id="year">2026</span> Honest Ping LLC` · About Us · www.honestping.com · privacy-light waitlist note  

## About Us (`about.html`)

Same header/nav/footer chrome. Product blurb (*Network health, explained*). The About page has no creators section. Waitlist CTA links back to `index.html#waitlist`.

## For ISPs FAQ

The answer reads: HonestPing is made by Honest Ping LLC.

## Primary CTA

**Join the waitlist** → `mailto:hello@honestping.com` (no public download yet).

## Assets

Under `assets/`: logo (png/webp), icon-display, app-preview (png/webp), favicons, og-image.

Only the current product name HonestPing appears in user-facing copy.

## Shipped 2026-10-05 (hero + gamers emotional)

- Hero H1: You’re not crazy. It might be your connection. Brand kicker: HonestPing. Tagline unchanged.
- Hero dial: simulated Live demo · Example reading; loss mostly 0% with 0.1 to 0.6% blips; jitter about 1 to 6 ms; prefers-reduced-motion kept; no third-party target names (Internet target · ICMP).
- #gamers H2: Your ping is the difference between life and death. Plan tags: Free plan / Pro plan (not status-style Free pills).
- Company rule: no third-party service/game brand names or logos on site.

## Shipped 2026-10-05 (gaming centerpiece)

- #gamers moved directly under hero; H2 “Your ping is the difference between life and death” is the visual centerpiece; hero keeps “You’re not crazy…” plus a gaming hook link.
- Removed “Word in the center” note; Free dial note is “Status in the ring”; caption “Sample comparison · Example UI”.
- Gamers HUD: animated controller buttons, key lights, ping dots, HUD sweep; prefers-reduced-motion respected.

## Shipped 2026-10-05 (Trace demo + closing line)

- `#wfh` Trace hops animate one at a time via `trace-demo.js` (defer). Caption “Example Trace · Abstract path only”. Reduced motion shows the finished path. No real hostnames or brands.
- Closing band `#punch` just above `#waitlist`: “One disputed internet bill can pay for your entire app.” Links to `#isp`. No prices.

## Shipped 2026-10-06 (ISP evidence report)

- `#isp` layout: row 1 steps | verdict card; row 2 "Solid proof to bring to your ISP" copy (intro, 3-item checklist, waitlist CTA) | example report card. Mobile stacks steps, verdict, proof copy, report, CTA. Example rows reveal, then "Export report" glows. Reduced motion keeps every row visible.
- Verdict bar fill is `position: absolute` so the 42% bar renders. The counted 212 uses the headline size.
- `#streaming` status tiles use play, pause, fast forward, and stop icons. No service names.

## Shipped 2026-10-11 (preview: free start, 7-day report, gamer tiers)

- `#free`: Quick Check is unlimited and results stay on the PC. Free also includes 5 Pro speed tests and 3 gamer tests. Quiet line: Unlimited with Pro. No price and no trial.
- `#gamers`: gamer test grades ping, jitter, and packet loss. Example tier marks: Esports Ready, Silver, Bronze, Steel. Esports Ready uses crest B. A short How hops work note sits with the hop loop. Pro Gaming is one coming-soon line. No HUD.
- `#isp`: tightened copy. 21-test example week, day strip, good-news line. Try a sample week replaces the separate savings estimator. PDF coming soon. Share report kept. The example verdict card and the standalone $20/$240 block are gone. The $20 list-price note stays once, inside the sample-week plan-fit tile.
- `#user-types`: short guide for everyday use, work calls, streaming, and play.
- Asset query `v=20261011h`. Single dark theme. The sample week and the static example report use the dark 7-day Pro report panel. Speed shortfall and plan fit are separate results.
- Mascot (dark poses only): hero side leap at 520px, one 2.0s hop on first view, then still. Home still accents: side sit with How hops work (180px), Breakaway in the speed header, ears up beside work-from-home (160px), look back on the history card (150px), three quarter beside who it's for (200px tall, hidden under 720px). About: front calm at 160px, three quarter to front turn once. Crest B stays on Esports Ready and loops only while it is the one mascot on screen. The sample week tool has no mascot, because the money tiles share that panel. One mascot animates at a time. Reduced motion stays on the still frame.
- Watch an example week: muted playsinline mp4, gif fallback, play/pause button, no autoplay when reduced motion is set. Example data.
- Gamer tiers: Esports Ready uses crest B (still frame under reduced motion). Silver, bronze, and steel badges stay. The speed header uses the Breakaway hex trail. How hops work uses the hop loop. One loop plays at a time, for two cycles, then rests. A hover or focus replays it once.
- Try a sample week: plan speed, monthly bill, and how the home uses the internet. A simulated 21-test week stays in the browser. The speed line uses bill times (1 minus typical divided by plan), and only when typical speed is under 90% of plan. Plan fit is a separate line.
- User types: light user, streamer, gamer, remote worker, heavy downloader or creator, big household.
