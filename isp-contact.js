(function () {
  var form = document.getElementById("isp-contact-form");
  if (!form) return;
  function v(id) { var el = document.getElementById(id); return ((el && el.value) || "").trim(); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var req = ["ic-name", "ic-company", "ic-email", "ic-message"];
    for (var i = 0; i < req.length; i++) {
      var el = document.getElementById(req[i]);
      if (!v(req[i]) || (el.type === "email" && !el.checkValidity())) { el.focus(); if (el.reportValidity) el.reportValidity(); return; }
    }
    var body = "Name: " + v("ic-name") + "\nCompany: " + v("ic-company") + "\nWork email: " + v("ic-email") +
      "\nApproximate subscribers: " + (v("ic-subs") || "Not given") + "\n\n" + v("ic-message") + "\n";
    window.location.href = "mailto:hello@honestping.com?subject=" + encodeURIComponent("ISP partnership") +
      "&body=" + encodeURIComponent(body);
  });
})();
