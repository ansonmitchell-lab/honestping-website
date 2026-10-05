(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  var form = document.getElementById("waitlist-form");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var emailInput = document.getElementById("waitlist-email");
    var email = ((emailInput && emailInput.value) || "").trim();
    if (!email) {
      if (emailInput) emailInput.focus();
      return;
    }
    var subject = encodeURIComponent("HonestPing waitlist");
    var body = encodeURIComponent(
      "Please add me to the HonestPing waitlist.\n\nEmail: " + email + "\n"
    );
    window.location.href =
      "mailto:hello@honestping.com?subject=" + subject + "&body=" + body;
  });
})();
