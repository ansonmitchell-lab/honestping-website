# Owner dashboard

This is a separate Worker, `owner/`, for the HonestPing owner. It reads the waitlist and ISP tables from draft PR #17 and adds two tables of its own. It does not change the marketing site.

Do not merge this PR. Do not deploy the production Worker `honestping-owner`. Preview deploy steps are below and were not run from this change. Go-live needs Anson's approval.

The PR base is `cursor/waitlist-d1-bbe4` (draft PR #17). `main` does not have the `waitlist` or `isp_inquiries` tables yet.

The dashboard is read only except for ISP status. Auth is Cloudflare Access. The Worker checks the `Cf-Access-Jwt-Assertion` header against `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. A missing header, a missing variable, a bad signature, a wrong audience, or an expired token gets the same sign-in page and no data.

Emails from the forms appear only on the Waitlist and ISP tabs, and in their CSV files. Counts for a group under 5 are shown as hidden.

## Migration SQL

`owner/migrations/0001_owner.sql`

```sql
CREATE TABLE IF NOT EXISTS isp_pipeline (
  inquiry_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('new', 'talking', 'pilot', 'partner')),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'export', 'status')),
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS owner_access_log_created_at ON owner_access_log (created_at);
```

`isp_pipeline` is the only business write. No row means the inquiry is still `new`. `owner_access_log` records each dashboard view, CSV export, and status change with the Access email and a timestamp.

Apply this file to one database at a time. The waitlist migrations `0001`, `0002`, and `0003` from PR #17 must already be on that database. This file does not change `waitlist` or `isp_inquiries`.

Wrangler can print the word preview for a production command when `preview_database_id` is set. Trust the UUID in parentheses.

- Preview: `honestping-waitlist-preview` `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`
- Production: `honestping-waitlist` `c732d15a-f4c9-4f7d-8588-41f7774d41d1`

## Bindings and secrets

Account `4e7e5db788ca85b49af0442d922ebc6e`.

Config: `owner/wrangler.jsonc`. Top level name `honestping-owner`. `env.preview` has no `name` of its own, so Wrangler calls that script `honestping-owner-preview`. `routes` in the preview env is empty so a preview deploy cannot take `owner.honestping.com`.

| Name | Kind | Preview `honestping-owner-preview` | Production `honestping-owner` |
| --- | --- | --- | --- |
| `DB` | D1 binding | `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6` | `c732d15a-f4c9-4f7d-8588-41f7774d41d1` |
| `ACCESS_TEAM_DOMAIN` | Secret, required | `https://<team>.cloudflareaccess.com` | Same team URL |
| `ACCESS_AUD` | Secret, required | AUD tag of the preview Access app | AUD tag of the `owner.honestping.com` Access app |
| `ZONE_ID` | Secret, optional | honestping.com zone id | Same zone id |
| `CF_ANALYTICS_TOKEN` | Secret, optional | API token with analytics read on the honestping.com zone only | Same token, or a separate token with the same permission |
| `GITHUB_REPO` | Secret, optional | `owner/name` of the public app repo | Same repo |

`ACCESS_AUD` is different for preview and production if they are two Access applications. Do not reuse the preview tag on production.

Leave `ZONE_ID` and `CF_ANALYTICS_TOKEN` unset until you want traffic numbers. The page then says `Connect site analytics` and the rest of the dashboard still loads.

Leave `GITHUB_REPO` unset until the app repo has public releases. The page then says `not connected`.

Create `CF_ANALYTICS_TOKEN` in the Cloudflare API tokens page. Permission: Analytics Read. Resource: the honestping.com zone only. Do not grant edit, Workers, or D1 permissions on this token. The Worker reads D1 through the binding.

None of these values belong in git. `owner/.dev.vars.example` lists the names for local wrangler only.

## Preview on workers.dev

Run these from the repo root. Every command includes `--config owner/wrangler.jsonc` and `--env preview`. Dropping `--env preview` targets production. Do not do that until the go-live section.

1. Apply `owner/migrations/0001_owner.sql` to the preview database only. Stop if the UUID is not `834af7c2-165f-4fb4-92b9-49b1aa0b3eb6`. The waitlist migrations from PR #17 should already be on this database. If they are not, apply those from that PR's steps first, still on this same preview UUID.

```sh
npx wrangler d1 migrations apply honestping-waitlist-preview --remote --config owner/wrangler.jsonc --env preview
```

2. Deploy the preview Worker. Confirm the output name is `honestping-owner-preview`, the workers.dev host is `honestping-owner-preview.honestping.workers.dev`, and the routes do not include `owner.honestping.com` or `honestping.com`. This does not publish `honestping-owner`.

```sh
npx wrangler deploy --config owner/wrangler.jsonc --env preview
```

3. Store the Access values on that preview Worker. `--env preview` is required. Without it, `secret put` publishes a new version of the production Worker. Paste each value on stdin.

```sh
printf '%s' "$ACCESS_TEAM_DOMAIN" | npx wrangler secret put ACCESS_TEAM_DOMAIN --config owner/wrangler.jsonc --env preview
printf '%s' "$ACCESS_AUD" | npx wrangler secret put ACCESS_AUD --config owner/wrangler.jsonc --env preview
```

`ACCESS_TEAM_DOMAIN` includes `https://`. You can copy the team domain from Zero Trust, then Settings. Add the analytics and GitHub values only when you want those cards filled in:

```sh
printf '%s' "$ZONE_ID" | npx wrangler secret put ZONE_ID --config owner/wrangler.jsonc --env preview
printf '%s' "$CF_ANALYTICS_TOKEN" | npx wrangler secret put CF_ANALYTICS_TOKEN --config owner/wrangler.jsonc --env preview
printf '%s' "$GITHUB_REPO" | npx wrangler secret put GITHUB_REPO --config owner/wrangler.jsonc --env preview
```

`secret put` publishes a new version of `honestping-owner-preview` immediately. It does not publish `honestping-owner` when `--env preview` is present.

The Worker returns the sign-in page until `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set and the JWT matches. It does not show waitlist rows on that failure.

## Cloudflare Access for the preview

Protect `honestping-owner-preview.honestping.workers.dev` with a self-hosted Access application. Allow only `hello@honestping.com`, with a one-time PIN.

1. In Zero Trust, open Integrations, then Identity providers. Add One-time PIN if it is not already listed.
2. Open Access controls, then Applications. Add an application. Choose Self-hosted.
3. Name it `HonestPing owner preview`.
4. Public hostname: `honestping-owner-preview.honestping.workers.dev`. Use the host the preview deploy printed if it differs. Leave the path empty so the whole host is covered.
5. Accept identity from One-time PIN.
6. Add one Allow policy. Name it `Owner`. Include selector: Emails. Value: `hello@honestping.com`. Do not add a second include. Do not add an Everyone rule. Do not add a Bypass rule.
7. Save the application. Open it again and copy the Application Audience (AUD) tag. That value is `ACCESS_AUD` for the preview Worker. Put it with the command in the previous section, then deploy is already current once `secret put` finishes.
8. Open `https://honestping-owner-preview.honestping.workers.dev/`. Request a one-time PIN for `hello@honestping.com`. The overview should load, with the strip that starts `This dashboard can't see:`.
9. A different email is denied by Access. A request with no JWT is denied by the Worker.

The Worker checks the JWT itself. Access in front is what asks for the PIN. Both are required.

## Go live on owner.honestping.com

Do not run this section until Anson approves it. These commands publish `honestping-owner` and attach `owner.honestping.com`.

1. Create a second self-hosted Access application before the production deploy. Name it `HonestPing owner`. Public hostname: `owner.honestping.com`. Same identity provider and the same Allow policy: email is exactly `hello@honestping.com`, one-time PIN, no other include. Copy this application's AUD tag. It is not the preview tag.
2. Apply the owner migration to production. Do not add `--preview` or `--env preview`. Stop unless the UUID in parentheses is `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

```sh
npx wrangler d1 migrations apply honestping-waitlist --remote --config owner/wrangler.jsonc --env=""
```

3. Put the production secrets. `secret put` publishes a version, so do it in the same window as the deploy. Keep `--env=""`.

```sh
printf '%s' "$ACCESS_TEAM_DOMAIN" | npx wrangler secret put ACCESS_TEAM_DOMAIN --config owner/wrangler.jsonc --env=""
printf '%s' "$ACCESS_AUD" | npx wrangler secret put ACCESS_AUD --config owner/wrangler.jsonc --env=""
```

Add `ZONE_ID`, `CF_ANALYTICS_TOKEN`, and `GITHUB_REPO` the same way if those cards should be live. Use the production AUD from step 1.

4. Deploy the production Worker. `--env=""` selects the top level. Wrangler warns if you omit it, because `env.preview` exists. Do not pass `--env preview`. Confirm the log names `honestping-owner` and the route is `owner.honestping.com`.

```sh
npx wrangler deploy --config owner/wrangler.jsonc --env=""
```

5. Open `https://owner.honestping.com/`, sign in with the one-time PIN for `hello@honestping.com`, and confirm the rows are the production waitlist. A second email still does not get in.

`wrangler deploy --dry-run` can print the preview D1 id when `preview_database_id` is set. That line is the local display value. The production binding uploaded by `wrangler deploy` without `--env preview` is `c732d15a-f4c9-4f7d-8588-41f7774d41d1`.

## Local check

These commands do not publish and do not call the remote databases.

```sh
npm test
npx wrangler deploy --dry-run --outdir /tmp/honestping-owner-check --config owner/wrangler.jsonc --env=""
npx wrangler deploy --dry-run --outdir /tmp/honestping-owner-preview-check --config owner/wrangler.jsonc --env preview
```

The preview dry-run must name `honestping-owner-preview` and must not list `owner.honestping.com`.
