import { isIspPrivateScope, scopeOfIp } from "./ip.js";

export function keepIspPrivateHops(env) {
  const value = env && Object.prototype.hasOwnProperty.call(env, "KEEP_ISP_PRIVATE_HOPS")
    ? env.KEEP_ISP_PRIVATE_HOPS
    : undefined;
  if (value == null || value === "") return true;
  return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

export function effectiveScope(hop) {
  if (hop.ip) return scopeOfIp(hop.ip);
  if (hop.scope === "private" || hop.scope === "cgnat" || hop.scope === "public" || hop.scope === "link_local" || hop.scope === "none") {
    return hop.scope;
  }
  return "none";
}

// The hop the app marked as the customer router, or the last private hop
// before the first public or CGNAT hop when the app left the role off.
export function routerTtl(hops) {
  const marked = hops.find((hop) => hop.role === "home_router");
  if (marked) return marked.ttl;
  let lastHome = null;
  const ordered = [...hops].sort((a, b) => a.ttl - b.ttl);
  for (const hop of ordered) {
    const scope = effectiveScope(hop);
    if (scope === "public" || scope === "cgnat") break;
    if (scope === "private" || scope === "link_local" || hop.role === "home_lan") lastHome = hop.ttl;
  }
  return lastHome;
}

function warning(code, ttl) {
  return {
    code,
    detail: `Hop ttl ${ttl} ${code === "home_hop_unredacted"
      ? "carried an address at or before the customer router and was redacted before storage."
      : code === "isp_private_killed"
        ? "is inside the provider network and was redacted because KEEP_ISP_PRIVATE_HOPS is off."
        : "used a link-local address and was redacted before storage."}`,
  };
}

// Fixed rule: the customer router and every hop before it lose their address.
// Later ISP private and CGNAT hops stay, flagged, unless the kill switch is off.
export function redactHops(hops, options = {}) {
  const keep = options.keepIspPrivate !== false;
  const boundary = routerTtl(hops);
  const warnings = [];
  const cleaned = hops.map((hop) => {
    const scope = effectiveScope(hop);
    const atOrBeforeRouter = boundary != null && hop.ttl <= boundary;
    const markedHome = hop.role === "home_router" || hop.role === "home_lan";
    if (markedHome || atOrBeforeRouter) {
      if (hop.ip) warnings.push(warning("home_hop_unredacted", hop.ttl));
      const role = hop.role === "home_router" || hop.ttl === boundary ? "home_router" : "home_lan";
      return {
        ...hop,
        role,
        scope: scope === "none" ? "none" : (scope === "link_local" ? "link_local" : "private"),
        ip: null,
        redacted: true,
        isp_private: false,
      };
    }
    if (scope === "link_local") {
      if (hop.ip) warnings.push(warning("link_local_redacted", hop.ttl));
      return { ...hop, scope, ip: null, redacted: true, isp_private: false };
    }
    if (isIspPrivateScope(scope)) {
      if (!keep) {
        if (hop.ip) warnings.push(warning("isp_private_killed", hop.ttl));
        return { ...hop, scope, ip: null, redacted: true, isp_private: false };
      }
      return { ...hop, scope, ip: hop.ip, redacted: false, isp_private: true };
    }
    return { ...hop, scope, ip: hop.ip || null, redacted: false, isp_private: false };
  });
  return { hops: cleaned, warnings };
}

export function scrubAddresses(text) {
  return String(text).replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g, "[address]");
}
