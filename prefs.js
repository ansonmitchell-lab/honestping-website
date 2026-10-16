/* UI preferences stay on this device. localStorage only.
   Nothing here is sent to analytics or any other server.

   Nav targets. The speed test page is /test/ once it is published.
   This home preview has no /test/ page, so that host uses the speed test preview. */
var NAV_LINKS = {
  speedTest: "/test/",
  speedTestPreview: "https://preview-web-speedtest.honestping.pages.dev/test/?variant=app"
};

(function () {
  function reduceOn() {
    return document.documentElement.classList.contains("hp-reduce");
  }

  function label() {
    var btn = document.getElementById("motion-pref");
    if (!btn) return;
    var on = reduceOn();
    btn.textContent = on ? "Show animations" : "Fewer animations";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function ready() {
    label();
    var motion = document.getElementById("motion-pref");
    if (motion) {
      motion.addEventListener("click", function () {
        var on = !reduceOn();
        try {
          if (on) localStorage.setItem("hp-reduce-motion", "1");
          else localStorage.removeItem("hp-reduce-motion");
        } catch (e) {}
        location.reload();
      });
    }
    var hide = document.getElementById("free-bar-dismiss");
    if (hide) {
      hide.addEventListener("click", function () {
        try { localStorage.setItem("hp-free-bar", "off"); } catch (e) {}
        document.documentElement.classList.add("hp-bar-off");
      });
    }
    var speed = document.querySelector("[data-nav='speed-test']");
    if (speed) {
      var href = NAV_LINKS.speedTest;
      if (location.hostname === "preview-gaming-7day.honestping.pages.dev") href = NAV_LINKS.speedTestPreview;
      speed.setAttribute("href", href);
    }
    var menu = document.querySelector(".nav-menu");
    var nav = document.querySelector(".nav");
    if (menu && nav) {
      menu.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        menu.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
