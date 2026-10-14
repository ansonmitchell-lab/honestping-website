(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  var form = document.getElementById("waitlist-form");
  if (!form) return;

  var emailInput = document.getElementById("waitlist-email");
  var status = document.getElementById("waitlist-status");

  function say(msg, bad) {
    if (!status) return;
    status.hidden = false;
    status.textContent = msg;
    status.className = "form-status" + (bad ? " is-error" : " is-ok");
  }

  if (emailInput) {
    emailInput.addEventListener("input", function () {
      emailInput.setCustomValidity("");
      if (status && status.classList.contains("is-error")) status.hidden = true;
    });
    emailInput.addEventListener("invalid", function (event) {
      event.preventDefault();
      var missing = emailInput.validity.valueMissing;
      say(missing ? "Enter an email address." : "That email address looks incomplete.", true);
      emailInput.focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    /* No intake server. Stay on this page and hand the note to the mail app. */
    var email = ((emailInput && emailInput.value) || "").trim();
    if (!emailInput || !email || !emailInput.checkValidity()) {
      if (emailInput) emailInput.reportValidity();
      return;
    }
    var subject = encodeURIComponent("HonestPing waitlist");
    var body = encodeURIComponent(
      "Please add me to the HonestPing waitlist.\n\nEmail: " + email + "\n"
    );
    say("Your email app should open with a waitlist note. If it doesn’t, write to hello@honestping.com.", false);
    window.location.href =
      "mailto:hello@honestping.com?subject=" + subject + "&body=" + body;
  });
})();
