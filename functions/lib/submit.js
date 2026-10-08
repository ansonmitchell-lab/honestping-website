const WAITLIST_SUBJECT = "HonestPing waitlist";
const ISP_SUBJECT = "ISP partnership";
const FROM_ADDRESS = "waitlist@honestping.com";
const TO_ADDRESS = "hello@honestping.com";

const COPY = {
  waitlistThanks: "You're on the list. We'll email you when HonestPing is ready.",
  ispThanks: "Thanks. We'll reply to you about partnering.",
  tryAgain: "Something went wrong. Please try again, or email hello@honestping.com.",
  badEmail: "Please enter a valid email address.",
  turnstile: "Please confirm you're a person, then try again.",
  ispFields: "Please fill in your name, company, email, and a message.",
  tooLong: "That message is too long. Please shorten it and try again.",
};

const FORMS = {
  "/api/waitlist": "waitlist",
  "/api/isp": "isp",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function wantsHtml(request) {
  const type = request.headers.get("content-type") || "";
  const accept = request.headers.get("accept") || "";
  return type.includes("application/x-www-form-urlencoded") && accept.includes("text/html");
}

function page(status, title, message, back) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;background:#07131f;color:#edf5fa;font:16px/1.5 Segoe UI,sans-serif">
  <main style="max-width:36rem;margin:12vh auto;padding:24px">
    <h1 style="font-size:1.4rem;font-weight:600">${title}</h1>
    <p>${message}</p>
    <p><a style="color:#05d1e8" href="${back}">Back to HonestPing</a></p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(request, status, message, back) {
  if (wantsHtml(request)) return page(status, "Please try again", message, back || "/");
  return json(status, { ok: false, error: message });
}

function succeed(request, message, back) {
  if (wantsHtml(request)) return page(200, "Thank you", message, back || "/");
  return json(200, { ok: true, message });
}

function field(fields, key) {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function oneLine(value, max) {
  const clean = value.replace(/[\u0000\r\n]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) return null;
  return clean;
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (/[\u0000\r\n]/.test(email)) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

function cleanSource(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) return null;
  if (path.length > 200 || !/^\/[A-Za-z0-9._~/-]*$/.test(path)) return null;
  return path;
}

function sourcePage(request, fields) {
  const given = cleanSource(field(fields, "source_page"));
  if (given) return given;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const ref = new URL(referer);
    if (ref.host !== new URL(request.url).host) return null;
    return cleanSource(ref.pathname);
  } catch {
    return null;
  }
}

function hostRules(request, env) {
  const rules = String(env.TURNSTILE_HOSTNAMES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const host = new URL(request.url).hostname.toLowerCase();
  if (host === "honestping.com" || host === "www.honestping.com") {
    return rules.filter((rule) => {
      const bare = rule.toLowerCase().replace(/^\./, "");
      return bare !== "localhost" && bare !== "127.0.0.1";
    });
  }
  return rules;
}

function hostnameAllowed(hostname, rules) {
  if (typeof hostname !== "string" || rules.length === 0) return false;
  const host = hostname.toLowerCase();
  return rules.some((rule) => {
    const item = rule.toLowerCase();
    if (item.startsWith(".")) return host.endsWith(item) && host.length > item.length;
    return host === item;
  });
}

async function readFields(request) {
  const claimed = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(claimed) && claimed > 20000) return { error: "size" };
  const text = await request.text();
  if (text.length > 20000) return { error: "size" };
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "body" };
      return { fields: data };
    } catch {
      return { error: "body" };
    }
  }
  const params = new URLSearchParams(text);
  const fields = {};
  for (const [key, value] of params) fields[key] = value;
  return { fields };
}

async function hashUserAgent(request) {
  const agent = request.headers.get("user-agent");
  if (!agent) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(agent.slice(0, 512)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(request, env, token, expectedAction) {
  const rules = hostRules(request, env);
  if (!env.TURNSTILE_SECRET || rules.length === 0) {
    console.error(JSON.stringify({ message: "turnstile_not_configured" }));
    return { ok: false, reason: "config" };
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "token" };
  }
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("siteverify " + response.status);
    result = await response.json();
  } catch (error) {
    console.error(JSON.stringify({
      message: "turnstile_unreachable",
      error: error instanceof Error ? error.message : "failed",
    }));
    return { ok: false, reason: "siteverify" };
  }
  if (!result || result.success !== true || result.action !== expectedAction) {
    return { ok: false, reason: "rejected" };
  }
  if (!hostnameAllowed(result.hostname, rules)) return { ok: false, reason: "hostname" };
  return { ok: true };
}

function wroteRow(result) {
  const changes = result && result.meta ? result.meta.changes : undefined;
  if (changes === undefined || changes === null) return true;
  return Number(changes) > 0;
}

const TABLES = {
  waitlist: "waitlist",
  isp_inquiries: "isp_inquiries",
};

function waitlistNotice(row) {
  return [
    "New HonestPing waitlist sign-up",
    "",
    "Email: " + row.email,
    "Page: " + (row.source_page || "not provided"),
    "Time: " + row.created_at,
  ].join("\n");
}

function ispNotice(row) {
  return [
    "New ISP partnership note",
    "",
    "Name: " + row.name,
    "Company: " + row.company,
    "Email: " + row.email,
    "Subscribers: " + (row.subscribers || "Not given"),
    "Page: " + (row.source_page || "not provided"),
    "Time: " + row.created_at,
    "",
    row.message,
  ].join("\n");
}

async function notify(env, subject, text, replyTo) {
  if (!env.EMAIL || typeof env.EMAIL.send !== "function") {
    console.error(JSON.stringify({ message: "email_binding_missing", subject }));
    return false;
  }
  try {
    await env.EMAIL.send({
      to: TO_ADDRESS,
      from: { email: FROM_ADDRESS, name: "HonestPing" },
      replyTo,
      subject,
      text,
    });
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "email_send_failed",
      subject,
      error: error instanceof Error ? error.message : "failed",
    }));
    return false;
  }
}

async function markNotified(env, table, email) {
  const name = TABLES[table];
  await env.DB.prepare(
    `UPDATE ${name} SET notified_at = ? WHERE email = ? AND notified_at IS NULL`,
  ).bind(new Date().toISOString(), email).run();
}

async function deliver(env, table, email, subject, text, replyTo) {
  const sent = await notify(env, subject, text, replyTo);
  if (!sent) return false;
  try {
    await markNotified(env, table, email);
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "notify_mark_failed",
      subject,
      error: error instanceof Error ? error.message : "failed",
    }));
    return false;
  }
}

export async function retryUnsent(env) {
  const counts = { waitlist: 0, isp: 0 };
  if (!env || !env.DB) {
    console.error(JSON.stringify({ message: "db_binding_missing", form: "retry" }));
    return counts;
  }
  try {
    const waitlist = await env.DB.prepare(
      "SELECT email, created_at, source_page FROM waitlist WHERE notified_at IS NULL ORDER BY created_at ASC LIMIT 10",
    ).all();
    for (const row of waitlist.results || []) {
      try {
        if (await deliver(env, "waitlist", row.email, WAITLIST_SUBJECT, waitlistNotice(row), row.email)) {
          counts.waitlist += 1;
        }
      } catch (error) {
        console.error(JSON.stringify({
          message: "notify_retry_failed",
          form: "waitlist",
          error: error instanceof Error ? error.message : "failed",
        }));
      }
    }
    const isp = await env.DB.prepare(
      "SELECT email, name, company, subscribers, message, created_at, source_page FROM isp_inquiries WHERE notified_at IS NULL ORDER BY created_at ASC LIMIT 10",
    ).all();
    for (const row of isp.results || []) {
      try {
        if (await deliver(env, "isp_inquiries", row.email, ISP_SUBJECT, ispNotice(row), row.email)) {
          counts.isp += 1;
        }
      } catch (error) {
        console.error(JSON.stringify({
          message: "notify_retry_failed",
          form: "isp",
          error: error instanceof Error ? error.message : "failed",
        }));
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      message: "notify_retry_failed",
      error: error instanceof Error ? error.message : "failed",
    }));
  }
  console.log(JSON.stringify({
    message: "notify_retry",
    waitlist_sent: counts.waitlist,
    isp_sent: counts.isp,
  }));
  return counts;
}

export async function handleSubmit(request, env) {
  const url = new URL(request.url);
  const form = FORMS[url.pathname];
  if (!form) return json(404, { ok: false, error: COPY.tryAgain });
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Open the form on the site and submit it from there." });
  }

  const back = form === "isp" ? "/isp" : "/";
  const parsed = await readFields(request);
  if (parsed.error) return fail(request, 413, COPY.tooLong, back);

  const token = field(parsed.fields, "cf-turnstile-response");
  const verified = await verifyTurnstile(request, env, token, form);
  if (!verified.ok) {
    const message = verified.reason === "config" || verified.reason === "siteverify"
      ? COPY.tryAgain
      : COPY.turnstile;
    const status = verified.reason === "config" || verified.reason === "siteverify" ? 503 : 403;
    return fail(request, status, message, back);
  }

  if (!env.DB) {
    console.error(JSON.stringify({ message: "db_binding_missing", form }));
    return fail(request, 503, COPY.tryAgain, back);
  }

  const email = normalizeEmail(field(parsed.fields, "email"));
  if (!email) return fail(request, 400, COPY.badEmail, back);
  const source = sourcePage(request, parsed.fields);
  const createdAt = new Date().toISOString();
  const userAgentHash = await hashUserAgent(request);

  try {
    if (form === "waitlist") {
      const result = await env.DB.prepare(
        "INSERT INTO waitlist (email, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING",
      ).bind(email, createdAt, source, userAgentHash).run();
      const isNew = wroteRow(result);
      const row = isNew
        ? { email, created_at: createdAt, source_page: source, notified_at: null }
        : await env.DB.prepare(
          "SELECT email, created_at, source_page, notified_at FROM waitlist WHERE email = ?",
        ).bind(email).first();
      const notified = row && !row.notified_at
        ? await deliver(env, "waitlist", row.email, WAITLIST_SUBJECT, waitlistNotice(row), row.email)
        : Boolean(row && row.notified_at);
      console.log(JSON.stringify({ message: "signup_saved", form: "waitlist", new_row: isNew, notified }));
      return succeed(request, COPY.waitlistThanks, source || back);
    }

    const name = oneLine(field(parsed.fields, "name"), 80);
    const company = oneLine(field(parsed.fields, "company"), 120);
    const message = field(parsed.fields, "message").replace(/\u0000/g, "").trim();
    const subscribersRaw = field(parsed.fields, "subscribers");
    const subscribers = subscribersRaw ? oneLine(subscribersRaw, 40) : null;
    if (!name || !company || !message || message.length > 4000 || (subscribersRaw && !subscribers)) {
      return fail(request, 400, message.length > 4000 || (subscribersRaw && !subscribers) ? COPY.tooLong : COPY.ispFields, back);
    }
    const result = await env.DB.prepare(
      "INSERT INTO isp_inquiries (email, name, company, subscribers, message, created_at, source_page, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING",
    ).bind(email, name, company, subscribers, message, createdAt, source, userAgentHash).run();
    const isNew = wroteRow(result);
    const row = isNew
      ? {
        email,
        name,
        company,
        subscribers,
        message,
        created_at: createdAt,
        source_page: source,
        notified_at: null,
      }
      : await env.DB.prepare(
        "SELECT email, name, company, subscribers, message, created_at, source_page, notified_at FROM isp_inquiries WHERE email = ?",
      ).bind(email).first();
    const notified = row && !row.notified_at
      ? await deliver(env, "isp_inquiries", row.email, ISP_SUBJECT, ispNotice(row), row.email)
      : Boolean(row && row.notified_at);
    console.log(JSON.stringify({ message: "signup_saved", form: "isp", new_row: isNew, notified }));
    return succeed(request, COPY.ispThanks, source || back);
  } catch (error) {
    console.error(JSON.stringify({
      message: "signup_failed",
      form,
      error: error instanceof Error ? error.message : "failed",
    }));
    return fail(request, 500, COPY.tryAgain, back);
  }
}
