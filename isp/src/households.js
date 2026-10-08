// One floor for area counts, node alerts, and node suggestions.
// The owner has not picked the final number. 10 is the default until then.
export const K_MIN_DEFAULT = 10;

export function resolveKMin(value) {
  if (value == null || value === "") return K_MIN_DEFAULT;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 100) return K_MIN_DEFAULT;
  return parsed;
}

export function kMin(env) {
  return resolveKMin(env && env.K_MIN);
}

export async function householdHash(ispOrg, salt, reportId) {
  const material = `${ispOrg}|${salt || "preview-example-salt"}|${reportId}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function distinctHouseholds(hashes) {
  return new Set((hashes || []).filter((hash) => typeof hash === "string" && hash.length > 0)).size;
}

// Area totals shown to a tech. Under K_MIN households the count is omitted.
export function presentHouseholds(hashes, min = K_MIN_DEFAULT) {
  const floor = resolveKMin(min);
  const count = distinctHouseholds(hashes);
  if (count < floor) return { visible: false, count: null };
  return { visible: true, count };
}

export function areaSentence(count, nodeName, min = K_MIN_DEFAULT) {
  const floor = resolveKMin(min);
  if (count == null || count < floor || !nodeName) return null;
  const noun = count === 1 ? "household" : "households";
  return `${count} ${noun} on ${nodeName} dipped in this 7-day report window.`;
}
