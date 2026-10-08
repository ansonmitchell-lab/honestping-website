import { getPlatformProxy } from "wrangler";
import { applyIspMigrations } from "../src/migrate.js";
import { seedExample } from "./seed-lib.js";

const proxy = await getPlatformProxy({
  configPath: "isp/wrangler.jsonc",
  environment: "preview",
  remoteBindings: false,
  envFiles: [],
  persist: { path: ".wrangler/state/isp-preview" },
});
try {
  await applyIspMigrations(proxy.env.DB);
  const result = await seedExample(proxy.env.DB);
  console.log(JSON.stringify({ seeded: true, ...result }));
} finally {
  await proxy.dispose();
}
