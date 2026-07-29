/* ═══════════════════════════════════════════════════════════════
   PE//1 — floating air / 浮世の泡

   A restrained layer of real rising bubbles translated through an
   ukiyo-e printing vocabulary: imperfect keylines, an occasional
   indigo registration offset, and tiny instrument fiducials. It uses
   PE.loop, so the site still owns exactly one animation clock.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PE = window.PE;
  var cv = document.getElementById('bubbles');
  if (!PE || !cv) return;

  var ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  var S = PE.state;
  var rnd = PE.rng(0xb0771e);
  var bubbles = [];
  var w = 1, h = 1, dpr = 1, lastW = 0;
  var palette = {};

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function rgba(hex, alpha) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(120,150,180,' + alpha + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function colours() {
    var day = PE.mode() === 'fixed';
    palette = {
      day: day,
      key: rgba(css(day ? '--dye-blue' : '--sig'), day ? 0.37 : 0.34),
      ghost: rgba(css('--dye-crimson'), day ? 0.18 : 0.22),
      shine: day ? 'rgba(255,252,238,.72)' : 'rgba(228,255,250,.48)',
      shade: rgba(css('--dye-sumi'), day ? 0.18 : 0.24),
      tech: rgba(css('--sig'), day ? 0.28 : 0.32)
    };
  }

  function make(i, initial) {
    var r = 8 + Math.pow(rnd(), 1.65) * (innerWidth < 760 ? 27 : 48);
    return {
      x: rnd() * w,
      y: initial ? rnd() * h : h + r * (1 + rnd() * 3),
      r: r,
      vy: 8 + rnd() * 18 + r * 0.08,
      drift: 7 + rnd() * 18,
      phase: rnd() * Math.PI * 2,
      wobble: 0.018 + rnd() * 0.03,
      style: i % 5,
      spin: rnd() < 0.5 ? -1 : 1,
      alpha: 0.48 + rnd() * 0.42
    };
  }

  function populate() {
    var count = innerWidth < 640 ? 8 : innerWidth < 1050 ? 10 : 12;
    bubbles = [];
    for (var i = 0; i < count; i++) bubbles.push(make(i, true));
  }

  function resize() {
    w = Math.max(1, innerWidth);
    h = Math.max(1, innerHeight);
    /* Cap the backing store at roughly 2.8M pixels on large/high-DPR
       displays; mobile remains crisp and 4K no longer allocates 40MB/frame. */
    var budgetDpr = Math.sqrt(2800000 / Math.max(1, w * h));
    dpr = Math.max(.25, Math.min(devicePixelRatio || 1, 1.5, budgetDpr));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!bubbles.length || Math.abs(w - lastW) > 180) populate();
    lastW = w;
    draw();
  }

  function outline(b, ox, oy, scale) {
    var n = 42;
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var tooth = 1 + Math.sin(a * 3 + b.phase) * b.wobble + Math.sin(a * 7 - b.phase * .7) * b.wobble * .32;
      var rr = b.r * scale * tooth;
      var x = b.x + ox + Math.cos(a) * rr;
      var y = b.y + oy + Math.sin(a) * rr;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function waveHatch(b) {
    if (b.style !== 1 && b.style !== 4) return;
    ctx.save();
    outline(b, 0, 0, .88);
    ctx.clip();
    ctx.strokeStyle = palette.key;
    ctx.lineWidth = .55;
    for (var j = 0; j < 3; j++) {
      var yy = b.y + b.r * (.18 + j * .19);
      ctx.beginPath();
      for (var x = b.x - b.r; x <= b.x + b.r + 2; x += 3) {
        var y = yy + Math.sin((x - b.x) / Math.max(4, b.r * .22) + b.phase) * Math.max(1.2, b.r * .045);
        if (x === b.x - b.r) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function fiducial(b) {
    if (b.style !== 2) return;
    var x = b.x + b.r * .72, y = b.y - b.r * .66, q = Math.max(3, b.r * .13);
    ctx.strokeStyle = palette.tech;
    ctx.lineWidth = .65;
    ctx.beginPath();
    ctx.moveTo(x - q, y); ctx.lineTo(x + q, y);
    ctx.moveTo(x, y - q); ctx.lineTo(x, y + q);
    ctx.stroke();
  }

  function drawBubble(b) {
    ctx.save();
    ctx.globalAlpha = b.alpha * (.28 + .72 * S.intensity);

    /* A tiny mis-registration makes some bubbles read as woodblock ink. */
    if (b.style === 1 || b.style === 4) {
      outline(b, 1.35 * b.spin, .75, 1.012);
      ctx.strokeStyle = palette.ghost;
      ctx.lineWidth = Math.max(.55, b.r * .021);
      ctx.stroke();
    }

    outline(b, 0, 0, 1);
    ctx.strokeStyle = palette.key;
    ctx.lineWidth = Math.max(.7, b.r * .025);
    ctx.stroke();

    /* Lower refraction and a broken upper highlight keep the centre clear. */
    ctx.beginPath();
    ctx.arc(b.x + b.r * .05, b.y + b.r * .09, b.r * .77, .16 * Math.PI, .88 * Math.PI);
    ctx.strokeStyle = palette.shade;
    ctx.lineWidth = Math.max(.65, b.r * .035);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(b.x - b.r * .12, b.y - b.r * .10, b.r * .66, 1.08 * Math.PI, 1.55 * Math.PI);
    ctx.strokeStyle = palette.shine;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, b.r * .052);
    ctx.stroke();

    if (b.r > 22) {
      ctx.beginPath();
      ctx.arc(b.x - b.r * .34, b.y - b.r * .39, Math.max(1.1, b.r * .055), 0, Math.PI * 2);
      ctx.fillStyle = palette.shine;
      ctx.fill();
    }
    waveHatch(b);
    fiducial(b);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < bubbles.length; i++) drawBubble(bubbles[i]);
    cv.classList.add('live');
  }

  function step(dt, now) {
    var sec = dt / 1000;
    var pointer = S.ptr.has ? (S.ptr.x - .5) * 2 : 0;
    var lift = 1 + Math.min(1, S.pulse) * .38;
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.y -= b.vy * sec * lift;
      b.x += (Math.sin(now * .00042 + b.phase) * b.drift + pointer * (b.r * .08)) * sec;
      b.phase += sec * (.09 + b.r * .0012) * b.spin;
      if (b.y < -b.r * 2 || b.x < -b.r * 3 || b.x > w + b.r * 3) {
        bubbles[i] = make(i, false);
      }
    }
    draw();
  }

  function sync() {
    PE.loop.remove('bubbles');
    if (PE.reduced) { draw(); return; }
    PE.loop.add('bubbles', step);
  }

  colours();
  resize();
  sync();
  addEventListener('resize', PE.debounce(resize, 180), { passive: true });
  PE.on('modechange', function () { colours(); draw(); });
  PE.on('motionchange', sync);
})();
