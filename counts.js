(function () {
  var clamp = function (value) {
    return Math.min(1, Math.max(0, value));
  };
  var format = function (value) {
    return new Intl.NumberFormat("en-US").format(value);
  };
  var tick = function () {
    var house = document.querySelector(".shot-house");
    if (!house) return;
    var view = window.innerHeight || 1;
    var fill = clamp((view * 0.75 - house.getBoundingClientRect().top) / (view * 0.5));
    var nodes = document.querySelectorAll("[data-target]");
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var target = Number(node.getAttribute("data-target"));
      var order = Number(node.getAttribute("data-order") || 0);
      var local = clamp((fill - order * 0.12) / 0.5);
      if (isFinite(target)) node.textContent = format(Math.round(target * local));
      node.setAttribute("data-written", "1");
      var bar = node.parentElement && node.parentElement.querySelector("[data-bar]");
      if (bar) bar.style.transform = "scaleX(" + local + ")";
    }
  };
  var frame = 0;
  var loop = function () {
    frame = requestAnimationFrame(loop);
    tick();
  };
  loop();
  window.addEventListener("scroll", tick, { passive: true });
})();
