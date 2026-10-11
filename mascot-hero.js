/* Hero side leap: one hop when the controller starts it, then the still pose. */
(function () {
  var img = document.querySelector("[data-mascot='hero'] img");
  if (!img) return;
  var DUR = 2.0;
  function draw(t) {
    var u = t <= 0 ? 0 : Math.min(1, t / DUR);
    var y = (u <= 0 || u >= 1) ? 0 : -33 * Math.sin(Math.PI * u);
    img.style.transform = y ? "translate3d(0," + y.toFixed(2) + "%,0)" : "none";
  }
  draw(0);
  window.HonestPingHero = { draw: draw, restTime: 0, loop: DUR, once: true };
})();
