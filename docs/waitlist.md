# Waitlist and ISP forms

Submitting Join the waitlist saves the address in Cloudflare D1 and shows a thank-you on the page. It does not open the visitor's mail app. Each accepted sign-up also emails Anson. The same handler serves the ISP partnership form.

Nothing in this repo deploys itself. Preview and production stay on separate D1 databases. Do not merge this into `main`, and do not deploy the `honestping-web` Worker, until you mean to go live.

## What the code does

- `POST /api/waitlist` stores `email` (unique, lowercased), `created_at`, `source_page`, and a SHA-256 of the user agent. A second submit of the same address shows the same thank-you.
- `POST /api/isp` stores name, company, email, optional subscribers, and message in `isp_inquiries`, and emails Anson with the subject `ISP partnership`.
- No raw IP is stored. The connecting IP is sent only to Turnstile siteverify, then dropped.
- Turnstile action is `waitlist` or `isp`. The token must match that action and a hostname in `TURNSTILE_HOSTNAMES`. On `honestping.com` and `www.honestping.com`, `localhost` and `127.0.0.1` are ignored even if they are listed.
- The visitor is not emailed. The footer line stays true: waitlist mail is only used to notify them when HonestPing is available.
- If JavaScript does not run, the link under the form still opens a message to `hello@honestping.com`, which already forwards to `ansonmitchell@gmail.com`.
- `isp-contact.js` matches the form on draft PR #16 (`isp-contact-form`, `ic-name`, `ic-company`, `ic-email`, `ic-subs`, `ic-message`). That page is not on `main`. When the two PRs merge, keep this `isp-contact.js`.

`functions/lib/submit.js` is the handler. Pages Functions call it from `functions/api/waitlist.js` and `functions/api/isp.js`. `worker/index.js` calls it for those two paths and otherwise keeps the current GitHub raw proxy.

## Migration SQL

File: `migrations/0001_forms.sql`

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

Both databases are empty of these tables today. Apply the file to one database at a time.

Wrangler 4.148 can print the word "preview" for a production command when `preview_database_id` is set. Trust the UUID in parentheses:

- Preview: `honestping-waitlist-preview` `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`
- Production: `honestping-waitlist` `c732d15a-f4c9-4f7d-8588-41f7774d41d1`

## Bindings and secrets

Account `4e7e5db788ca85b49af0442d922ebc6e`.

Shared by the Pages project and the Worker:

| Binding | Name | Value |
| --- | --- | --- |
| D1 | `DB` | Preview `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`. Production `c732d15a-f4c9-4f7d-8588-41f7774d41d1`. |
| Send email | `EMAIL` | From `waitlist@honestping.com` only, to `ansonmitchell@gmail.com` only. |
| Var | `TURNSTILE_HOSTNAMES` | Preview: `.honestping.pages.dev`. Production: `www.honestping.com,honestping.com`. Do not put `localhost` on production. |
| Secret | `TURNSTILE_SECRET` | The secret for sitekey `0x4AAAAAAFQof7EbIcyPa73s`. Not in git. |

`wrangler.jsonc` is the Pages project `honestping`. Its top level is production. `env.preview` is every Pages preview. `preview_database_id` is only for local `wrangler dev --remote` and `d1 ... --preview`.

`wrangler.worker.jsonc` is the later replacement for the live Worker `honestping-web`. Its `previews` block points Worker Previews at the preview D1. Deploying that file publishes the Worker. Do not deploy it for a Pages preview.

`ansonmitchell@gmail.com` is already a verified Email Routing destination, and `hello@honestping.com` already forwards there. Before the first real submit, open Compute, Email Service, Email Sending, and onboard `honestping.com` if it is not listed. The from address has to be on a domain that can send.

In Turnstile, the existing widget must allow `www.honestping.com`, `honestping.com`, and the Pages preview host (or `*.honestping.pages.dev` if the widget accepts that). Do not create a second widget.

## Pages preview

Run these from the repo root. Do not pass `--branch main`. The Pages production branch is `main`, and a deploy of `main` would publish the production Pages environment. The live site is still the Worker, but this deploy must stay a preview.

1. Apply the migration to the preview database only. Stop if the UUID is not `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`.

```sh
npx wrangler d1 migrations apply honestping-waitlist-preview --remote --env preview
```

2. Store the Turnstile secret on the Pages preview environment. `--env` defaults to production, so the flag is required. Paste the secret on stdin, not in the command line. This does not deploy the site.

```sh
printf '%s' "$TURNSTILE_SECRET" | npx wrangler pages secret put TURNSTILE_SECRET --project-name honestping --env preview
```

3. Deploy this branch to Pages. The project name in `wrangler.jsonc` is `honestping`.

```sh
npx wrangler pages deploy . --project-name honestping --branch cursor/waitlist-d1-bbe4
```

4. Open the preview URL Wrangler prints. It should look like `https://cursor-waitlist-d1-bbe4.honestping.pages.dev/`. Confirm the deployment is a Preview, not Production.
5. Submit the waitlist form. You should see the thank-you on the page and no mail app. Anson should get a message from `waitlist@honestping.com` with the subject `HonestPing waitlist`.
6. The row should be in `honestping-waitlist-preview`, not `honestping-waitlist`.

`_routes.json` sends only `/api/*` through the Function. The rest of the preview stays static.

## Go live on honestping-web

Do this only when the preview submit, the preview D1 row, and the notification email all look right. This replaces the script that is currently only in the Cloudflare dashboard. `www.honestping.com` and `honestping.com` are custom domains on `honestping-web`. They are listed in `wrangler.worker.jsonc` so a deploy keeps them.

1. Apply the migration to production. Do not add `--preview` or `--env preview`. Stop unless the UUID in parentheses is `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

```sh
npx wrangler d1 migrations apply honestping-waitlist --remote --config wrangler.worker.jsonc
```

2. Deploy the Worker. This publishes immediately.

```sh
npx wrangler deploy --config wrangler.worker.jsonc
```

3. Put the secret on that Worker. `secret put` publishes another version immediately, so do it in the same window as the deploy. Until the secret exists, submits fail closed and the mailto link still works.

```sh
printf '%s' "$TURNSTILE_SECRET" | npx wrangler secret put TURNSTILE_SECRET --config wrangler.worker.jsonc
```

4. Submit on `https://www.honestping.com/` and confirm the row is in `honestping-waitlist` (`c732d15a-f4c9-4f7d-8588-41f7774d41d1`) and the email arrived.
5. `GET` and the other methods still proxy `https://raw.githubusercontent.com/ansonmitchell-lab/honestping-website/main`, including the cache headers the current script sets. Only `POST /api/waitlist` and `POST /api/isp` are new.

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
npx wrangler d1 export honestping-waitlist --remote --config wrangler.worker.jsonc --output ./honestping-waitlist.sql --table waitlist -y
npx wrangler d1 export honestping-waitlist --remote --config wrangler.worker.jsonc --output ./isp-inquiries.sql --table isp_inquiries -y
```

Export preview:

```sh
npx wrangler d1 export honestping-waitlist-preview --remote --env preview --output ./preview-waitlist.sql --table waitlist -y
```

The export log prints the database UUID. Stop if it is not the database you meant to download.

## Local check

```sh
npm test
npx wrangler d1 migrations apply honestping-waitlist --local
npx wrangler pages functions build --outdir /tmp/hp-fns
npx wrangler deploy --dry-run --outdir /tmp/honestping-worker-check --config wrangler.worker.jsonc
npx wrangler pages dev . --port 8788
```

`npm test` uses a fake database plus a local D1 from `getPlatformProxy({ remoteBindings: false })`. It does not call the remote databases. `.dev.vars.example` holds Cloudflare's public Turnstile test secret for local experiments. Preview and production need the real secret.
