(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (reduceMotion || coarsePointer || window.innerWidth < 768) return;

  var COUNT = document.body.classList.contains('home-page') ? 3 : 2;

  var mouse = { x: -9999, y: -9999, active: false };
  var butterflies = [];
  var layer = null;
  var raf = 0;
  var last = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function createLayer() {
    layer = document.createElement('div');
    layer.className = 'butterfly-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }

  function butterflySVG() {
    return [
      '<svg class="butterfly-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">',
      '  <g class="butterfly-wings">',
      '    <path class="wing wing-l" d="M30 32 C18 10 4 14 8 28 C10 36 22 38 30 34 Z"/>',
      '    <path class="wing wing-l wing-l-lower" d="M30 34 C20 36 10 46 14 52 C20 56 28 46 30 38 Z"/>',
      '    <path class="wing wing-r" d="M34 32 C46 10 60 14 56 28 C54 36 42 38 34 34 Z"/>',
      '    <path class="wing wing-r wing-r-lower" d="M34 34 C44 36 54 46 50 52 C44 56 36 46 34 38 Z"/>',
      '  </g>',
      '  <path class="butterfly-body" d="M32 18 C31 28 31 40 32 50 C33 40 33 28 32 18 Z"/>',
      '  <path class="butterfly-antenna" d="M30 18 Q26 8 22 10"/>',
      '  <path class="butterfly-antenna" d="M34 18 Q38 8 42 10"/>',
      '</svg>'
    ].join('');
  }

  function spawnOffscreen() {
    var edge = Math.floor(Math.random() * 4);
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (edge === 0) return { x: rand(-80, w + 80), y: -60 };
    if (edge === 1) return { x: w + 60, y: rand(-80, h + 80) };
    if (edge === 2) return { x: rand(-80, w + 80), y: h + 60 };
    return { x: -60, y: rand(-80, h + 80) };
  }

  function createButterfly(i) {
    var el = document.createElement('div');
    el.className = 'butterfly';
    el.innerHTML = butterflySVG();
    layer.appendChild(el);

    var companion = i === 0;
    if (companion) el.classList.add('butterfly--companion');

    var start = companion
      ? { x: window.innerWidth * 0.5 + rand(-40, 40), y: window.innerHeight * 0.4 + rand(-40, 40) }
      : spawnOffscreen();

    var b = {
      id: i,
      el: el,
      companion: companion,
      x: start.x,
      y: start.y,
      vx: rand(-0.6, 0.6),
      vy: rand(-0.6, 0.6),
      angle: rand(0, Math.PI * 2),
      speed: companion ? rand(1.4, 2.0) : rand(1.1, 2.2),
      flap: companion ? rand(1.05, 1.35) : rand(0.8, 1.4),
      phase: rand(0, Math.PI * 2),
      state: companion ? 'companion' : 'enter',
      timer: companion ? 9999 : rand(2, 6),
      target: null,
      scale: companion ? rand(0.9, 1.05) : rand(0.75, 1.15),
      fear: companion ? 36 : rand(70, 120),
      orbit: rand(70, 120),
      orbitAngle: rand(0, Math.PI * 2),
      orbitSpeed: rand(0.7, 1.35)
    };

    el.style.setProperty('--flap', b.flap);
    el.style.setProperty('--scale', b.scale);
    el.dataset.state = b.state;
    return b;
  }

  function setState(b, state, duration) {
    b.state = state;
    b.timer = duration != null ? duration : rand(2, 5);
    b.el.dataset.state = state;
  }

  function steerToward(b, tx, ty, strength) {
    var dx = tx - b.x;
    var dy = ty - b.y;
    var dist = Math.hypot(dx, dy) || 1;
    b.vx += (dx / dist) * strength;
    b.vy += (dy / dist) * strength;
  }

  function fleeCursor(b) {
    if (!mouse.active) return;
    var dx = b.x - mouse.x;
    var dy = b.y - mouse.y;
    var dist = Math.hypot(dx, dy);
    var fear = b.fear;
    if (b.companion) fear = 32;
    if (dist < fear && dist > 0.1) {
      var force = (1 - dist / fear) * (b.companion ? 0.55 : 0.9);
      b.vx += (dx / dist) * force;
      b.vy += (dy / dist) * force;
    }
  }

  function companionOrbit(b) {
    if (!mouse.active) {
      steerToward(b, window.innerWidth * 0.55, window.innerHeight * 0.4, 0.03);
      return;
    }

    b.orbitAngle += 0.018 * b.orbitSpeed;
    var radius = b.orbit + Math.sin(b.phase * 0.35) * 28 + Math.cos(b.phase * 0.2) * 12;
    var tx = mouse.x + Math.cos(b.orbitAngle) * radius;
    var ty = mouse.y + Math.sin(b.orbitAngle) * radius * 0.72 - 12;

    var dist = Math.hypot(tx - b.x, ty - b.y);
    var pull = dist > radius * 1.4 ? 0.22 : dist > 50 ? 0.12 : 0.06;
    steerToward(b, tx, ty, pull);

    b.vx += Math.cos(b.phase * 1.1) * 0.05 + rand(-0.04, 0.04);
    b.vy += Math.sin(b.phase * 0.9) * 0.05 + rand(-0.04, 0.04);
  }

  function leaveScreen(b) {
    if (b.companion) {
      setState(b, 'companion', 9999);
      return;
    }
    var w = window.innerWidth;
    var h = window.innerHeight;
    var edge = Math.floor(Math.random() * 4);
    if (edge === 0) b.target = { x: rand(0, w), y: -100 };
    else if (edge === 1) b.target = { x: w + 100, y: rand(0, h) };
    else if (edge === 2) b.target = { x: rand(0, w), y: h + 100 };
    else b.target = { x: -100, y: rand(0, h) };
    setState(b, 'leave', 12);
  }

  function respawn(b) {
    var start = spawnOffscreen();
    b.x = start.x;
    b.y = start.y;
    b.vx = rand(-0.8, 0.8);
    b.vy = rand(-0.8, 0.8);
    b.target = null;
    setState(b, 'enter', rand(3, 6));
  }

  function updateButterfly(b, dt) {
    b.timer -= dt;
    b.phase += dt * b.flap * 10;

    if (b.companion) {
      if (b.state !== 'companion') setState(b, 'companion', 9999);

      companionOrbit(b);
      fleeCursor(b);

      var spC = Math.hypot(b.vx, b.vy) || 1;
      var maxC = b.speed * 1.15;
      if (spC > maxC) {
        b.vx = (b.vx / spC) * maxC;
        b.vy = (b.vy / spC) * maxC;
      }

      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;
      b.x = clamp(b.x, 8, window.innerWidth - 8);
      b.y = clamp(b.y, 8, window.innerHeight - 8);

      if (Math.abs(b.vx) + Math.abs(b.vy) > 0.05) {
        b.angle = Math.atan2(b.vy, b.vx);
      }

      b.el.style.transform =
        'translate(' + b.x + 'px,' + b.y + 'px) rotate(' + (b.angle + Math.PI / 2) + 'rad) scale(var(--scale))';
      b.el.style.setProperty('--flap-amp', 1);
      return;
    }

    b.vx += Math.cos(b.phase * 0.7) * 0.04 + rand(-0.03, 0.03);
    b.vy += Math.sin(b.phase * 0.55) * 0.04 + rand(-0.03, 0.03);

    if (b.state === 'leave' && b.target) {
      steerToward(b, b.target.x, b.target.y, 0.22);
      if (
        b.x < -120 || b.x > window.innerWidth + 120 ||
        b.y < -120 || b.y > window.innerHeight + 120
      ) {
        respawn(b);
      }
    } else if (b.state === 'enter') {
      steerToward(b, window.innerWidth * 0.5, window.innerHeight * 0.45, 0.05);
      if (b.timer <= 0) setState(b, 'fly', rand(3, 7));
    } else {
      if (b.timer <= 0) {
        if (Math.random() < 0.35) leaveScreen(b);
        else setState(b, 'fly', rand(2, 6));
      }
    }

    fleeCursor(b);

    if (mouse.active && b.state === 'fly' && Math.random() < 0.01) {
      var md = Math.hypot(mouse.x - b.x, mouse.y - b.y);
      if (md > 140 && md < 420) {
        steerToward(b, mouse.x + rand(-40, 40), mouse.y + rand(-40, 40), 0.08);
      }
    }

    var sp = Math.hypot(b.vx, b.vy) || 1;
    var maxSp = b.state === 'leave' ? b.speed * 1.8 : b.speed;
    if (sp > maxSp) {
      b.vx = (b.vx / sp) * maxSp;
      b.vy = (b.vy / sp) * maxSp;
    }

    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;

    if (b.state !== 'leave') {
      b.x = clamp(b.x, -40, window.innerWidth + 40);
      b.y = clamp(b.y, -40, window.innerHeight + 40);
    }

    if (Math.abs(b.vx) + Math.abs(b.vy) > 0.05) {
      b.angle = Math.atan2(b.vy, b.vx);
    }

    b.el.style.transform =
      'translate(' + b.x + 'px,' + b.y + 'px) rotate(' + (b.angle + Math.PI / 2) + 'rad) scale(var(--scale))';
    b.el.style.setProperty('--flap-amp', 1);
  }

  function tick(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;
    for (var i = 0; i < butterflies.length; i++) updateButterfly(butterflies[i], dt);
    raf = requestAnimationFrame(tick);
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }

  function onLeave() {
    mouse.active = false;
  }

  function start() {
    createLayer();
    for (var i = 0; i < COUNT; i++) butterflies.push(createButterfly(i));
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && !e.toElement) onLeave();
    });
    raf = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
