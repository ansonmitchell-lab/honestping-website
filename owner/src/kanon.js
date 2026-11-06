export const MIN_GROUP = 5;

export function suppressSmallGroups(groups) {
  const visible = [];
  let hiddenCount = 0;
  let hiddenGroups = 0;
  for (const group of groups || []) {
    const count = Number(group && group.count);
    if (!Number.isFinite(count) || count <= 0) continue;
    const whole = Math.trunc(count);
    if (whole >= MIN_GROUP) {
      const label = group.label == null ? "" : String(group.label);
      visible.push({ label, count: whole, hidden: false });
    } else {
      hiddenCount += whole;
      hiddenGroups += 1;
    }
  }
  if (hiddenGroups > 0) {
    visible.push({
      label: "Hidden",
      count: hiddenCount >= MIN_GROUP ? hiddenCount : null,
      hidden: true,
    });
  }
  return visible;
}

export function formatCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 0) return "Hidden";
  const whole = Math.trunc(n);
  if (whole === 0) return "None yet";
  if (whole < MIN_GROUP) return "Hidden";
  return String(whole);
}

export function formatCell(count) {
  if (count == null) return "Hidden";
  return formatCount(count);
}
