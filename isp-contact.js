(function () {
  var form = document.getElementById("isp-contact-form");
  if (!form) return;
  var status = document.getElementById("isp-status");
  var fields = ["ic-name", "ic-company", "ic-email", "ic-message"];

  function v(id) {
    var el = document.getElementById(id);
    return ((el && el.value) || "").trim();
  }

  function say(msg, bad) {
    if (!status) return;
    status.hidden = false;
    status.textContent = msg;
    status.className = "form-status ispx-full" + (bad ? " is-error" : " is-ok");
  }

  fields.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("aria-describedby", "isp-status");
    el.addEventListener("input", function () {
      if (status && status.classList.contains("is-error")) status.hidden = true;
    });
    el.addEventListener("invalid", function (event) {
      event.preventDefault();
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var i;
    for (i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (!el) continue;
      if (!v(fields[i]) || (el.type === "email" && !el.checkValidity())) {
        say(el.type === "email" && v(fields[i])
          ? "That work email looks incomplete."
          : "Add your name, company, work email, and a short message.", true);
        el.focus();
        return;
      }
    }
    var body = "Name: " + v("ic-name") + "\nCompany: " + v("ic-company") + "\nWork email: " + v("ic-email") +
      "\nApproximate subscribers: " + (v("ic-subs") || "Not given") + "\n\n" + v("ic-message") + "\n";
    say("Your email app should open with a note to hello@honestping.com. If it doesn’t, use the address below.", false);
    window.location.href = "mailto:hello@honestping.com?subject=" + encodeURIComponent("ISP partnership") +
      "&body=" + encodeURIComponent(body);
  });
})();
