/* Draft preview date for the website speed test. Change this date on merge day. The same words are the initial text of every [data-policy-updated] element. History dates are plain text so this script does not rewrite them. */
var HONESTPING_POLICY_UPDATED = "October 14, 2026";

(function () {
  var nodes = document.querySelectorAll("[data-policy-updated]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = HONESTPING_POLICY_UPDATED;
  }
})();
