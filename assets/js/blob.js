(function () {
  var layer = document.querySelector("[data-blob-layer]");
  if (!layer) return;

  var NS = "http://www.w3.org/2000/svg";
  var TAU = Math.PI * 2;
  var section = layer.parentElement;
  var copy = section.querySelector(".lp-meet-copy");
  var svg = layer.querySelector("[data-blob]");
  var spinGroup = svg.querySelector(".blob-spin");
  var bodyPath = svg.querySelector(".blob-body");
  var legEls = svg.querySelectorAll(".blob-leg");
  var stubEls = svg.querySelectorAll(".blob-stub");
  var eyeEls = svg.querySelectorAll(".blob-eye");
  var lidEls = svg.querySelectorAll(".blob-lid");
  var happyEls = svg.querySelectorAll(".blob-happy");
  var arm = layer.querySelector("[data-blob-arm]");
  var armLines = arm.querySelectorAll(".blob-arm-line");
  var handEls = arm.querySelectorAll(".blob-hand");
  var fx = layer.querySelector("[data-blob-fx]");
  var root = document.documentElement;

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var R = 31;
  var LEG = 7;
  var N = 12;
  var GRAVITY = 2100;
  var HANG_LEN = 26;
  var GRIP = R * 1.05;
  var MAX_PARTS = 40;

  // Section-space layout. left/right/ceil are the viewport edges.
  var W = 0;
  var H = 0;
  var vw = 0;
  var walkMin = 0;
  var walkMax = 0;
  var linksX = 0;
  var linksY = 0;
  var left = 0;
  var right = 0;
  var ceil = 0;

  var b = {
    x: 0, y: 0, vx: 0, vy: 0, dir: -1, face: -1, mode: "rest", until: 0, jump: null,
    phase: 0, walkAmt: 0, targetX: 0, bob: 0, cy: -40, hw: R * 1.16, spin: 0, spinV: 0, round: 0,
    hopTrip: 0, crashes: 0, thrown: false, knock: false
  };
  var squash = { v: 0, d: 0 };
  var jig = [];
  for (var i = 0; i < N; i++) jig.push({ v: 0, d: 0 });
  var lean = 0;
  var stubA = [0.9, 0.9];
  var stubLen = [12, 12];
  var look = { x: 0, y: 0 };
  var blink = { until: 0, next: 2000 };
  var smile = { until: 0, next: 2400 };
  var mood = { name: "neutral", until: 0, next: null };
  var timers = { drop: 0, spark: 0, hop: 0 };

  var pointer = { cx: -9999, cy: -9999, seen: false, moved: 0 };
  var drag = null;
  var grab = null;
  var hovering = null;
  var hoverSince = Infinity;
  var cooldownUntil = 0;
  var hops = 0;
  var linkTurn = 0;
  var hangNext = false;
  var offered = false;
  var parts = [];

  var links = Array.prototype.slice.call(section.querySelectorAll(".lp-mail, .lp-meet-links a")).map(function (el) {
    return { el: el, ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, held: false, home: null };
  });

  var last = 0;
  var raf = 0;
  var visible = false;

  function clamp(v, a, z) { return v < a ? a : v > z ? z : v; }
  function lerp(a, z, k) { return a + (z - a) * k; }
  function damp(a, z, rate, dt) { return lerp(a, z, 1 - Math.exp(-rate * dt)); }
  function rand(a, z) { return a + Math.random() * (z - a); }
  function coin() { return Math.random() < 0.5 ? -1 : 1; }
  function f(n) { return n.toFixed(1); }

  function kick(amount) {
    for (var i = 0; i < N; i++) jig[i].d += (Math.random() - 0.5) * amount;
  }

  // ---------- Mood ----------

  function setMood(name, ms, now, next) {
    mood.name = name;
    mood.until = now + ms;
    mood.next = next || null;
  }

  function moody() { return mood.name === "sad" || mood.name === "tired"; }

  function offeringLink() { return grab && grab.kind === "link"; }

  function updateMood(now) {
    if (hovering && !drag && !offeringLink() && mood.name !== "happy") setMood("excited", 250, now);
    if (mood.name === "neutral" || now <= mood.until) return;
    if (mood.next) setMood(mood.next[0], mood.next[1], now);
    else mood.name = "neutral";
  }

  // ---------- Particles ----------

  function spawn(type, x, y, vx, vy, life, a) {
    if (parts.length >= MAX_PARTS) return;
    var el = document.createElementNS(NS, type === "puff" ? "circle" : "path");
    el.setAttribute("class", "fx-" + type);
    fx.appendChild(el);
    parts.push({ type: type, el: el, x: x, y: y, vx: vx, vy: vy, life: life, max: life, a: a || 0 });
  }

  function puffs(x, y, n, spread) {
    for (var i = 0; i < n; i++) {
      var side = i % 2 === 0 ? -1 : 1;
      spawn("puff", x + side * rand(6, 16), y - 3, side * rand(30, spread), 0, rand(0.35, 0.55));
    }
  }

  function burst(x, y, base) {
    for (var i = -1; i <= 1; i++) spawn("line", x, y, 0, 0, 0.32, base + i * 0.6);
  }

  function dropPath(x, y) {
    return "M" + f(x) + " " + f(y - 5) + " C" + f(x + 4) + " " + f(y - 1) + " " + f(x + 3.5) + " " + f(y + 3.5) + " " + f(x) + " " + f(y + 3.5) +
      " C" + f(x - 3.5) + " " + f(y + 3.5) + " " + f(x - 4) + " " + f(y - 1) + " " + f(x) + " " + f(y - 5) + "Z";
  }

  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 20) {
        p.el.remove();
        parts.splice(i, 1);
        continue;
      }
      var k = 1 - p.life / p.max;
      p.el.style.opacity = (1 - k * k).toFixed(2);
      if (p.type === "puff") {
        p.x += p.vx * dt;
        p.vx *= 0.9;
        p.el.setAttribute("cx", f(p.x));
        p.el.setAttribute("cy", f(p.y - k * 4));
        p.el.setAttribute("r", f(2 + k * 6));
      } else if (p.type === "line") {
        var c = Math.cos(p.a);
        var s = Math.sin(p.a);
        var r0 = 8 + k * 10;
        var r1 = 15 + k * 14;
        p.el.setAttribute("d", "M" + f(p.x + c * r0) + " " + f(p.y + s * r0) + " L" + f(p.x + c * r1) + " " + f(p.y + s * r1));
      } else if (p.type === "spark") {
        p.y += p.vy * dt;
        var z = 4.5 * (1 - Math.abs(k - 0.35));
        p.el.setAttribute("d", "M" + f(p.x - z) + " " + f(p.y) + " L" + f(p.x + z) + " " + f(p.y) + " M" + f(p.x) + " " + f(p.y - z) + " L" + f(p.x) + " " + f(p.y + z));
      } else {
        p.vy += p.a * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.el.setAttribute("d", dropPath(p.x, p.y));
      }
    }
  }

  // ---------- Layout ----------

  function measure() {
    var resized = W !== section.clientWidth || H !== section.clientHeight;
    W = section.clientWidth;
    H = section.clientHeight;
    vw = root.clientWidth;
    var sr = section.getBoundingClientRect();
    var cr = copy.getBoundingClientRect();
    walkMin = 50;
    walkMax = W - 50;
    if (window.innerWidth >= 992) walkMin = Math.max(walkMin, cr.right - sr.left + 40);
    if (walkMin > walkMax - 80) walkMin = 50;
    linksX = cr.left - sr.left + Math.min(cr.width, 320) / 2;
    linksY = 0;
    links.forEach(function (s) {
      s.home = null;
      var lr = s.el.getBoundingClientRect();
      linksY += (lr.top + lr.height / 2 - sr.top) / links.length;
    });
    if (!resized) return;
    if (grab) release(performance.now(), null);
    if (b.mode !== "air" && b.mode !== "drag" && b.mode !== "hang") b.y = H;
  }

  function homeOf(s) {
    if (!s.home) {
      var keep = s.el.style.transform;
      s.el.style.transform = "";
      var r = s.el.getBoundingClientRect();
      var sr = section.getBoundingClientRect();
      s.el.style.transform = keep;
      s.home = { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top };
      s.home.cx = (s.home.l + s.home.r) / 2;
      s.home.cy = (s.home.t + s.home.b) / 2;
      s.home.h = s.home.b - s.home.t;
    }
    return s.home;
  }

  // ---------- Links ----------

  function pullLink(s, tx, ty, dt) {
    s.vx += (130 * (tx - s.ox) - 13 * s.vx) * dt;
    s.vy += (130 * (ty - s.oy) - 13 * s.vy) * dt;
    s.ox += s.vx * dt;
    s.oy += s.vy * dt;
    s.rot = damp(s.rot, clamp(-s.vy * 0.01 + s.vx * 0.004, -14, 14), 10, dt);
  }

  function updateLinks(dt) {
    for (var i = 0; i < links.length; i++) {
      var s = links[i];
      if (!s.held) {
        if (!s.el.style.transform) continue;
        pullLink(s, 0, 0, dt);
        if (Math.abs(s.ox) + Math.abs(s.oy) < 8) s.el.classList.remove("is-grabbed");
        if (Math.abs(s.ox) + Math.abs(s.oy) < 0.3 && Math.abs(s.vx) + Math.abs(s.vy) < 2) {
          s.ox = s.oy = s.vx = s.vy = s.rot = 0;
          s.el.style.transform = "";
          continue;
        }
      }
      s.el.style.transform = "translate(" + f(s.ox) + "px, " + f(s.oy) + "px) rotate(" + s.rot.toFixed(2) + "deg)";
    }
  }

  // ---------- Grabbing (a link, or the cursor itself) ----------

  function toWorld(x, y) {
    var c = Math.cos(b.spin);
    var s = Math.sin(b.spin);
    var dy = y - b.cy;
    return { x: b.x + x * c - dy * s, y: b.y + b.cy + x * s + dy * c };
  }

  // Shoulder for links, top of the head when hanging from the cursor.
  function gripPoint(g, side) {
    if (g.kind === "cursor") return toWorld(side * R * 0.3, b.cy - R * 0.92);
    return toWorld(side * (b.hw - 5), b.cy + 2);
  }

  function linkPoint(s, side) {
    var h = homeOf(s);
    var a = s.rot * Math.PI / 180;
    var lx = side * ((h.r - h.l) / 2 + 4);
    var ly = h.h * 0.1;
    return {
      x: h.cx + s.ox + lx * Math.cos(a) - ly * Math.sin(a),
      y: h.cy + s.oy + lx * Math.sin(a) + ly * Math.cos(a)
    };
  }

  function usesHand(side) {
    if (!grab) return false;
    for (var i = 0; i < grab.hands.length; i++) if (grab.hands[i].side === side) return true;
    return false;
  }

  // Links are offered in page order (email first).
  function nextLink() {
    for (var i = 0; i < links.length; i++) {
      var idx = (linkTurn + i) % links.length;
      var s = links[idx];
      if (s !== hovering && Math.abs(s.ox) + Math.abs(s.oy) < 2) {
        linkTurn = (idx + 1) % links.length;
        return s;
      }
    }
    return null;
  }

  // Without a forced link, offers alternate with hanging from the cursor.
  // Hanging needs the cursor high enough to dangle from, so a low cursor gets a link and the hang waits.
  function startGrab(now, px, py, forced) {
    var g;
    if (!forced && hangNext && py < H - 110) {
      hangNext = false;
      b.dir = px < b.x ? -1 : 1;
      g = { kind: "cursor", hands: [{ side: linksX < px ? 1 : -1, delay: 0 }] };
    } else {
      var s = forced || nextLink();
      if (!s) return;
      hangNext = true;
      b.dir = homeOf(s).cx < b.x ? -1 : 1;
      g = { kind: "link", s: s, hands: [{ side: b.dir, delay: 0 }, { side: -b.dir, delay: 80 }] };
    }
    g.hands.forEach(function (hd) { hd.x = hd.y = hd.vx = hd.vy = 0; });
    g.phase = "windup";
    g.t0 = now;
    g.hx = g.hy = 0;
    grab = g;
    offered = true;
    b.vx = 0;
    b.mode = "pull";
    squash.d += 3.2;
    if (g.kind === "link") {
      setMood("neutral", 0, now);
      smile.next = Math.min(smile.next, now + rand(450, 1000));
    } else {
      setMood("excited", 600, now);
    }
    if (g.kind === "cursor") {
      var hd = g.hands[0];
      hd.from = gripPoint(g, hd.side);
      hd.x = px;
      hd.y = py;
      startHold(g, now);
    }
  }

  function release(now, timedOut) {
    if (!grab) return;
    var g = grab;
    if (g.s) g.s.held = false;
    if (b.mode === "hang") {
      b.mode = "air";
      b.thrown = true;
      b.vx = clamp(b.vx, -900, 900);
      b.vy = clamp(b.vy, -900, 900);
    } else if (b.mode === "carry") {
      b.mode = "rest";
      b.until = now + 900;
    }
    if (g.phase === "windup") endGrab(now);
    else { g.phase = "retract"; g.t0 = now; }
    if (timedOut === true) setMood("tired", 1700, now, ["sad", 3200]);
    else if (timedOut === false) setMood("sad", 2600, now);
    cooldownUntil = now + 6500;
  }

  function endGrab(now) {
    grab = null;
    arm.classList.remove("is-on");
    if (b.mode === "pull") { b.mode = "rest"; b.until = now + 900; }
  }

  function startHold(g, now) {
    g.phase = "hold";
    g.t0 = now;
    if (g.kind === "link") {
      g.until = now + 5600;
      g.cap = now + 12000;
      g.s.held = true;
      g.s.el.classList.add("is-grabbed");
      b.mode = "carry";
      b.targetX = b.x;
      b.until = now + 500;
      timers.hop = now + rand(900, 1600);
      return;
    }
    var hd = g.hands[0];
    g.until = now + 6500;
    g.len = Math.max(HANG_LEN, Math.hypot(hd.x - hd.from.x, hd.y - hd.from.y));
    b.vx = b.vy = 0;
    b.mode = "hang";
    b.spin = Math.atan2(Math.sin(b.spin), Math.cos(b.spin));
    b.spinV = 0;
    squash.d -= 4;
    if (b.y >= H - 1) puffs(b.x, H, 2, 70);
  }

  function updateGrab(now, dt, px, py, pointerIn) {
    if (!grab) return;
    var g = grab;
    var n = g.hands.length;
    var settled = true;
    var sx = 0;
    var sy = 0;
    var k = g.phase === "reach" ? 240 : 320;
    var c = 2 * Math.sqrt(k) * (g.phase === "reach" ? 0.6 : 0.85);
    var carrying = g.phase === "hold" && g.kind === "link";
    if (carrying) {
      var h = homeOf(g.s);
      pullLink(g.s, px - h.cx, py + h.h * 0.22 - h.cy, dt);
    }

    for (var i = 0; i < n; i++) {
      var hd = g.hands[i];
      hd.from = gripPoint(g, hd.side);
      var to = g.phase === "retract" ? hd.from : g.kind === "link" ? linkPoint(g.s, hd.side) : { x: px, y: py };
      if (g.phase === "windup" || (g.phase === "reach" && now - g.t0 < hd.delay)) {
        hd.x = hd.from.x;
        hd.y = hd.from.y;
        hd.vx = hd.vy = 0;
      } else if (g.phase === "hold") {
        hd.x = to.x;
        hd.y = to.y;
        hd.vx = carrying ? g.s.vx : 0;
        hd.vy = carrying ? g.s.vy : 0;
      } else {
        hd.vx += (k * (to.x - hd.x) - c * hd.vx) * dt;
        hd.vy += (k * (to.y - hd.y) - c * hd.vy) * dt;
        hd.x += hd.vx * dt;
        hd.y += hd.vy * dt;
      }
      if (Math.hypot(to.x - hd.x, to.y - hd.y) > (g.phase === "retract" ? 8 : 12)) settled = false;
      sx += hd.x;
      sy += hd.y;
    }
    g.hx = sx / n;
    g.hy = sy / n;

    if (g.phase === "windup") {
      if (now - g.t0 > 200) { g.phase = "reach"; g.t0 = now; kick(24); squash.d -= 3; }
      return;
    }
    if (g.phase === "reach") {
      if (settled || now - g.t0 > 750) startHold(g, now);
    } else if (g.phase === "hold") {
      if (g.kind === "cursor") g.len = Math.max(HANG_LEN, damp(g.len, HANG_LEN - 10, 7, dt));
      if (g.kind === "link" && hovering === g.s) g.until = Math.min(g.cap, Math.max(g.until, now + 1500));
      if (!pointerIn) release(now, false);
      else if (now > g.until) release(now, true);
    } else if (settled || now - g.t0 > 900) {
      endGrab(now);
      return;
    }

    arm.classList.add("is-on");
    for (var j = 0; j < armLines.length; j++) {
      var on = j < n;
      armLines[j].style.display = on ? "" : "none";
      handEls[j].style.display = on ? "" : "none";
      if (on) drawArm(g, g.hands[j], armLines[j], handEls[j]);
    }
  }

  // One quadratic curve: the bend point trails the hand's motion and sags a little.
  // Hanging from the cursor the arm is taut, so it stays straight.
  function drawArm(g, hd, line, dot) {
    var from = hd.from;
    var dist = Math.hypot(hd.x - from.x, hd.y - from.y);
    var give = g.kind === "cursor" ? 0 : Math.min(30, dist * 0.25);
    var mx = (from.x + hd.x) / 2 - clamp(hd.vx * 0.04, -give, give);
    var my = (from.y + hd.y) / 2 - clamp(hd.vy * 0.04, -give, give) + (give && Math.min(16, dist * 0.08));

    line.setAttribute("d", "M" + f(from.x) + " " + f(from.y) + " Q" + f(mx) + " " + f(my) + " " + f(hd.x) + " " + f(hd.y));
    line.style.strokeWidth = clamp(7.5 - dist / 110, 4.5, 7);
    dot.setAttribute("cx", f(hd.x));
    dot.setAttribute("cy", f(hd.y));
    dot.setAttribute("r", f(lerp(3.5, 5.5, clamp(dist / 40, 0, 1))));
  }

  // ---------- Behaviour ----------

  function pickBehaviour() {
    var r = Math.random();
    var outside = b.x < walkMin - 20 || b.x > walkMax + 20;
    if (outside && !moody() && r < 0.6) {
      b.hopTrip = Math.floor(rand(3, 6));
      b.dir = b.x < walkMin ? 1 : -1;
      b.until = 0;
    } else if (moody() || outside || r < 0.2) {
      if (b.x < walkMin) b.targetX = rand(walkMin, lerp(walkMin, walkMax, 0.5));
      else if (b.x > walkMax) b.targetX = rand(lerp(walkMin, walkMax, 0.5), walkMax);
      else b.targetX = clamp(b.x + rand(60, 220) * coin(), walkMin, walkMax);
      b.mode = "walk";
    } else if (r < 0.55) {
      b.hopTrip = Math.floor(rand(3, 6));
      b.dir = coin();
      b.until = 0;
    } else if (r < 0.85) {
      startRoll(coin() * rand(200, 300));
    } else {
      b.crashes = Math.floor(rand(2, 4));
      b.dir = b.x > (left + right) / 2 ? 1 : -1;
      b.mode = "dash";
    }
  }

  function startRoll(vx) {
    b.mode = "roll";
    b.vx = vx;
    b.vy = 0;
    b.y = H;
    b.dir = vx > 0 ? 1 : -1;
  }

  // With prep (ms), he crouches first and springs off when it runs out.
  function hop(now, vy, vx, flip, prep) {
    if (prep) {
      b.mode = "crouch";
      b.jump = { vy: vy, vx: vx, flip: flip };
      b.until = now + prep;
      squash.d += 2.5;
      return;
    }
    b.mode = "air";
    b.vy = vy;
    b.vx = vx;
    b.spinV = flip ? (vx >= 0 ? 1 : -1) * TAU / (2 * -vy / GRAVITY) : 0;
    squash.d -= 3.5;
  }

  function hitWall(side, speed) {
    burst(side < 0 ? b.x - R * 1.1 : b.x + R * 1.1, b.y + b.cy, side < 0 ? 0 : Math.PI);
    squash.d -= clamp(speed / 45, 2, 8);
    kick(10);
  }

  function bounceWalls(restitution) {
    if (b.x >= left && b.x <= right) return;
    hitWall(b.x < left ? -1 : 1, Math.abs(b.vx));
    b.x = clamp(b.x, left, right);
    b.vx *= -restitution;
  }

  function land(now) {
    var impact = b.vy;
    b.y = H;
    b.spinV = 0;
    squash.d += clamp(impact / 160, 0, 6);
    kick(clamp(impact / 60, 3, 16));
    if (impact > 500) puffs(b.x, H, 2, 90);
    if (b.thrown && impact > 520) {
      b.vy = -impact * 0.3;
      b.vx *= 0.75;
      return;
    }
    if (b.thrown && Math.abs(b.vx) > 240) {
      b.thrown = false;
      startRoll(b.vx * 0.8);
      return;
    }
    if (b.thrown && impact > 700) setMood("dizzy", 1300, now);
    b.thrown = false;
    b.knock = false;
    b.vy = 0;
    b.vx *= 0.3;
    if (grab && grab.kind === "link" && grab.phase === "hold") {
      b.mode = "carry";
      return;
    }
    b.mode = "rest";
    b.until = now + (b.hopTrip > 0 ? 90 : b.crashes > 0 ? 450 : rand(500, 1100));
  }

  function step(now, dt, px, py, pointerIn) {
    var m = b.mode;

    if (m === "drag") {
      var nx = damp(b.x, clamp(px - drag.ox, left, right), 22, dt);
      var ny = damp(b.y, clamp(py - drag.oy, ceil, H), 22, dt);
      b.vx = lerp(b.vx, (nx - b.x) / dt, 0.4);
      b.vy = lerp(b.vy, (ny - b.y) / dt, 0.4);
      b.x = nx;
      b.y = ny;
      if (Math.abs(b.vx) > 30) b.dir = b.vx > 0 ? 1 : -1;
    } else if (m === "hang") {
      // A ball on a rope: fall freely, then pull back to rope length from the cursor.
      // Moving the cursor is what makes him swing.
      var L = grab.len + GRIP;
      var ox = b.x;
      var oy = b.y;
      b.vy += GRAVITY * dt;
      var dx = b.x + b.vx * dt - px;
      var dy = b.y + b.cy + b.vy * dt - py;
      var d = Math.hypot(dx, dy) || 1;
      var ux = dx / d;
      var uy = dy / d;
      b.x = clamp(px + ux * L, left, right);
      b.y = Math.min(py + uy * L - b.cy, H);
      // Only swing speed carries over, so reeling in never flings him over the top.
      var keep = Math.exp(-1.4 * dt);
      var vx = (b.x - ox) / dt;
      var vy = (b.y - oy) / dt;
      var vr = vx * ux + vy * uy;
      b.vx = (vx - ux * vr) * keep;
      b.vy = (vy - uy * vr) * keep;
      b.dir = linksX < b.x ? -1 : 1;
      b.spin = damp(b.spin, -Math.atan2(dx, dy), 14, dt);
    } else if (m === "carry") {
      var reachX = grab ? grab.hx - b.x : 0;
      if (Math.abs(reachX) > 380) {
        b.targetX = b.x + (reachX > 0 ? 90 : -90);
      } else if (now > b.until) {
        b.targetX = clamp(b.x + rand(-170, 170), Math.max(left + 40, walkMin - 160), walkMax);
        b.until = now + rand(800, 1600);
      }
      var cgap = b.targetX - b.x;
      b.vx = damp(b.vx, Math.abs(cgap) < 6 ? 0 : (cgap > 0 ? 1 : -1) * 72, 6, dt);
      b.x += b.vx * dt;
      if (grab) b.dir = reachX < 0 ? -1 : 1;
      if (now > timers.hop) {
        timers.hop = now + rand(1300, 2400);
        hop(now, -rand(260, 340), b.vx * 1.4, false, 70);
      }
    } else if (m === "crouch") {
      b.vx = damp(b.vx, 0, 12, dt);
      b.x += b.vx * dt;
      if (now > b.until) {
        var j = b.jump;
        b.jump = null;
        hop(now, j.vy, j.vx, j.flip);
        puffs(b.x, H, 2, 60);
      }
    } else if (m === "air") {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += b.spinV * dt;
      bounceWalls(0.5);
      if (b.y < ceil) { b.y = ceil; b.vy = Math.abs(b.vy) * 0.3; }
      if (b.y >= H) land(now);
      if (Math.abs(b.vx) > 40 && !b.knock && !(grab && grab.phase === "hold")) b.dir = b.vx > 0 ? 1 : -1;
    } else if (m === "walk") {
      var gap = b.targetX - b.x;
      var want = Math.abs(gap) < 6 ? 0 : (gap > 0 ? 1 : -1) * (moody() ? 22 : 48);
      b.vx = damp(b.vx, want, 5, dt);
      b.x += b.vx * dt;
      if (Math.abs(b.vx) > 4) b.dir = b.vx > 0 ? 1 : -1;
      if (want === 0 && Math.abs(b.vx) < 5) { b.mode = "rest"; b.until = now + rand(700, 1800); }
    } else if (m === "dash") {
      b.vx = damp(b.vx, b.dir * 340, 4, dt);
      b.x += b.vx * dt;
      var wall = b.dir < 0 ? left : right;
      if ((b.dir < 0 && b.x <= wall) || (b.dir > 0 && b.x >= wall)) {
        b.x = wall;
        hitWall(b.dir, Math.abs(b.vx));
        b.crashes -= 1;
        b.knock = true;
        hop(now, -280, -b.dir * 150, false);
        setMood("dizzy", b.crashes > 0 ? 600 : 1300, now);
      }
    } else if (m === "roll") {
      var sgn = b.vx > 0 ? 1 : -1;
      b.vx -= sgn * 90 * dt;
      b.x += b.vx * dt;
      b.spin += (b.vx * dt) / (R * 0.97);
      bounceWalls(0.65);
      if (b.vx * sgn <= 14) {
        b.vx = 0;
        if (Math.random() < 0.45) {
          hop(now, -460, 0, false, 90);
        } else {
          b.mode = "rest";
          b.until = now + rand(1000, 1800);
          setMood("dizzy", 1000, now);
        }
      }
    } else if (m === "rest") {
      b.vx = damp(b.vx, 0, 8, dt);
      if (b.crashes > 0 && now > b.until) {
        b.dir = b.x > (left + right) / 2 ? -1 : 1;
        b.mode = "dash";
      } else if (pointerIn && !grab && mood.name !== "dizzy") {
        var cdx = px - b.x;
        if (Math.abs(cdx) > 30) b.dir = cdx > 0 ? 1 : -1;
      }
      if (b.mode === "rest" && !b.hopTrip && !b.crashes && !hops && now > b.until && !grab && mood.name !== "dizzy" && offered && !hovering) {
        pickBehaviour();
      }
    } else if (m === "pull") {
      b.vx = 0;
    }

    if (b.mode === "rest" || b.mode === "walk") {
      if (hops > 0) {
        hops -= 1;
        hop(now, -470, 0, hops === 0, 70);
      } else if (b.hopTrip > 0 && now > b.until) {
        b.hopTrip -= 1;
        if (b.x < left + 60) b.dir = 1;
        if (b.x > right - 60) b.dir = -1;
        if (b.x >= walkMin && b.x <= walkMax && Math.random() < 0.3) b.dir = -b.dir;
        var flip = Math.random() < 0.35;
        hop(now, flip ? -480 : -rand(330, 420), b.dir * rand(100, 150), flip, 80);
      } else if (mood.name === "excited" && !hovering && now > timers.hop) {
        timers.hop = now + rand(260, 380);
        hop(now, -rand(200, 260), 0, false);
      }
    }

    var walking = b.mode === "walk" || b.mode === "dash" || b.mode === "carry";
    b.walkAmt = walking ? clamp(Math.abs(b.vx) / 40, 0, 1) : 0;
    if (b.walkAmt > 0.02) b.phase += Math.abs(b.vx) * dt / (b.mode === "dash" ? 9 : 7.5);
    else b.phase = damp(b.phase, Math.round(b.phase / Math.PI) * Math.PI, 10, dt);
    b.bob = -Math.abs(Math.sin(b.phase)) * (b.mode === "dash" ? 4 : 3.2) * b.walkAmt;
    b.face = damp(b.face, b.dir, 9, dt);

    var tucked = b.mode === "roll" || b.spinV !== 0;
    b.round = damp(b.round, tucked ? 1 : 0, tucked ? 14 : 6, dt);
    if (b.mode !== "roll" && b.mode !== "hang" && b.spinV === 0) {
      b.spin = damp(b.spin, Math.round(b.spin / TAU) * TAU, 7, dt);
    }

    var sq = 0;
    if (b.mode === "air") sq = -clamp(Math.abs(b.vy) / 3200, 0, 0.16);
    else if (b.mode === "drag") sq = -clamp(Math.hypot(b.vx, b.vy) / 4500, 0, 0.14) - 0.05;
    else if (b.mode === "hang") sq = -0.1;
    else if (b.mode === "crouch") sq = 0.24;
    else if (b.mode === "pull" && grab && grab.phase === "windup") sq = 0.18;
    if (mood.name === "tired") sq += 0.13 + Math.sin(now * 0.013) * 0.05;
    if (mood.name === "sad") sq += 0.1 + Math.sin(now * 0.0022) * 0.035;
    if (tucked) sq = 0;
    squash.d += (-190 * (squash.v - sq) - 13 * squash.d) * dt;
    squash.v = clamp(squash.v + squash.d * dt, -0.35, 0.45);

    for (var i = 0; i < N; i++) {
      jig[i].d += (-170 * jig[i].v - 12 * jig[i].d) * dt;
      jig[i].v = clamp(jig[i].v + jig[i].d * dt, -0.2, 0.2);
    }

    var lt = 0;
    if (b.mode === "walk") lt = clamp(b.vx / 48, -1, 1) * 0.13;
    else if (b.mode === "dash") lt = clamp(b.vx / 340, -1, 1) * 0.3;
    else if (b.mode === "air" || b.mode === "drag") lt = clamp(b.vx / 1400, -1, 1) * 0.22;
    else if (b.mode === "crouch" && b.jump) lt = clamp(b.jump.vx / 150, -1, 1) * 0.12;
    else if (b.mode === "pull") lt = -b.dir * 0.08;
    else if (b.mode === "carry") lt = -b.dir * 0.2 + clamp(b.vx / 72, -1, 1) * 0.06;
    if (mood.name === "dizzy") lt += Math.sin(now * 0.009) * 0.14;
    lean = damp(lean, lt, 8, dt);

    var lx = b.x + b.dir * 120;
    var ly = b.y - 40;
    if (b.mode === "hang") { lx = linksX; ly = linksY; }
    else if (grab) { lx = grab.hx; ly = grab.hy; }
    else if (hovering) { lx = homeOf(hovering).cx + hovering.ox; ly = homeOf(hovering).cy + hovering.oy; }
    else if (pointerIn && !moody()) { lx = px; ly = py; }
    var ld = Math.hypot(lx - b.x, ly - (b.y - 40)) || 1;
    var tx = (lx - b.x) / ld;
    var ty = (ly - (b.y - 40)) / ld;
    if (moody()) { tx *= 0.4; ty = 0.9; }
    look.x = damp(look.x, tx, 10, dt);
    look.y = damp(look.y, ty, 10, dt);

    if (mood.name !== "neutral") {
      if (now < smile.until || smile.next < now) smile.next = now + rand(5200, 9800);
      smile.until = 0;
    } else if (now >= blink.until && now > smile.next) {
      smile.until = now + rand(520, 780);
      smile.next = smile.until + (offeringLink() ? rand(1600, 2800) : rand(5200, 9800));
    }

    if (now < smile.until) {
      if (blink.next < smile.until) blink.next = smile.until + rand(400, 1400);
    } else if (now > blink.next) {
      var sleepy = mood.name === "tired";
      blink.until = now + (sleepy ? 420 : 120);
      blink.next = now + (sleepy ? rand(700, 1300) : rand(1800, 4800));
    }
  }

  // ---------- Drawing ----------

  var pts = [];
  for (var p = 0; p < N; p++) pts.push([0, 0]);

  function bodyPathD(cy, sx, sy, now) {
    var airborne = b.mode === "air" || b.mode === "drag" || b.mode === "hang";
    var fl = lerp(0.64, 0.97, b.round);
    var wide = lerp(1.16, 1, b.round);
    var idle = airborne ? 0.35 : 1;
    var sh = lean * (1 - b.round);
    for (var i = 0; i < N; i++) {
      var a = (i / N) * TAU;
      var wob = jig[i].v + (Math.sin(now * 0.0023 + i * 1.7) * 0.026 + Math.sin(now * 0.0037 + i * 0.9) * 0.016) * idle;
      var y = Math.sin(a) * R * sy * (1 + wob);
      if (y > 0) y *= fl;
      pts[i][0] = Math.cos(a) * R * wide * sx * (1 + wob) - y * sh;
      pts[i][1] = cy + y;
    }
    // Closed Catmull-Rom loop through the points.
    var d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
    for (var j = 0; j < N; j++) {
      var p0 = pts[(j - 1 + N) % N];
      var p1 = pts[j];
      var p2 = pts[(j + 1) % N];
      var p3 = pts[(j + 2) % N];
      d += " C" + f(p1[0] + (p2[0] - p0[0]) / 6) + " " + f(p1[1] + (p2[1] - p0[1]) / 6) +
        " " + f(p2[0] - (p3[0] - p1[0]) / 6) + " " + f(p2[1] - (p3[1] - p1[1]) / 6) +
        " " + f(p2[0]) + " " + f(p2[1]);
    }
    return d + "Z";
  }

  // Stub angle: 0 points straight out, positive droops down, negative raises up.
  function stubTarget(side, now) {
    var m = mood.name;
    var uses = usesHand(side);
    if (b.mode === "hang") {
      // Point at the links, converted into the body's rotated frame.
      var c = Math.cos(b.spin);
      var s = Math.sin(b.spin);
      var wx = linksX - b.x;
      var wy = linksY - b.y - b.cy;
      return Math.atan2(wy * c - wx * s, side * (wx * c + wy * s));
    }
    if (b.mode === "carry") return -0.35 + Math.sin(now * 0.022 + side) * 0.45;
    if (b.mode === "pull") return uses ? 0.2 : -0.5 + Math.sin(now * 0.04) * 0.2;
    if (b.mode === "crouch") return 1.25;
    if (b.mode === "drag" || (b.mode === "air" && m !== "happy")) return -0.75 + Math.sin(now * 0.026 + side * 1.3) * 0.4;
    if (m === "happy") return -1.15 + Math.sin(now * 0.02 + side) * 0.3;
    if (m === "excited") return -0.95 + Math.sin(now * 0.03 + (side > 0 ? 0 : Math.PI)) * 0.5;
    if (m === "sad") return 1.35;
    if (m === "tired") return 1.5 + Math.sin(now * 0.004) * 0.05;
    if (m === "dizzy") return 0.55 + Math.sin(now * 0.01 + side * 2) * 0.55;
    if (b.mode === "dash") return -0.25 + Math.sin(now * 0.035 + side) * 0.35;
    if (uses) return 0.4;
    return 0.95 + Math.sin(b.phase + (side < 0 ? Math.PI : 0)) * 0.5 * b.walkAmt + Math.sin(now * 0.003 + side) * 0.06;
  }

  function render(now, dt) {
    var walking = b.walkAmt > 0;
    var sv = squash.v + (walking ? Math.cos(b.phase * 2) * 0.03 : 0);
    var sx = 1 + sv * 0.85;
    var sy = 1 - sv;
    var bottom = R * lerp(0.64, 0.97, b.round) * sy;
    var cy = -LEG * (1 - b.round) - bottom + b.bob;
    var dangling = b.mode === "air" || b.mode === "drag" || b.mode === "hang";
    var m = mood.name;
    var smiling = m === "happy" || now < smile.until;
    var jitter = m === "excited" ? Math.sin(now * 0.07) * 0.7 : 0;
    b.cy = cy;
    b.hw = R * lerp(1.16, 1, b.round) * sx;

    bodyPath.setAttribute("d", bodyPathD(cy, sx, sy, now));
    spinGroup.setAttribute("transform", "translate(" + jitter.toFixed(2) + " 0) rotate(" + f(b.spin * 180 / Math.PI) + " 0 " + f(cy) + ")");

    var hidden = b.round > 0.7;
    for (var k = 0; k < 2; k++) {
      var side = k === 0 ? -1 : 1;
      var hipX = side * 9 * sx - cy * lean * 0.2;
      var hipY = cy + bottom * 0.7;
      var lx;
      var ly;
      if (b.mode === "hang") {
        // Dangle along the body's own "down", trailing the swing.
        var gx = Math.sin(b.spin);
        var gy = Math.cos(b.spin);
        var trail = clamp(-b.vx * 0.02, -9, 9) + Math.sin(now * 0.02 + k * 2.4) * 1.5;
        lx = hipX + side * 3 + gx * (LEG + 6) - gy * trail;
        ly = hipY + gy * (LEG + 6) + gx * trail;
      } else if (dangling) {
        var rate = b.mode === "air" ? 0.02 : 0.03;
        lx = side * 11 + Math.sin(now * rate + k * 2.4) * 3.5;
        ly = hipY + LEG + 4 + Math.cos(now * rate + k * 2.4) * 2;
      } else if (b.mode === "pull" || b.mode === "crouch") {
        lx = side * 13 - b.dir * 4 + Math.sin(now * 0.05 + k) * 0.6;
        ly = 0;
      } else {
        var ph = b.phase + k * Math.PI;
        var stride = b.mode === "dash" ? 10 : 7;
        lx = side * 9 - Math.cos(ph) * stride * (b.vx >= 0 ? 1 : -1) * b.walkAmt;
        ly = -Math.max(0, Math.sin(ph)) * (b.mode === "dash" ? 8 : 6) * b.walkAmt;
      }
      lx = lerp(hipX, lx, 1 - b.round);
      ly = lerp(hipY, ly, 1 - b.round);
      legEls[k].setAttribute("d", "M" + f(hipX) + " " + f(hipY) + " Q" + f((hipX + lx) / 2 + side * 1.5) + " " + f((hipY + ly) / 2) + " " + f(lx) + " " + f(ly));
      legEls[k].style.opacity = hidden ? 0 : 1;

      stubA[k] = damp(stubA[k], stubTarget(side, now), 16, dt);
      // Hanging, the free stub stretches out and jabs toward the links.
      var pointing = b.mode === "hang" && !usesHand(side);
      stubLen[k] = damp(stubLen[k], pointing ? 26 + Math.max(0, Math.sin(now * 0.012)) * 10 : 12, 14, dt);
      var sbx = side * (b.hw - 5) - (cy + 2) * lean * 0.2;
      var sby = cy + 2;
      var stx = sbx + side * Math.cos(stubA[k]) * stubLen[k];
      var sty = sby + Math.sin(stubA[k]) * stubLen[k];
      stubEls[k].setAttribute("d", "M" + f(sbx) + " " + f(sby) + " Q" + f((sbx + stx) / 2 + side * 1.2) + " " + f((sby + sty) / 2 - 1) + " " + f(stx) + " " + f(sty));
      stubEls[k].style.opacity = hidden || (grab && grab.phase !== "windup" && usesHand(side)) ? 0 : 1;
    }

    svg.classList.toggle("is-happy", smiling);

    var ex = b.face * 7 * (1 - b.round) + look.x * 3.5 - cy * lean * 0.5;
    var ey = cy - 6 + look.y * 3;
    var erx = 3.9;
    var ery = 6.2;
    if (b.mode === "drag") { erx = 5; ery = 5; }
    else if (m === "excited") { erx = 4.5; ery = 7; }
    else if (m === "sad") { erx = 3.8; ery = 6; ey += 1.5; }
    else if (m === "tired") { ey += 1.5; }
    else if (m === "dizzy") { erx = 3.3; ery = 3.3; }

    for (var e = 0; e < 2; e++) {
      var eside = e === 0 ? -1 : 1;
      var exx = ex + eside * 7.5 * sx;
      var eyy = ey;
      if (m === "dizzy" && b.mode !== "drag") {
        var ang = now * 0.012 + e * Math.PI;
        exx += Math.cos(ang) * 2.4;
        eyy += Math.sin(ang) * 2.4;
      }
      eyeEls[e].setAttribute("cx", f(exx));
      eyeEls[e].setAttribute("cy", f(eyy));
      eyeEls[e].setAttribute("rx", erx);
      eyeEls[e].setAttribute("ry", now < blink.until ? 0.6 : ery);

      var top = eyy - ery;
      var inner = top - 4;
      var outer = top - 4;
      if (m === "sad") { inner = top - 1.5; outer = eyy - ery * 0.45; }
      else if (m === "tired") { inner = outer = eyy - ery * 0.05; }
      if (smiling || (inner < top - 3 && outer < top - 3)) {
        lidEls[e].style.display = "none";
      } else {
        var l = exx - erx - 2;
        var r = exx + erx + 2;
        var t = top - 3;
        lidEls[e].style.display = "";
        lidEls[e].setAttribute("d", "M" + f(l) + " " + f(t) + " L" + f(r) + " " + f(t) + " L" + f(r) + " " + f(eside < 0 ? inner : outer) + " L" + f(l) + " " + f(eside < 0 ? outer : inner) + "Z");
      }

      if (smiling) {
        happyEls[e].setAttribute("d", "M" + f(exx - 5) + " " + f(eyy + 2.2) + " L" + f(exx) + " " + f(eyy - 4) + " L" + f(exx + 5) + " " + f(eyy + 2.2));
      }

      if (m === "sad" && e === (b.dir > 0 ? 1 : 0) && now > timers.drop && b.round < 0.2) {
        spawn("drop", b.x + exx, b.y + eyy + 7, b.dir * 4, 12, 1.4, 220);
        timers.drop = now + rand(700, 1100);
      }
    }

    if (m === "tired" && now > timers.drop) {
      spawn("drop", b.x - b.dir * R * 0.95, b.y + cy - R * 0.55, -b.dir * 25, -50, 0.9, 500);
      timers.drop = now + rand(500, 900);
    }

    if (m === "happy" && now > timers.spark) {
      spawn("spark", b.x + rand(-42, 42), b.y + cy - R * sy - rand(0, 14), 0, -rand(30, 60), rand(0.45, 0.7));
      timers.spark = now + rand(90, 170);
    }

    svg.style.transform = "translate(" + f(b.x - 60) + "px, " + f(b.y - 110) + "px)";
  }

  // ---------- Loop ----------

  function frame(t) {
    raf = 0;
    if (!visible) return;
    var dt = last ? Math.min(0.033, (t - last) / 1000) : 0.016;
    last = t;
    var now = performance.now();

    var sr = section.getBoundingClientRect();
    left = -sr.left + 36;
    right = vw - sr.left - 36;
    ceil = -sr.top + 70;
    var px = pointer.cx - sr.left;
    var py = pointer.cy - sr.top;
    var pointerIn = pointer.seen && px > left - 40 && px < right + 40 && py > -40 && py < H + 40;

    updateMood(now);

    var grounded = b.mode === "walk" || b.mode === "rest";
    var free = !grab && finePointer && pointerIn && !drag && mood.name !== "dizzy" && grounded;
    if (free && hovering && now - hoverSince > 700 && mood.name !== "happy") {
      hops = b.hopTrip = b.crashes = 0;
      hoverSince = Infinity;
      startGrab(now, px, py, hovering);
    } else if (free && !hovering && !hops && !b.hopTrip && !b.crashes && mood.name === "neutral" && (now > cooldownUntil || !offered)) {
      startGrab(now, px, py, offered ? null : links[0]);
    }

    step(now, dt, px, py, pointerIn);
    updateGrab(now, dt, px, py, pointerIn);
    updateLinks(dt);
    updateParts(dt);
    render(now, dt);

    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (!raf) { last = 0; raf = window.requestAnimationFrame(frame); }
  }

  // ---------- Input ----------

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" && !drag) return;
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    pointer.seen = true;
    pointer.moved = performance.now();
  }, { passive: true });

  document.addEventListener("mouseleave", function () { pointer.seen = false; });

  bodyPath.addEventListener("pointerdown", function (e) {
    if (calm) return;
    e.preventDefault();
    var now = performance.now();
    var sr = section.getBoundingClientRect();
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    pointer.seen = true;
    drag = { id: e.pointerId, ox: e.clientX - sr.left - b.x, oy: e.clientY - sr.top - b.y };
    try { bodyPath.setPointerCapture(e.pointerId); } catch (err) {}
    if (grab) release(now, null);
    b.mode = "drag";
    b.spinV = 0;
    b.jump = null;
    hops = b.hopTrip = b.crashes = 0;
    kick(10);
    setMood("neutral", 0, now);
    root.classList.add("is-blob-dragging");
  });

  function drop(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    root.classList.remove("is-blob-dragging");
    b.vx = clamp(b.vx, -1400, 1400);
    b.vy = clamp(b.vy, -1400, 1400);
    b.mode = "air";
    b.thrown = true;
    cooldownUntil = Math.max(cooldownUntil, performance.now() + 2500);
  }

  bodyPath.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
  });
  bodyPath.addEventListener("pointerup", drop);
  bodyPath.addEventListener("pointercancel", drop);

  links.forEach(function (s) {
    s.el.addEventListener("mouseenter", function () {
      hovering = s;
      hoverSince = s.held ? Infinity : performance.now();
    });
    s.el.addEventListener("mouseleave", function () {
      if (hovering === s) { hovering = null; hoverSince = Infinity; }
    });
    s.el.addEventListener("click", function () {
      if (calm) return;
      var now = performance.now();
      if (grab) release(now, null);
      setMood("happy", 2800, now);
      hops = 3;
      b.hopTrip = b.crashes = 0;
      kick(30);
      cooldownUntil = now + 15000;
    });
  });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(section);
  window.addEventListener("resize", measure);

  measure();
  b.x = lerp(walkMin, walkMax, 0.6);
  b.y = H;
  b.until = performance.now() + 250;
  render(performance.now(), 0.016);

  if (calm) return;

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) return;
      cooldownUntil = Math.max(cooldownUntil, performance.now() + (offered ? 2500 : 0));
      start();
    }).observe(section);
  } else {
    visible = true;
    start();
  }
})();
