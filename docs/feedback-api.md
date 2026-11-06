# Feedback API

`POST /api/feedback` on the public HonestPing Worker accepts a feature request, a bug report, or a crash report. The Windows app and the ISP preview (`/isp-preview/`) both use this endpoint. Nothing is stored until the user, or the app's crash sender, posts.

This change is preview only. It does not deploy `honestping-web` or `honestping-owner`, and it does not change the public pages on honestping.com.

The owner reviews every row in the Requests and reports queue, behind the existing Cloudflare Access check.

## Storage

Migration `migrations/0004_feedback.sql` adds the `feedback` table to the same D1 database as the waitlist (`DB`). Migration `migrations/0005_feedback_retention.sql` removes `ip_hash` and `isp_org`, and adds `crash_signatures` plus the columns that hold a crash signature. Apply both before the queue can load.

Screenshots go to a private R2 bucket bound as `SCREENSHOTS`. The row stores `screenshot_key` only. R2 is the store because a screenshot may be 1.5 MB, and D1 rejects a SQL statement over 100 KB, so the image cannot live in a D1 row. This change adds the binding. It does not create the buckets.

| Worker | Binding | Production bucket | Preview bucket |
| --- | --- | --- | --- |
| `honestping-web` | `SCREENSHOTS` | `honestping-feedback` | `honestping-feedback-preview` |
| `honestping-owner` | `SCREENSHOTS` | `honestping-feedback` | `honestping-feedback-preview` |

Create the preview bucket only when you are ready to try screenshots on a preview Worker. Do not create or deploy the production bucket from this change.

```sh
npx wrangler r2 bucket create honestping-feedback-preview
```

If `SCREENSHOTS` is missing and the body includes a screenshot, the API returns 503 and does not save the row. A report without a screenshot still saves.

The client IP is read only long enough to build a rate-limit key, then dropped. The key is SHA-256 of `FEEDBACK_IP_SALT`, the UTC date, the bucket (`crash` or `report`), and `CF-Connecting-IP`. It is stored in the KV namespace bound as `FEEDBACK_LIMITS`, with a TTL of 24 hours. The date in the hash rotates every UTC day. Nothing derived from the IP is written to D1, logged, or shown on the owner dashboard.

Set the salt with `wrangler secret put FEEDBACK_IP_SALT` on the public Worker. It is required. A missing salt, or a missing `FEEDBACK_LIMITS` binding, returns 500 and stores nothing.

This change adds the KV binding with a placeholder namespace id. It does not create the namespace. Local `wrangler dev` uses a simulated namespace. Before a preview deploy, create one and replace the id:

```sh
npx wrangler kv namespace create FEEDBACK_LIMITS --preview
```

The Workers Rate Limiting binding only counts inside a 10 second or 60 second window, so it cannot hold a daily cap. The KV counter is the daily limit.

## Request

`POST /api/feedback`

`Content-Type: application/json`

`OPTIONS` returns 204 with the CORS headers below and no body.

There is no Turnstile token and no install signature on this preview. Add those before a public launch if you want them. Rate limits are the abuse control for now.

### Body

| Field | Required | Rules |
| --- | --- | --- |
| `source` | yes | `app` or `isp` |
| `kind` | yes | `feature`, `bug`, or `crash` |
| `title` | yes | One line, 1 to 80 characters |
| `description` | no | Up to 2000 characters |
| `expected_behavior` | no | Up to 2000 characters |
| `page_context` | no | Which screen it was sent from, up to 200 characters. The ISP preview sends `Claim queue`, `Claim detail`, `Node health`, or `Settings`. |
| `app_version` | no | Up to 80 characters. If omitted, `diagnostics.app_version` is copied into the column. |
| `os` | no | Up to 120 characters. If omitted, `diagnostics.os` is copied into the column. |
| `issue_type` | bug and crash | Required for `bug` and `crash`. Optional for `feature`. Must be one of the codes for that source. |
| `auto_sent` | no | JSON boolean. Omit it or send `false` for a button press. Crash posts that the app sends on the next launch use `true`. Any other type is 400. |
| `exception_type` | no | Crash signature. One line, up to 120 characters, redacted before it is stored. `diagnostics.exception_type` is used when the top-level field is omitted. |
| `top_frames` | no | Crash signature. A string or an array of up to 40 strings. Redacted, then hashed. The hash is what retention keeps. `diagnostics.top_frames` is used when the top-level field is omitted. |
| `diagnostics` | no | Object, 64 KB or smaller after redaction. Keys are only `app_version`, `os`, `log_excerpt`, `screen`, `exception_type`, and `top_frames`. |
| `isp_org`, `install_id`, `install_key`, SSID, hostname, and machine fields | no | Stripped on arrival. They are not stored. Unknown diagnostics keys are still rejected. |
| `screenshot` | no | Base64 PNG or JPEG. A `data:image/png;base64,` or `data:image/jpeg;base64,` prefix is accepted. Decoded size at most 1.5 MB (1572864 bytes). |

Diagnostics field caps, before the 64 KB total: `app_version` 80, `os` 120, `screen` 200, `exception_type` 120, `top_frames` 8000, `log_excerpt` 60000 characters.

### Issue types

App (`source: "app"`):

| Code | Meaning |
| --- | --- |
| `speed_test` | Speed test |
| `trace` | Trace |
| `network_scan` | Network scan |
| `report_7day` | 7-day report |
| `monitor_alerts` | Monitor alerts |
| `startup_freeze` | Startup or freeze |
| `display_layout` | Display layout |
| `other` | Other |

ISP (`source: "isp"`):

| Code | Meaning |
| --- | --- |
| `node_health` | Node health |
| `claim_queue` | Claim queue |
| `claim_detail` | Claim detail |
| `trace_path` | Trace path |
| `settings_access` | Settings access |
| `data_looks_wrong` | Data looks wrong |
| `display_layout` | Display layout |
| `other` | Other |

`display_layout` and `other` are valid for both sources. An app code on an ISP post, or an ISP code on an app post, is 400.

### Examples

Feature, from the ISP preview:

```json
{
  "source": "isp",
  "kind": "feature",
  "title": "Export the claim queue",
  "description": "A Monday export would help the review.",
  "page_context": "Claim queue"
}
```

Bug, from the app:

```json
{
  "source": "app",
  "kind": "bug",
  "issue_type": "speed_test",
  "title": "Speed test stalled",
  "description": "The test sat on step 2.",
  "expected_behavior": "The test finishes or shows an error.",
  "page_context": "Speed test",
  "app_version": "1.8.48",
  "os": "Windows 10"
}
```

Crash, sent automatically on the next launch:

```json
{
  "source": "app",
  "kind": "crash",
  "issue_type": "startup_freeze",
  "title": "Closed during startup",
  "auto_sent": true,
  "app_version": "1.8.48",
  "os": "Windows 10",
  "page_context": "Startup",
  "exception_type": "System.InvalidOperationException",
  "top_frames": ["at App.Main()", "at App.Start()"],
  "diagnostics": {
    "app_version": "1.8.48",
    "os": "Windows 10",
    "screen": "Startup",
    "log_excerpt": "startup step 2"
  }
}
```

## Response

Success is HTTP 200:

```json
{ "id": 15, "status": "new" }
```

`id` is a number. `status` is `new` on create. The reference to show a person is `HP-` plus that id, for example `HP-15`.

Errors are JSON `{ "error": "..." }` and include the CORS headers.

| Status | When |
| --- | --- |
| 400 | Missing or invalid fields, `auto_sent` not a boolean, or no client IP to rate limit |
| 405 | Not POST or OPTIONS |
| 413 | Body over about 2.6 MB |
| 415 | Not JSON |
| 429 | Rate limit |
| 500 | Storage, salt, or the KV limit binding is not ready, or the save failed |
| 503 | A screenshot was sent and `SCREENSHOTS` is not bound |

Rate limits use the KV counter and the UTC day:

- `crash`: 5 posts
- `feature` and `bug` together: 20 posts

A network that has used its crash limit can still send a bug or a feature. Crash posts count whether or not `auto_sent` is true. The counter resets on the next UTC day, and the KV key expires within 24 hours.

CORS on every feedback response:

```
access-control-allow-origin: *
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: content-type
access-control-max-age: 86400
```

## Redaction

Before the row is stored, the server rewrites title, description, expected behavior, page context, app version, OS, exception type, top frames, and every diagnostics string:

- Email addresses become `[email]`
- MAC addresses (`aa:bb:cc:dd:ee:ff`, dashes, or `aabb.ccdd.eeff`) become `[mac]`
- Private IPv4 (`10/8`, `127/8`, `192.168/16`, `172.16/12`, `169.254/16`) and local IPv6 (`fe80::/10`, `fc00::/7`, `::1`) become `[private-ip]`
- Other IPv4 and IPv6 addresses become `[ip]`
- A labeled SSID or BSSID becomes `[ssid]`
- A labeled ISP name becomes `[isp]`. An `isp_org` field is dropped and not stored
- A labeled hostname, a name ending in `.local`, `.lan`, `.home`, `.internal`, or `.arpa`, or a lowercase name ending in `.com`, `.net`, `.org`, `.io`, or `.dev`, becomes `[host]`
- A Windows computer name (`DESKTOP-`, `LAPTOP-`, `WIN-`), a labeled machine name, or a UNC host becomes `[machine]`
- A Windows profile path (`C:\Users\Name` or `C:/Users/Name`) becomes `[user]`
- An install id or install key, including `install_id` and `install_key` fields, becomes `[install]` or is removed

`1.8.48` is an app version and is left as written. Clock times such as `15:00:00` are left as written. Do not send device lists, MAC tables, SSIDs, or install keys. There is no email field.

## Retention

The public Worker cron `15 3 * * *` runs at 03:15 UTC, after the existing mail retry cron. This change registers the cron. It does not deploy, so the job is not live yet.

Each night the job does two things:

- Crash reports older than 90 days: delete the screenshot from R2, delete the report body from `feedback`, and add 1 to `crash_signatures`. The signature is the redacted exception type plus the SHA-256 of the redacted top frames. The row keeps that signature, the source, the issue type, the count, and the first and last time it was seen.
- Bug and feature reports older than 12 months: delete the screenshot and delete the row. No signature is kept.

A crash with no exception type is counted as `unknown`. A crash with no frames uses the hash of an empty string, so those crashes still group together. Running the job again does not add the count a second time. The owner queue lists retained signatures as exception type and count. It does not show the frame text after the body is gone.

`K_MIN` is the smallest neighbor group the ISP preview will show as a number. The default is 10. Set the Worker var `K_MIN` to an integer from 2 to 100. A household count under that minimum is shown as Hidden, and the page says groups of that size or more. The owner review queue does not show area or household counts.

## Owner queue

`/requests` on the owner Worker lists the same rows. Filters are `source`, `kind`, and `status`. The default view groups by issue type with a 7 day count, a 30 day count, an app and ISP split, and a 30 day sparkline. A title that shares enough words with another report of the same issue type is marked as a possible duplicate. Detail pages show the screenshot from R2 and the log excerpt in a scroll box. Rows with `auto_sent` true show an Auto badge.

Status values: `new`, `reviewing`, `planned`, `declined`, `done`. Each change is a row in `owner_access_log` with action `status` and detail `feedback <id> <status>`.

## Try it locally

These commands do not publish and do not call the remote databases. From the repo root:

```sh
npm test
```

Copy `.dev.vars.example` to `.dev.vars` if you do not already have one. Set `FEEDBACK_IP_SALT` to any long random string. That salt only builds the KV rate-limit key. Apply migrations 0004 and 0005 to the local D1, then start the public Worker:

```sh
npx wrangler d1 migrations apply honestping-waitlist --local --config wrangler.worker.jsonc
npx wrangler dev --config wrangler.worker.jsonc --port 8788
```

Open `http://127.0.0.1:8788/isp-preview/`. The `?` button opens help for the current view. Suggest a feature and Report a bug post to `/api/feedback` with `source` `isp`. If a send fails, the help panel says to email `hello@honestping.com`. That is the only contact address on the feedback, help, and ISP screens, and the only address on the notification emails. The page is `noindex` and is not linked from the public site. The footer is `© 2026 Honest Ping LLC`.

A curl check:

```sh
curl -s -D - http://127.0.0.1:8788/api/feedback \
  -H 'content-type: application/json' \
  -d '{"source":"app","kind":"feature","title":"Local check"}'
```

Expect `{"id":1,"status":"new"}` the first time, after the migration and the salt are in place.

The owner queue is the same Access-gated Worker as before. `npm test` covers the fail-closed check and a status change. Do not deploy it from this change. Preview steps for that Worker stay in `docs/owner.md`. Apply migrations `0004_feedback.sql` and `0005_feedback_retention.sql` to the same preview database before the queue can load:

```sh
npx wrangler d1 migrations apply honestping-waitlist-preview --remote --config wrangler.worker.jsonc --env preview
```

Stop unless the database UUID is `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`. That command is a preview database write. This change did not run it.
