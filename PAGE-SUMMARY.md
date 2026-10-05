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

1. **Header**: App-style brand lockup (icon + name + tagline subtitle), nav, waitlist CTA  
2. **Hero**: Tagline exactly *Network health, explained*; value prop; live Overview dial (SVG + CSS + `gauge.js`) matching app `.hp-dial-rim` / `.hp-dial-face` / `.hp-dial-value`, ping ticks 22 to 36 ms around 28 ms, jitter and packet loss beside it; reduced motion freezes at 28 ms; waitlist + creator  
3. **What it does for you**: Four concrete client-value cards: bars lie / evidence / history / next steps  
4. **The gap on the market**: Contrast: radio bars · vanity speed tests · opaque enterprise monitors · **HonestPing**  
5. **Day to day**: Three practical moments (calls, reboot triage, ISP tickets)  
6. **Inside the app**: `overview-navy` preview in window chrome  
7. **Waitlist**: mailto `hello@honestping.com?subject=HonestPing%20waitlist` (+ email field via JS)  
8. **Footer**: © Anson Mitchell · ansonmitchell.com · privacy-light waitlist note  

## Primary CTA

**Join the waitlist** → `mailto:hello@honestping.com` (no public download yet).

## Assets

Under `assets/`: logo (png/webp), icon-display, app-preview (png/webp), favicons, og-image.

Only the current product name HonestPing appears in user-facing copy.
