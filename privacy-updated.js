/* Change this date on merge day. The same words are the initial text of every [data-policy-updated] element. */
var HONESTPING_POLICY_UPDATED = "October 8, 2026";

(function () {
  var nodes = document.querySelectorAll("[data-policy-updated]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = HONESTPING_POLICY_UPDATED;
  }
})();
