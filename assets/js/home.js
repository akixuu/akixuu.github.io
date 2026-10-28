(function () {
  "use strict";

  var field = document.querySelector("[data-home-field]");
  var canvas = document.getElementById("home-field");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var probe = document.createElement("canvas").getContext("2d");

  if (field && canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
    var nodes = [];
    var lineStyles = [];
    var nodeStyle = "rgba(236,230,245,0.9)";
    var gridStyle = "rgba(236,230,245,0.06)";
    var w = 0;
    var h = 0;
    var running = false;
    var visible = true;
    var raf = 0;
    var pointer = { x: -9999, y: -9999, on: false };

    function readColor() {
      if (!probe) return;
      probe.fillStyle = getComputedStyle(document.body).color || "#ece6f5";
      var hex = probe.fillStyle;
      var rgb = "236,230,245";
      if (hex && hex.charAt(0) === "#" && hex.length >= 7) {
        var n = parseInt(hex.slice(1, 7), 16);
        rgb = ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
      }
      nodeStyle = "rgba(" + rgb + ",0.92)";
      gridStyle = "rgba(" + rgb + ",0.11)";
      lineStyles = [];
      for (var i = 1; i <= 5; i++) {
        lineStyles.push("rgba(" + rgb + "," + (0.1 + i * 0.07).toFixed(3) + ")");
      }
    }

    function seed() {
      var count = Math.max(28, Math.min(48, Math.round((w * h) / 9000)));
      var next = [];
      for (var i = 0; i < count; i++) {
        var prev = nodes[i];
        next.push({
          x: prev ? prev.x : Math.random(),
          y: prev ? prev.y : Math.random(),
          p: prev ? prev.p : Math.random() * Math.PI * 2,
          s: prev ? prev.s : 0.65 + Math.random() * 0.7
        });
      }
      nodes = next;
    }

    function draw(ts) {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var motion = !reduce.matches;
      var t = (ts || 0) * 0.001;
      var gap = 32;
      var pts = new Array(nodes.length);
      var i;
      var j;

      ctx.beginPath();
      ctx.strokeStyle = gridStyle;
      ctx.lineWidth = 1;
      for (var x = gap; x < w; x += gap) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (var y = gap; y < h; y += gap) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();

      for (i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        var px = a.x * w;
        var py = a.y * h;
        if (motion) {
          px += Math.sin(t * 0.42 + a.p) * 8 * a.s;
          py += Math.cos(t * 0.33 + a.p) * 8 * a.s;
          if (pointer.on) {
            var dxp = px - pointer.x;
            var dyp = py - pointer.y;
            var distp = Math.hypot(dxp, dyp) || 1;
            if (distp < 130) {
              var push = (1 - distp / 130) * 16;
              px += (dxp / distp) * push;
              py += (dyp / distp) * push;
            }
          }
        }
        pts[i] = [px, py];
      }

      var reach = Math.min(w, h) * 0.3;
      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          var dx = pts[i][0] - pts[j][0];
          var dy = pts[i][1] - pts[j][1];
          var dist = Math.hypot(dx, dy);
          if (dist < reach) {
            var bucket = Math.min(4, Math.floor((1 - dist / reach) * 5));
            ctx.strokeStyle = lineStyles[bucket];
            ctx.beginPath();
            ctx.moveTo(pts[i][0], pts[i][1]);
            ctx.lineTo(pts[j][0], pts[j][1]);
            ctx.stroke();
          }
        }
      }

      ctx.strokeStyle = nodeStyle;
      ctx.lineWidth = 1.25;
      for (i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (!running) draw(0);
    }

    function frame(ts) {
      if (!running) return;
      draw(ts);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduce.matches || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    field.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.on = true;
    }, { passive: true });

    field.addEventListener("pointerleave", function () {
      pointer.on = false;
    });

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(field);
    } else {
      window.addEventListener("resize", resize);
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      }, { threshold: 0.04 }).observe(field);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    new MutationObserver(function () {
      readColor();
      if (!running) draw(0);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme"]
    });

    if (reduce.addEventListener) {
      reduce.addEventListener("change", function () {
        if (reduce.matches) {
          stop();
          draw(0);
        } else {
          start();
        }
      });
    }

    readColor();
    resize();
    start();
    }
  }

  var reveals = document.querySelectorAll("[data-reveal]");
  if (!reveals.length) return;

  if (reduce.matches || !window.IntersectionObserver) {
    for (var r = 0; r < reveals.length; r++) reveals[r].classList.add("is-in");
    return;
  }

  var rio = new IntersectionObserver(function (entries) {
    for (var k = 0; k < entries.length; k++) {
      if (!entries[k].isIntersecting) continue;
      entries[k].target.classList.add("is-in");
      rio.unobserve(entries[k].target);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });

  for (var n = 0; n < reveals.length; n++) rio.observe(reveals[n]);
})();
