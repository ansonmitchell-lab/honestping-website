(function () {
  var form = document.getElementById("isp-contact-form");
  if (!form) return;

  var SITEKEY = "0x4AAAAAAFQof7EbIcyPa73s";
  var widgetId = null;
  var pending = false;
  var button = form.querySelector("button[type='submit']");

  var mount = document.getElementById("isp-turnstile");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "isp-turnstile";
    mount.className = "ispx-turnstile ispx-full";
    form.insertBefore(mount, button);
  }
  var error = document.getElementById("isp-error");
  if (!error) {
    error = document.createElement("p");
    error.id = "isp-error";
    error.className = "waitlist-error ispx-full";
    error.setAttribute("role", "alert");
    error.hidden = true;
    form.insertBefore(error, button);
  }
  var thanks = document.getElementById("isp-thanks");
  if (!thanks) {
    thanks = document.createElement("p");
    thanks.id = "isp-thanks";
    thanks.className = "waitlist-thanks ispx-full";
    thanks.setAttribute("role", "status");
    thanks.hidden = true;
    form.insertBefore(thanks, button);
  }

  function value(id) {
    var el = document.getElementById(id);
    return ((el && el.value) || "").trim();
  }

  function showError(message) {
    error.hidden = false;
    error.textContent = message;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[src*='challenges.cloudflare.com/turnstile']");
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("turnstile")); });
        return;
      }
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
    if (!window.turnstile) return;
    widgetId = window.turnstile.render(mount, {
      sitekey: SITEKEY,
      action: "isp",
      theme: "dark"
    });
  }).catch(function () {
    showError("The check could not load. You can still email hello@honestping.com.");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (pending) return;
    var required = ["ic-name", "ic-company", "ic-email", "ic-message"];
    for (var i = 0; i < required.length; i++) {
      var el = document.getElementById(required[i]);
      if (!value(required[i]) || (el && el.type === "email" && el.checkValidity && !el.checkValidity())) {
        if (el) {
          el.focus();
          if (el.reportValidity) el.reportValidity();
        }
        return;
      }
    }
    var token = window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : "";
    if (!token) {
      showError("Please confirm you're a person, then try again.");
      return;
    }
    pending = true;
    error.hidden = true;
    if (button) button.disabled = true;
    fetch("/api/isp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        name: value("ic-name"),
        company: value("ic-company"),
        email: value("ic-email"),
        subscribers: value("ic-subs"),
        message: value("ic-message"),
        "cf-turnstile-response": token,
        source_page: window.location.pathname || "/isp"
      })
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; }, function () { return { ok: false, data: null }; });
    }).then(function (result) {
      resetWidget();
      if (!result.ok || !result.data || !result.data.ok) {
        showError((result.data && result.data.error) || "Something went wrong. Please try again, or email hello@honestping.com.");
        return;
      }
      thanks.hidden = false;
      thanks.textContent = result.data.message || "Thanks. We'll reply to you about partnering.";
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
