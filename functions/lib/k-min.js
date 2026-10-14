export const DEFAULT_K_MIN = 10;

export function resolveKMin(value) {
  if (value == null || value === "") return DEFAULT_K_MIN;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < 2 || number > 100) return DEFAULT_K_MIN;
  return number;
}

export function showGroupCount(count, kMin = DEFAULT_K_MIN) {
  const number = Number(count);
  if (!Number.isFinite(number)) return null;
  const whole = Math.trunc(number);
  if (whole < resolveKMin(kMin)) return null;
  return whole;
}
