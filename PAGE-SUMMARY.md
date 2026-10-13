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
2. **Hero**: Tagline exactly *Network health, explained*; H1 “You’re not crazy. It might be your connection.”; For gamers button to `#gamers`; live Overview dial (SVG + CSS + `gauge.js`) matching app `.hp-dial-rim` / `.hp-dial-face` / `.hp-dial-value`, ping ticks 22 to 36 ms around 28 ms, jitter and packet loss beside it; reduced motion freezes at 28 ms; Join the waitlist CTA (no creator credit in the hero). The side-leap rabbit sits with the gauge, facing into the page.  
3. **For gamers** (`#gamers`): After the free-to-start band. H2: a gamer test for how the connection feels in play. Grades ping, jitter, and packet loss. Example tier marks (Esports Ready, Ranked Ready, Casual Ready, Laggy, Not Game Ready), labeled example data. Free includes 3 gamer tests. Unlimited 7-day reports in Pro cover regular and gaming reports. One line: Pro Gaming (coming soon). Sample dials kept. No HUD and no game brand marks.
4. **ISP accountability** (`#isp`): Featured gradient-ringed band. Lead message: are you getting the speed you pay for? Four-step flow (enter plan speed, 21 short tests morning to evening, compare to the plan, 7-day report). Example report uses a 100 Mbps plan, 78% typical, 21 tests, labeled example data, with a day-by-day strip. Share report stays. PDF is coming soon. Good-news line: "Your plan held up this week." Try a sample week runs in the browser (plan, bill, and home use). The 7-day report is in Pro, not included with Free.
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
- `#gamers`: gamer test grades ping, jitter, and packet loss. Example tier marks: Esports Ready, Ranked Ready, Casual Ready, Laggy, Not Game Ready. Esports Ready uses crest B. A short How hops work note sits with the hop loop. Pro Gaming is one coming-soon line. No HUD.
- `#isp`: tightened copy. 21-test example week, day strip, good-news line. Try a sample week replaces the separate savings estimator. PDF coming soon. Share report kept. The example verdict card and the standalone $20/$240 block are gone. The $20 list-price note stays once, inside the sample-week plan-fit tile.
- `#user-types`: short guide for everyday use, work calls, streaming, and play.
- Asset query `v=20261011o`. Single dark theme. The sample week and the static example report use the dark 7-day Pro report panel. Speed shortfall and plan fit are separate results.
- Mascot (dark poses only): the hero side leap stays still beside the gauge. The scroll companion has no rail. Scroll progress walks perches down the page, and the rabbit hops between the left and right gutters. When it lands, that section plays one short action (under 2.4s) and then holds the matching still. It faces the page at rest: left side looks right, right side looks left. After a pause it may hop to a nearby perch and back. At the 7-day heading it rolls once in a small pile of hex coins, then holds the front pose, clear of the sample week and money lines. Props are tiny hex cells (a controller, a headset, a plain screen) with no logos and no text. The work-from-home companion perch is the left gutter, with a headset. The heading accent there is a sleeping front pose with no headset. Crest B and the front pose stay unmirrored. Crest B snickers only while the companion is still and that crest is the section in view. About keeps the one-time turn and has no companion. Reduced motion hides the companion and leaves the still accents. On a phone it hops between the bottom corners, shows the section pose, skips props and the coin roll.
- Watch an example week: dark HTML player in the same family as the 7-day panel. Play, pause, 1x or 2x, scrub, replay. No autoplay when reduced motion is set. Example data. Pro pricing is not shown.
- Gamer tiers: Esports Ready uses crest B (still frame under reduced motion). The silver, bronze, and dark steel badge colors stay, with A, B, C, and D on the hex. The speed header uses the Breakaway hex trail. How hops work is the hopping rabbit on the four dots.
- Try a sample week: plan speed, monthly bill, and how the home uses the internet. A simulated 21-test week stays in the browser. The speed line uses bill times (1 minus typical divided by plan), and only when typical speed is under 90% of plan. Plan fit is a separate line.
- User types: light user, streamer, gamer, remote worker, heavy downloader or creator, big household.

## Shipped 2026-10-12 (preview: cleaner hero, free bar, hops, dark week, sleep)

- Hero: pills, H1, tagline, and lede stay. The green gamer-test link is gone. The side leap sits with the gauge and faces into the page.
- `#free`: a thin Free download bar, same width as the other panels. Button reads Download (coming soon) and links to the waitlist until `data-download-url` is set.
- How hops work: a small rabbit hops You, Router, ISP, Server, then sits. Two passes on scroll, one replay on hover or focus. The companion does not perch on those dots.
- Good 7-day line: "Your plan held up this week." and "Connections can change, so check in now and then."
- `#wfh` heading accent: sleeping rabbit, breathing, with rising Z marks. Hidden under 720px. The companion perches in the left gutter.
- Asset query `v=20261011p`.

## Shipped 2026-10-12 (preview: section accent motions)

- Each home section accent plays once when it is the mascot most in view, then holds its still. Hover or focus replays it. Reduced motion, a hidden tab, and an off-screen accent stay still. The scroll companion and the hop card count in the same controller and yield while an accent is moving.
- Quick Check hero: crouch, then a side leap toward the dial (2.2s). 7-day heading: ears-up listen (2.4s). Good-news card: a lap around the card that lands in a sit. Gamers accent: ready crouch, then crest B snickers once. Work from home: two breaths with Z marks, then a still. Streaming: a head bob toward the hex screen. History: a glance. Who it's for: a three-quarter turn toward the copy. Inside the app: a peek and a blink. Footer and For ISPs: a front blink and ear twitch. About keeps the existing turn.
- The below-plan line stays text inside the sample week. No rabbit sits on the money tiles, the sample week, pricing, or legal text.
- Added file: `assets/mascot/crouch-ready-dark.svg` (copied from the mascot pack). Motions are CSS and JS transforms. Asset query `v=20261011p`.

## Shipped 2026-10-12 (preview: zoomies lands in a snicker)

- The companion coin-roll tumble is off. `COIN_ROLL_ENABLED` is false, and the hex coins are not in the page. The tumble code stays in `scroll-pal.js`.
- The good-news card is the one zoomies moment: a lap of 2.2s around "Your plan held up this week.", then a front pose with a small grin squash. It plays once per view. Reduced motion shows the sit still beside the card. It stays off the money tiles and the sample week.
- Asset query `v=20261012b`. The lap stays in the card padding and ends on the right, in the snicker.

## Shipped 2026-10-12 (preview: one hop rabbit, companion idles, tier names)

- How hops work keeps one rabbit. It hops You, Router, ISP, Server, then sits just after Server, inside the card, facing back along the path. Reduced motion holds that sit. The sit pose no longer stacks under the leap.
- The scroll companion stays in a side gutter at full opacity, including beside the hero, the hops card, the tier row, the sample week, money tiles, and legal notes. It does not perch on them. While another rabbit moves, it holds still. Reduced motion still hides it. After it settles it plays one idle from a set of ten, then another every few seconds, never the same idle twice in a row.
- Gamer tier labels: Esports Ready, Ranked Ready, Casual Ready, Laggy, Not Game Ready. Badge colors and the A/B/C/D marks stay.
- Asset query `v=20261012c`.

## Shipped 2026-10-12 (preview: tier hop onto the crest)

- The gamer accent hops the top edge of the five tier cards, right to left: Not Game Ready, Laggy, Casual Ready, Ranked Ready, then Esports Ready. One hop per card, about half a second. It faces the direction of travel, then sits on the Esports Ready card facing into the page. Its feet stay on the top edge, clear of the crest and the label.
- After it lands, crest B snickers once while that rabbit holds still. The hop plays when the tier row scrolls into view, once. Hover or focus replays the hop, then the snicker.
- The floating crouch above the row is gone. The scroll companion stays in the gutter by the heading, off the tier row.
- Reduced motion, and a stacked or scrolling tier layout, shows the rabbit sitting on the Esports Ready card.
- Tier labels are unchanged. Asset query `v=20261012d`.

## Shipped 2026-10-12 (preview: hop loop, question titles, section accents)

- How hops work loops You, Router, ISP, Server, and back while that card is in view. It faces the way it is going, pauses at each end, and lights the dot it lands on. Off screen or a hidden tab pauses it. Reduced motion sits at Server. Captions: your PC, your Wi-Fi or modem, your provider, the site or game.
- Overpay card titles: "Getting less than you pay for?" and "Paying for more than you use?" The sublines stay. Those titles are not used in the sample week or the example player.
- Section accents that were still now move once: the market-gap rabbit looks across the gap, and the day-to-day rabbit talks on a headset. Streaming bobs like popcorn in front of the screen. The hero dash is a flat leap toward the dial. The gamer companion holds a controller and snickers when it is the one moving. The ISP hero talks on a headset.
- Asset query `v=20261012e`.

## Shipped 2026-10-12 (preview: one story per rabbit, character hop)

- Each section rabbit has its own prop and motion. Quick Check sprints and the dial needle revs. The 7-day heading flips calendar pages. History flips a stack of result cards. The market gap pulls a tape between two bars. Day to day waves while two notes bounce. Streaming keeps the popcorn and a buffering wheel that spins, then clears. Inside the app climbs into the window and slides the view switch. Who it's for tries on a headset, a mug, then popcorn. The footer waves and hops off. For ISPs taps a clipboard and checks a claim. About stacks blocks into a small house with an LLC sign. Work from home still breathes with Z marks. The gamer still hops onto the crest, then crest B snickers. How hops work still loops the dots. The good-news lap still ends in a snicker.
- The scroll companion hops on an arc. It squashes before takeoff, stretches in the air, squashes on landing, and kicks a small dust puff. Faster scrolling makes a higher, shorter hop. Stopping mid hop skids. A left to right crossing is one tall arc with a mid air tuck. A turn uses the three-quarter pose for a moment. Scroll down uses the leap pose. Scroll up uses the ears-up pose. Ears lag the turn. At rest it breathes. Idles are groom, look toward the pointer, sit, stretch, yawn, scratch, check the screen, and a nap after a long quiet stretch, never the same one twice in a row. The prop it holds matches the section: controller, calendar, Z, popcorn, cards, tape, notes, switch, hats, or a wave.
- One mascot still moves at a time. Reduced motion keeps stills, and the companion stays hidden. Asset query `v=20261012f`.

## Shipped 2026-10-13 (preview: cookieless page counts)

- Cloudflare Web Analytics beacon on the home page, About, For ISPs, and the example report. The script uses defer. Preview /privacy points at the public privacy page and does not load the beacon. The public site is unchanged.
- Fewer animations and Hide on the download bar are saved in localStorage on this device only. They are not sent anywhere.
- A proposed privacy paragraph is in `legal/PROPOSED-privacy-analytics.md` for Legal review. It is not published and not linked.
- Stylesheet query `v=20261013b`.
- Preview `/privacy`, `/privacy/subprocessors`, and `/privacy/history` use the approved analytics wording. The policy date stays the go-live date placeholder. Production `/privacy` is unchanged.
