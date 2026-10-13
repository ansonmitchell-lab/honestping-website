# Proposed addition for the privacy page

Status: draft for Legal review. Not published. Not linked from the site. Not part of https://www.honestping.com/privacy.

Suggested paragraph:

We use Cloudflare Web Analytics to count visits and popular pages. It doesn't use cookies or track you across sites.

Notes for Legal, not for the page until you approve them:

- This is on the preview site only. The public site and the privacy page are unchanged.
- The beacon is the Cloudflare Web Analytics script. It loads with defer. It is not on /privacy.
- Cloudflare describes this product as cookieless. It does not set a cookie, it does not store an identifier in localStorage, and it is not an ad tag.
- The counts are things like which pages were opened, roughly where visits came from, and general browser and country totals. They are not used to follow a person across other sites.
- Two display choices stay on the device only: fewer animations, and whether the download bar was dismissed. Those are saved in localStorage. They are not sent to Cloudflare or to us.
