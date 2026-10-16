/* Example call. Two people, a wave, then a shared check. No network calls. */
(function () {
  var root = document.querySelector("[data-call-demo]");
  if (!root) return;
  var you = root.querySelector("[data-you-meter]");
  var them = root.querySelector("[data-them-meter]");
  var side = root.querySelector("[data-call-side]");
  var wave = root.querySelector("[data-call-wave]");
  var person = root.querySelector("[data-call-them]");
  if (!you || !them || !side || !wave || !person) return;

  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var timer = 0;
  var run = 0;
  var STEP = [1500, 1200, 2200];

  function paint(state) {
    root.setAttribute("data-state", state);
    you.textContent = "Steady";
    you.classList.remove("is-bad");
    if (state === "steady") {
      them.textContent = "Steady";
      them.classList.remove("is-bad");
      person.classList.remove("is-glitch");
      wave.classList.remove("is-glitch");
      wave.classList.add("is-smooth");
      side.textContent = "Both sides look steady.";
      return;
    }
    them.textContent = "Glitching";
    them.classList.add("is-bad");
    person.classList.add("is-glitch");
    wave.classList.remove("is-smooth");
    wave.classList.add("is-glitch");
    side.textContent = state === "shared"
      ? "The problem is on your coworker\u2019s side."
      : "The wave just broke up.";
  }

  function stop() {
    run++;
    clearTimeout(timer);
  }

  function showStill() {
    stop();
    paint("shared");
  }

  function loop() {
    var myRun = ++run;
    clearTimeout(timer);
    var states = ["steady", "glitch", "shared"];
    var i = 0;
    function next() {
      if (myRun !== run) return;
      paint(states[i]);
      timer = setTimeout(function () {
        if (myRun !== run) return;
        i = (i + 1) % states.length;
        if (i === 0) loop();
        else next();
      }, STEP[i]);
    }
    next();
  }

  function update() {
    if ((motion && motion.matches) || document.hidden) {
      if (motion && motion.matches) showStill();
      else stop();
      return;
    }
    loop();
  }

  if (motion) {
    if (motion.addEventListener) motion.addEventListener("change", update);
    else if (motion.addListener) motion.addListener(update);
  }
  document.addEventListener("visibilitychange", update);

  if (motion && motion.matches) {
    showStill();
    return;
  }

  if ("IntersectionObserver" in window) {
    var seen = false;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0] || !entries[0].isIntersecting) {
        if (!(motion && motion.matches)) stop();
        return;
      }
      if (!seen || !(motion && motion.matches)) update();
      seen = true;
    }, { threshold: 0.35 });
    io.observe(root);
  } else {
    update();
  }
})();
