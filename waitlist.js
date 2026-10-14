(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  var form = document.getElementById("waitlist-form");
  if (!form) return;

  var SITEKEY = "0x4AAAAAAFQof7EbIcyPa73s";
  var widgetId = null;
  var pending = false;
  var thanks = document.getElementById("waitlist-thanks");
  var error = document.getElementById("waitlist-error");
  var mount = document.getElementById("waitlist-turnstile");

  function showError(message) {
    if (!error) return;
    error.hidden = false;
    error.textContent = message;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("turnstile")); };
      document.head.appendChild(script);
    });
  }

  function resetWidget() {
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  loadTurnstile().then(function () {
    if (!mount || !window.turnstile) return;
    widgetId = window.turnstile.render(mount, {
      sitekey: SITEKEY,
      action: "waitlist",
      theme: "dark"
    });
  }).catch(function () {
    showError("The check could not load. You can still email hello@honestping.com.");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (pending) return;
    var emailInput = document.getElementById("waitlist-email");
    var email = ((emailInput && emailInput.value) || "").trim();
    if (!email || (emailInput && emailInput.checkValidity && !emailInput.checkValidity())) {
      if (emailInput) {
        emailInput.focus();
        if (emailInput.reportValidity) emailInput.reportValidity();
      }
      return;
    }
    var token = window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : "";
    if (!token) {
      showError("Please confirm you're a person, then try again.");
      return;
    }
    pending = true;
    if (error) error.hidden = true;
    var button = form.querySelector("button");
    if (button) button.disabled = true;
    fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: email,
        "cf-turnstile-response": token,
        source_page: window.location.pathname || "/"
      })
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; }, function () { return { ok: false, data: null }; });
    }).then(function (result) {
      resetWidget();
      if (!result.ok || !result.data || !result.data.ok) {
        showError((result.data && result.data.error) || "Something went wrong. Please try again, or email hello@honestping.com.");
        return;
      }
      if (thanks) {
        thanks.hidden = false;
        thanks.textContent = result.data.message || "You're on the list. We'll email you when HonestPing is ready.";
      }
      form.classList.add("is-done");
    }).catch(function () {
      resetWidget();
      showError("Something went wrong. Please try again, or email hello@honestping.com.");
    }).then(function () {
      pending = false;
      if (button && !form.classList.contains("is-done")) button.disabled = false;
    });
  });
})();
