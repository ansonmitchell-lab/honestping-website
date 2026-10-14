const USER_PATH_WIN = /[A-Za-z]:\\Users\\[^\\\r\n]*/g;
const USER_PATH_SLASH = /[A-Za-z]:\/Users\/[^/\r\n]*/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const MAC = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;
const MAC_DOT = /\b[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\b/g;
const UNC = /\\\\[A-Za-z0-9._-]{1,64}\\/g;
const MACHINE = /\b(?:DESKTOP|LAPTOP|WIN)-[A-Z0-9]{4,}\b/gi;
const MACHINE_LABEL = /\b(?:computer(?:\s*name)?|machine(?:\s*name)?|device\s+name)\s*[:=]\s*(?:"[^"\n]{1,64}"|'[^'\n]{1,64}'|[^\s,;]{1,64})/gi;
const INSTALL = /\b(?:install(?:ation)?[\s_-]*(?:id|key)|machine[\s_-]*id|device[\s_-]*id)\s*[:=]\s*(?:"[^"\n]{1,80}"|'[^'\n]{1,80}'|\S{1,80})/gi;
const SSID = /\b(?:ssid|bssid|wi-?fi(?:\s+network)?|wireless\s+network)\s*[:=]\s*(?:"[^"\n]{1,64}"|'[^'\n]{1,64}'|[^\s,;]{1,64})/gi;
const LABELED_VALUE = /(?:"[^"\n]{1,80}"|'[^'\n]{1,80}'|[^\s,;:]{1,40}(?:\s+[^\s,;:]{1,40}){0,3})/;
const ISP = new RegExp(`\\b(?:isp(?:\\s+name)?|internet\\s+service\\s+provider)\\s*[:=]\\s*${LABELED_VALUE.source}`, "gi");
const HOST_LABEL = /\b(?:host(?:\s*name)?|dns\s+name|fqdn)\s*[:=]\s*(?:"[^"\n]{1,253}"|'[^'\n]{1,253}'|[^\s,;]{1,253})/gi;
const FQDN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:local|lan|home|internal|arpa|com|net|org|io|dev)\b/g;
const PRIVATE_V4 = /\b(?:(?:10|127)(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g;
const PUBLIC_V4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const PRIVATE_V6 = /\b(?:fe[89ab][0-9a-f]?:[0-9a-f:]*|f[cd][0-9a-f]{0,2}:[0-9a-f:]*)/gi;

const STRIP_KEYS = new Set([
  "installid",
  "installkey",
  "installationid",
  "installationkey",
  "machineid",
  "deviceid",
  "ssid",
  "wifissid",
  "bssid",
  "networkname",
  "wifinetwork",
  "hostname",
  "host",
  "machinename",
  "computername",
  "machine",
  "isp",
  "ispname",
  "isporg",
  "provider",
  "ip",
  "publicip",
  "privateip",
  "localip",
  "clientip",
  "remoteaddr",
]);

function replaceLoopback(value) {
  return value.replace(/(^|[^:0-9A-Fa-f])::1\b/g, "$1[private-ip]");
}

function replaceIpv6(value) {
  return value.replace(/(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}/gi, (token) => {
    const colons = (token.match(/:/g) || []).length;
    if (colons >= 2 && (token.includes("::") || colons >= 7 || /[a-f]/i.test(token))) return "[ip]";
    return token;
  });
}

export function isStrippedField(key) {
  return STRIP_KEYS.has(String(key).toLowerCase().replace(/[^a-z0-9]/g, ""));
}

export function redactText(value) {
  if (typeof value !== "string" || !value) return typeof value === "string" ? value : "";
  const cleaned = value
    .replace(USER_PATH_WIN, "[user]")
    .replace(USER_PATH_SLASH, "[user]")
    .replace(EMAIL, "[email]")
    .replace(MAC, "[mac]")
    .replace(MAC_DOT, "[mac]")
    .replace(UNC, "[machine]\\")
    .replace(INSTALL, "[install]")
    .replace(SSID, "[ssid]")
    .replace(ISP, "[isp]")
    .replace(MACHINE_LABEL, "[machine]")
    .replace(MACHINE, "[machine]")
    .replace(HOST_LABEL, "[host]")
    .replace(FQDN, "[host]")
    .replace(PRIVATE_V4, "[private-ip]")
    .replace(PUBLIC_V4, "[ip]")
    .replace(PRIVATE_V6, "[private-ip]");
  return replaceIpv6(replaceLoopback(cleaned));
}
