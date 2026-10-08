/* HonestPing: "What could you be overpaying?" estimate (example values, no network calls).
   Same formula as the 7-day report: monthly bill x (1 - typical / plan), 0 when typical >= plan. */
(function () {
  var form = document.querySelector("[data-savings-demo]");
  if (!form) return;
  var bill = document.getElementById("sv-bill");
  var plan = document.getElementById("sv-plan");
  var typ = document.getElementById("sv-typical");
  var range = document.getElementById("sv-typical-range");
  var outMonth = document.getElementById("sv-month");
  var outYear = document.getElementById("sv-year");
  var outShare = document.getElementById("sv-share");
  if (!bill || !plan || !typ || !range || !outMonth || !outYear || !outShare) return;

  [bill, plan, typ, range].forEach(function (el) { el.disabled = false; });

  function num(el, lo, hi) {
    var v = parseFloat(el.value);
    if (!isFinite(v)) return null;
    return Math.min(hi, Math.max(lo, v));
  }
  function money(v) {
    if (v > 0 && v < 10) return "$" + v.toFixed(2);
    return "$" + Math.round(v).toLocaleString("en-US");
  }

  function gap(b, p, t) {
    if (!(p > 0) || t >= p) return 0;
    return b * (1 - t / p);
  }
  window.HonestPingSavings = { gap: gap }; // exposed for checks

  function update() {
    var b = num(bill, 0, 1000), p = num(plan, 1, 10000), t = num(typ, 0, 10000);
    if (b === null || p === null || t === null) {
      outMonth.textContent = "$0"; outYear.textContent = "$0";
      outShare.textContent = "Enter your bill, plan speed, and typical speed.";
      return;
    }
    range.max = String(Math.round(p));
    if (document.activeElement !== range) range.value = String(Math.min(t, p));
    var m = gap(b, p, t);
    outMonth.textContent = money(m);
    outYear.textContent = money(m * 12);
    var share = Math.round((t / p) * 100);
    outShare.textContent = t >= p
      ? "You’re getting your plan speed or better, so there’s no gap to estimate."
      : "Typical speed is " + share + "% of your plan.";
  }

  range.addEventListener("input", function () { typ.value = range.value; update(); });
  [bill, plan, typ].forEach(function (el) { el.addEventListener("input", update); });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  update();
})();
