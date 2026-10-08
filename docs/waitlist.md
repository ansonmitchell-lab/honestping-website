# Waitlist and ISP forms

Submitting Join the waitlist saves the address in Cloudflare D1 and shows a thank-you on the page. It does not open the visitor's mail app. A new row also emails hello@honestping.com. If that send fails, the visitor still sees the thank-you and the failure is logged. A duplicate address gets the same thank-you and no second email. The ISP partnership form uses the same rules, its own table, and the subject `ISP partnership`.

Nothing in this repo deploys itself. Preview and production stay on separate D1 databases and separate Workers. Do not merge this into `main`, and do not deploy the `honestping-web` Worker, until you mean to go live.

## What the code does

- `POST /api/waitlist` stores `email` (unique, lowercased), `created_at`, `source_page`, and a SHA-256 of the user agent. A second submit of the same address shows the same thank-you and does not email again.
- `POST /api/isp` stores name, company, email, optional subscribers, and message in `isp_inquiries`. The email is unique. A second note from the same address shows the thank-you, keeps the first note, and does not email again.
- The notification is best-effort. Once the row is saved, the response is the thank-you. A missing email binding or a failed send is logged (`email_binding_missing` or `email_send_failed`) and is not a 502.
- No raw IP is stored. The connecting IP is sent only to Turnstile siteverify, then dropped.
- Turnstile action is `waitlist` or `isp`. The token must match that action and a hostname in `TURNSTILE_HOSTNAMES`. On `honestping.com` and `www.honestping.com`, `localhost` and `127.0.0.1` are ignored even if they are listed.
- The visitor is not emailed. The footer line stays true: waitlist mail is only used to notify them when HonestPing is available.
- If JavaScript does not run, the link under the form still opens a message to `hello@honestping.com`.
- `isp-contact.js` matches the form on draft PR #16 (`isp-contact-form`, `ic-name`, `ic-company`, `ic-email`, `ic-subs`, `ic-message`). That page is not on `main`. When the two PRs merge, keep this `isp-contact.js`.

`functions/lib/submit.js` is the handler. `worker/index.js` calls it for `/api/waitlist` and `/api/isp`. Every other path proxies GitHub raw. The proxy base comes from `ORIGIN_BASE`. When that var is unset, the base is `https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/main`.

Pages Functions under `functions/api/` call the same handler, but Pages cannot bind `send_email`. Do not use a Pages deploy as the preview. `wrangler.jsonc` has no `send_email` binding for that reason.

## Migration SQL

`migrations/0001_forms.sql`

```sql
CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source_page TEXT,
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS isp_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  subscribers TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_page TEXT,
  user_agent_hash TEXT
);
```

`migrations/0002_isp_email_unique.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS isp_inquiries_email ON isp_inquiries (email);
```

Both databases are empty of these tables today. Apply the files to one database at a time. `0002` is what makes a repeated ISP address a duplicate.

Wrangler 4.148 can print the word "preview" for a production command when `preview_database_id` is set. Trust the UUID in parentheses:

- Preview: `honestping-waitlist-preview` `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`
- Production: `honestping-waitlist` `c732d15a-f4c9-4f7d-8588-41f7774d41d1`

## Bindings and secrets

Account `4e7e5db788ca85b49af0442d922ebc6e`.

| Binding | Name | Preview Worker `honestping-web-preview` | Production Worker `honestping-web` |
| --- | --- | --- | --- |
| D1 | `DB` | `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6` | `c732d15a-f4c9-4f7d-8588-41f7774d41d1` |
| Send email | `EMAIL` | From `waitlist@honestping.com` only, to `hello@honestping.com` only | Same |
| Var | `TURNSTILE_HOSTNAMES` | `honestping-web-preview.honestping.workers.dev` | `www.honestping.com,honestping.com` |
| Var | `ORIGIN_BASE` | `https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/cursor/waitlist-d1-bbe4` | Unset. The script defaults to the `main` raw URL above. |
| Secret | `TURNSTILE_SECRET` | Secret for sitekey `0x4AAAAAAFQof7EbIcyPa73s`. Not in git. | Same secret. Not in git. |

Do not put `localhost` on the production hostname list.

`wrangler.worker.jsonc` top level is `honestping-web`. `env.preview` is a different script. Wrangler names it `honestping-web-preview` from the top-level name plus the env name. Do not set `name` inside `env.preview`, or Wrangler appends `-preview` a second time. `routes` in that env is `[]` so a preview deploy cannot take `honestping.com` or `www.honestping.com`.

`wrangler.jsonc` is the Pages project. It intentionally has no `send_email` binding. Pages Functions cannot send this notification. Do not add the binding back, and do not deploy Pages to preview the form.

`preview_database_id` on the production D1 binding is only for local `wrangler dev --remote` and `d1 ... --preview`. A dry-run binding table can print `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6` because that display prefers `preview_database_id`. The id `wrangler deploy` uploads for production is `database_id` `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

The binding sends only to the verified destination `hello@honestping.com`. That address was added on 2026-10-08 and is not verified yet. Cloudflare mailed a verification link to the Google Workspace inbox for `hello@honestping.com`. Open that message and choose Verify email address. Until that click, sends do not deliver.

Email Routing for `honestping.com` is enabled and its status is `misconfigured` because the root MX records are Google's (`mx.foreign`). Do not use the dashboard repair that replaces those MX records with `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, and `route3.mx.cloudflare.net`. Leave the Google MX, the root SPF record, `google._domainkey`, and the Google site verification TXT as they are.

The previous Email Routing rule for `hello@honestping.com` is disabled. It does not receive mail while MX stays on Google.

A send to a verified destination is outbound from Cloudflare. It does not need Cloudflare to receive mail for the domain. The root SPF record already includes `_spf.mx.cloudflare.net`. This path is not confirmed until the verification click is done and a preview submit actually arrives at `hello@honestping.com`. If that send fails while routing stays misconfigured, the next option is Cloudflare Email Sending on the Workers Paid plan, which adds records only under `cf-bounce.honestping.com` (`MX`, SPF, and `cf-bounce._domainkey`) and can also add a `_dmarc` TXT. That is a paid plan (3,000 sends a month, then $0.35 per 1,000). Do not onboard it unless the verified-destination send fails, and review the records before accepting them so the root MX is not replaced.

In Turnstile, the existing widget must allow `www.honestping.com`, `honestping.com`, and `honestping-web-preview.honestping.workers.dev`. Do not create a second widget. If the deploy prints a different workers.dev host, put that host in `TURNSTILE_HOSTNAMES` and deploy the preview env again before submitting.

## Worker preview

Run these from the repo root. Every command includes `--config wrangler.worker.jsonc` and `--env preview`. Dropping `--env preview` targets the live `honestping-web` Worker.

1. Apply both migrations to the preview database only. Stop if the UUID is not `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`.

```sh
npx wrangler d1 migrations apply honestping-waitlist-preview --remote --config wrangler.worker.jsonc --env preview
```

2. Deploy the preview Worker. This creates or updates `honestping-web-preview` only. It does not publish `honestping-web`. Confirm the output name is `honestping-web-preview` and the routes do not include `honestping.com`.

```sh
npx wrangler deploy --config wrangler.worker.jsonc --env preview
```

3. Store the Turnstile secret on that preview Worker. `--env` is required. Without it, `secret put` publishes a new version of the live Worker. Paste the secret on stdin, not in the command line.

```sh
printf '%s' "$TURNSTILE_SECRET" | npx wrangler secret put TURNSTILE_SECRET --config wrangler.worker.jsonc --env preview
```

4. Open `https://honestping-web-preview.honestping.workers.dev/`. The pages come from this branch because `ORIGIN_BASE` points at `cursor/waitlist-d1-bbe4` on GitHub raw. `main` is unchanged.
5. Submit the waitlist form. You should see "You're on the list. We'll email you when HonestPing is ready." and no mail app. A new row emails `hello@honestping.com` from `waitlist@honestping.com` with the subject `HonestPing waitlist`. Submit the same address again: the thank-you shows, and no second email arrives. The first real send waits on the destination verification click described above.
6. The row should be in `honestping-waitlist-preview`, not `honestping-waitlist`.

`secret put` and `deploy` for this env publish the preview Worker immediately. They do not publish the live site when `--env preview` is present.

## Go live on honestping-web

Do this only when the preview submit, the preview D1 row, and the notification email all look right. This replaces the script that is currently only in the Cloudflare dashboard. `www.honestping.com` and `honestping.com` are custom domains on `honestping-web`. They are listed in `wrangler.worker.jsonc` so a deploy keeps them.

1. Apply the migrations to production. Do not add `--preview` or `--env preview`. Stop unless the UUID in parentheses is `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

```sh
npx wrangler d1 migrations apply honestping-waitlist --remote --config wrangler.worker.jsonc --env=""
```

2. Deploy the Worker. This publishes `honestping-web` immediately. `--env=""` selects the top-level environment. Wrangler warns if you omit it, because `env.preview` also exists. Do not pass `--env preview`.

```sh
npx wrangler deploy --config wrangler.worker.jsonc --env=""
```

3. Put the secret on that Worker. `secret put` publishes another version immediately, so do it in the same window as the deploy. Until the secret exists, Turnstile fails closed and the mailto link still works. Keep `--env=""` so the secret is not stored on `honestping-web-preview`.

```sh
printf '%s' "$TURNSTILE_SECRET" | npx wrangler secret put TURNSTILE_SECRET --config wrangler.worker.jsonc --env=""
```

4. Submit on `https://www.honestping.com/` and confirm the row is in `honestping-waitlist` (`c732d15a-f4c9-4f7d-8588-41f7774d41d1`) and the email arrived.
5. With `ORIGIN_BASE` unset, `GET` and the other methods still proxy `https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/main`, including the cache headers the current script sets. Only `POST /api/waitlist` and `POST /api/isp` are new.

`wrangler deploy --dry-run` prints the preview D1 id when `preview_database_id` is set. That line is the local display value. The production binding uploaded by `wrangler deploy` is `database_id` `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

## View and export

Dashboard, production:

https://dash.cloudflare.com/4e7e5db788ca85b49af0442d922ebc6e/workers/d1/databases/c732d15a-f4c9-4f7d-8588-41f7774d41d1

Dashboard, preview:

https://dash.cloudflare.com/4e7e5db788ca85b49af0442d922ebc6e/workers/d1/databases/834af7c2-165f-4fb4-92b9-49b1aa0b3eb6

Open the database, then Console, and run:

```sql
SELECT email, created_at, source_page, user_agent_hash
FROM waitlist
ORDER BY created_at DESC;

SELECT id, created_at, name, company, email, subscribers, source_page, message
FROM isp_inquiries
ORDER BY created_at DESC;
```

The list of databases is at https://dash.cloudflare.com/4e7e5db788ca85b49af0442d922ebc6e/workers/d1

Export production:

```sh
npx wrangler d1 export honestping-waitlist --remote --config wrangler.worker.jsonc --env="" --output ./honestping-waitlist.sql --table waitlist -y
npx wrangler d1 export honestping-waitlist --remote --config wrangler.worker.jsonc --env="" --output ./isp-inquiries.sql --table isp_inquiries -y
```

Export preview:

```sh
npx wrangler d1 export honestping-waitlist-preview --remote --config wrangler.worker.jsonc --env preview --output ./preview-waitlist.sql --table waitlist -y
```

The export log prints the database UUID. Stop if it is not the database you meant to download.

## Local check

```sh
npm test
npx wrangler d1 migrations apply honestping-waitlist --local --config wrangler.worker.jsonc
npx wrangler deploy --dry-run --outdir /tmp/honestping-worker-check --config wrangler.worker.jsonc --env=""
npx wrangler deploy --dry-run --outdir /tmp/honestping-worker-preview-check --config wrangler.worker.jsonc --env preview
```

`npm test` uses a fake database plus a local D1 from `getPlatformProxy({ remoteBindings: false })`. It does not call the remote databases. `.dev.vars.example` holds Cloudflare's public Turnstile test secret for local experiments. Preview and production need the real secret.

The two dry-runs do not publish. The preview dry-run must name `honestping-web-preview` and must not list `honestping.com`.
