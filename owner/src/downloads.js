const RELEASES = "https://api.github.com/repos/";

export function parseRepo(value) {
  if (typeof value !== "string") return null;
  const repo = value.trim();
  if (!repo || repo.length > 120) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;
  if (owner.includes("..") || name.includes("..")) return null;
  return repo;
}

export async function loadDownloads(env, fetchImpl = fetch) {
  const repo = parseRepo(env && env.GITHUB_REPO);
  if (!repo) return { connected: false };
  try {
    const response = await fetchImpl(`${RELEASES}${repo}/releases?per_page=20`, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "HonestPingOwner/1.0",
      },
    });
    if (!response) return { connected: true, error: true, groups: [] };
    if (response.status === 404) return { connected: true, empty: true, missing: true, groups: [] };
    if (response.status !== 200) return { connected: true, error: true, groups: [] };
    const text = await response.text();
    if (!text || text.length > 1000000) return { connected: true, error: true, groups: [] };
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return { connected: true, error: true, groups: [] };
    const groups = [];
    for (const release of data) {
      const tag = release && release.tag_name ? String(release.tag_name) : "Release";
      const assets = release && Array.isArray(release.assets) ? release.assets : [];
      for (const asset of assets) {
        const name = asset && asset.name ? String(asset.name) : "file";
        const count = Number(asset && asset.download_count);
        groups.push({
          label: `${tag} ${name}`.slice(0, 180),
          count: Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0,
        });
      }
    }
    return {
      connected: true,
      empty: data.length === 0,
      noFiles: data.length > 0 && groups.length === 0,
      groups,
    };
  } catch {
    return { connected: true, error: true, groups: [] };
  }
}
