(function () {
  var video = document.getElementById("week-demo-video");
  var button = document.getElementById("week-demo-toggle");
  if (!video || !button) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function label() {
    button.textContent = video.paused ? "Play" : "Pause";
  }

  button.addEventListener("click", function () {
    if (video.paused) {
      var pending = video.play();
      if (pending && pending.catch) pending.catch(label);
    } else {
      video.pause();
    }
  });

  video.addEventListener("play", label);
  video.addEventListener("pause", label);

  if (!reduce) {
    var pending = video.play();
    if (pending && pending.catch) pending.catch(label);
  }
  label();
})();
