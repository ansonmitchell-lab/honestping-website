import http from "node:http";
import { getPlatformProxy } from "wrangler";
import { handleIspRequest } from "../src/index.js";
import { applyIspMigrations } from "../src/migrate.js";
import { seedExample } from "./seed-lib.js";

const port = Number(process.env.PORT || 8791);
const proxy = await getPlatformProxy({
  configPath: "isp/wrangler.jsonc",
  remoteBindings: false,
  envFiles: [],
  persist: { path: ".wrangler/state/isp-preview" },
});
await applyIspMigrations(proxy.env.DB);
await seedExample(proxy.env.DB);
const env = {
  ...proxy.env,
  ALLOW_ISP_PREVIEW: "1",
  ISP_PREVIEW_OPEN: "1",
  ISP_PREVIEW_ORG: "example-isp",
  KEEP_ISP_PRIVATE_HOPS: "true",
  K_MIN: "10",
  HOUSEHOLD_SALT: "preview-example-salt",
};

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `127.0.0.1:${port}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  if (!headers.has("origin")) headers.set("origin", `http://${host}`);
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await handleIspRequest(request, env);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === "content-encoding") return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ISP preview example at http://127.0.0.1:${port}/isp-preview/support`);
});
