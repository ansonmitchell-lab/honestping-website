/* Stays <go-live date> until the owner says go. The same words are the initial text of every [data-policy-updated] element. */
var HONESTPING_POLICY_UPDATED = "<go-live date>";

(function () {
  var nodes = document.querySelectorAll("[data-policy-updated]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].textContent = HONESTPING_POLICY_UPDATED;
  }
})();
