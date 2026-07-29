/* ═══════════════════════════════════════════════════════════════
   PE//1 — instruments

   Six things on this site compute. None of them is a picture of a
   result: each runs the actual update rule in your browser and
   prints what it measured. Where a number comes from a paper
   instead of from this page, the figure says so.

   Every instrument registers with PE.loop and releases it when
   scrolled out of view. There is no second animation chain.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PE = window.PE;
  if (!PE) return;

  /* ── helpers ──────────────────────────────────────────────── */
  function fit(cv, h) {
    var dpr = Math.min(2, devicePixelRatio || 1);
    var w = cv.clientWidth;
    if (!w) return null;
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W; cv.height = H; cv.style.height = h + 'px';
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function rgb(c, a) {
    return 'rgba(' + ((c[0] * 255) | 0) + ',' + ((c[1] * 255) | 0) + ',' + ((c[2] * 255) | 0) + ',' + (a == null ? 1 : a) + ')';
  }
  var G = function () { return PE.colors(); };

  /* mount: STILL BY DEFAULT.
     A page of figures that all animate at once is exhausting to look at,
     and none of the motion carries information until the reader engages.
     So a figure draws one settled frame when it scrolls into view, and
     runs only while the pointer is over it or a control is being used.
     On coarse pointers there is no hover, so a small ▶ affordance toggles
     it instead. Reduced motion never loops at all. */
  var uid = 0;
  function mount(el, id, frame, onSize) {
    var key = id + '-' + (++uid), visible = false, engaged = false, coarseOn = false;

    function still() {
      /* advance the model far enough to be worth looking at, then hold */
      var n = 90;
      while (n--) frame(16.7);
    }
    function update() {
      var run = visible && !PE.reduced && (engaged || coarseOn);
      if (run && !PE.loop.has(key)) PE.loop.add(key, frame);
      if (!run) PE.loop.remove(key);
    }

    var io = new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis === visible) return;
      visible = vis;
      if (vis) still();
      update();
    }, { rootMargin: '80px' });
    io.observe(el);

    if (PE.fine) {
      el.addEventListener('pointerenter', function () { engaged = true; update(); });
      el.addEventListener('pointerleave', function () { engaged = false; update(); });
    } else {
      /* touch: an explicit, tiny play toggle in the figure header */
      var fh = el.querySelector('.fh');
      if (fh) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'run';
        b.setAttribute('aria-label', 'Run figure');
        b.textContent = '▶';
        b.addEventListener('click', function () {
          coarseOn = !coarseOn;
          b.textContent = coarseOn ? '❚❚' : '▶';
          b.classList.toggle('on', coarseOn);
          update();
        });
        fh.appendChild(b);
      }
    }
    /* dragging a control always animates its consequence */
    el.addEventListener('input', function () { still(); });

    var re = PE.debounce(function () { if (onSize) onSize(); frame(16.7); }, 200);
    addEventListener('resize', re, { passive: true });
    PE.on('modechange', function () { setTimeout(function () { frame(16.7); }, 40); });
    if (PE.reduced) setTimeout(function () { frame(16.7); }, 60);
  }

  function control(host, spec) {
    var lab = document.createElement('label');
    lab.innerHTML = '<span class="en"></span><span class="zh"></span>';
    lab.querySelector('.en').textContent = spec.label.en;
    lab.querySelector('.zh').textContent = spec.label.zh;
    var input = document.createElement('input');
    input.type = 'range';
    input.min = spec.min; input.max = spec.max; input.step = spec.step; input.value = spec.value;
    input.setAttribute('aria-label', spec.label.en);
    var out = document.createElement('span');
    out.className = 'mono';
    out.style.cssText = 'font-size:var(--t-2xs);color:var(--sig);min-width:52px;text-align:right';
    function sync() { out.textContent = spec.format(parseFloat(input.value)); spec.onInput(parseFloat(input.value)); }
    input.addEventListener('input', sync);
    host.appendChild(lab); host.appendChild(input); host.appendChild(out);
    sync();
    return input;
  }

  /* ═════════════════════════════════════════════════════════════
     1. HERO — his two manuscripts, run in order, on his own name.

     Retrieval: the name is rasterised to a ±1 lattice, stored as
     one of three patterns, corrupted, and recovered by asynchronous
     sweeps under the COVARIANCE rule. Text rasters are ~85 %
     background, and under the plain Hebb rule that shared mean
     swamps the cue — the widest basin wins every time. Patterns are
     centred by subtracting mean activity A first:
         Z = X − A,   h_i = Σ_μ Z[μ][i]·m_μ − (P/N)·s_i

     Release: every recovered +1 cell becomes a particle at its own
     screen position and enters an eight-mode, equal-weight,
     equal-variance sampler under
         z += η·M·∇log p + √(ηT)·G·ξ,  M = diag(1,.68), GGᵀ = 2M
     IN VIVO holds T = 1. FIXED anneals to T = .05 — a fixed
     section does not sample.
     ═══════════════════════════════════════════════════════════ */
  function hero(cv) {
    var ctx, W = 0, H = 0, cell = 6, cols = 0, rows = 0, N = 0;
    var P = 3, X = [], Z = [], A = null, s = null, m = null, order = null, cur = 0;
    var phase = 'idle', sweeps = 0, overlap = 0, step = 0;
    var parts = [], T = 1, targetT = 1, modes = [], sigma = 30, eta = 14;
    var out = {};
    document.querySelectorAll('[data-h]').forEach(function (el) { out[el.getAttribute('data-h')] = el; });
    var rnd = PE.rng(0x5eed);

    function raster(text, weight) {
      var oc = document.createElement('canvas');
      oc.width = cols; oc.height = rows;
      var g = oc.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, cols, rows);
      var fs = Math.floor(rows * 0.56);
      var font = function (n) { return weight + ' ' + n + 'px "Martian Mono","Noto Sans TC",monospace'; };
      g.font = font(fs);
      while (g.measureText(text).width > cols * 0.92 && fs > 5) { fs -= 1; g.font = font(fs); }
      g.fillStyle = '#fff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, cols / 2, rows / 2 + 1);
      var d = g.getImageData(0, 0, cols, rows).data, o = new Int8Array(N);
      for (var i = 0; i < N; i++) o[i] = d[i * 4] > 110 ? 1 : -1;
      return o;
    }

    function build() {
      var names = PE.lang() === 'zh'
        ? ['李騏維', 'CHI-WEI LEE', 'PE//1']
        : ['CHI-WEI LEE', '李騏維', 'PE//1'];
      X = [raster(names[0], '800'), raster(names[1], '800'), raster(names[2], '300')];
      A = new Float32Array(N);
      var mu, i;
      for (mu = 0; mu < P; mu++) for (i = 0; i < N; i++) A[i] += X[mu][i];
      for (i = 0; i < N; i++) A[i] /= P;
      Z = [];
      for (mu = 0; mu < P; mu++) {
        var z = new Float32Array(N);
        for (i = 0; i < N; i++) z[i] = X[mu][i] - A[i];
        Z.push(z);
      }
      /* corrupt the target at 42 % bit-flip */
      s = new Int8Array(N);
      for (i = 0; i < N; i++) s[i] = rnd() < 0.42 ? -X[0][i] : X[0][i];
      m = new Float32Array(P);
      for (mu = 0; mu < P; mu++) { var acc = 0; for (i = 0; i < N; i++) acc += Z[mu][i] * s[i]; m[mu] = acc / N; }
      order = new Int32Array(N);
      for (i = 0; i < N; i++) order[i] = i;
      for (i = N - 1; i > 0; i--) { var j = (rnd() * (i + 1)) | 0, t = order[i]; order[i] = order[j]; order[j] = t; }
      cur = 0; sweeps = 0; step = 0; phase = 'retrieve'; parts = [];
    }

    function size() {
      var h = cv.clientHeight || 280;
      ctx = fit(cv, h);
      if (!ctx) return false;
      W = cv.clientWidth; H = h;
      cell = W < 560 ? 5 : 6;
      cols = Math.max(8, Math.floor(W / cell));
      rows = Math.max(6, Math.floor(H / cell));
      N = cols * rows;
      return true;
    }

    function sweep(budget) {
      var did = 0;
      while (did < budget) {
        var i = order[cur];
        var h = -(P / N) * s[i];
        for (var mu = 0; mu < P; mu++) h += Z[mu][i] * m[mu];
        var ns = h >= 0 ? 1 : -1;
        if (ns !== s[i]) {
          var d = ns - s[i];
          for (mu = 0; mu < P; mu++) m[mu] += Z[mu][i] * d / N;
          s[i] = ns;
        }
        cur++; did++;
        if (cur >= N) { cur = 0; sweeps++; }
      }
      /* measured overlap with the cue, normalised by its own norm */
      var num = 0, den = 0;
      for (var k = 0; k < N; k++) { num += Z[0][k] * s[k]; den += Z[0][k] * Z[0][k]; }
      overlap = den > 0 ? num / den : 0;
    }

    function release() {
      parts = [];
      var stride = Math.max(1, Math.ceil(N / 1500));
      for (var i = 0; i < N; i += stride) {
        if (s[i] !== 1) continue;
        var x = (i % cols) * cell + cell / 2, y = ((i / cols) | 0) * cell + cell / 2;
        parts.push({ x: x, y: y, vx: 0, vy: 0 });
      }
      modes = [];
      var cx = W / 2, cy = H / 2, R = Math.min(W * 0.34, H * 0.9);
      for (var k = 0; k < 8; k++) {
        var a = (k / 8) * Math.PI * 2 + 0.39;
        modes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.46 });
      }
      sigma = Math.max(16, Math.min(W, H) * 0.075);
      eta = sigma * sigma * 0.016;
      phase = 'sample';
    }

    function langevin(dt) {
      var n = parts.length, s2 = sigma * sigma;
      var kT = Math.sqrt(Math.max(0, eta * T));
      var gx = Math.SQRT2, gy = Math.sqrt(2 * 0.68);
      for (var i = 0; i < n; i++) {
        var p = parts[i], sx = 0, sy = 0, tot = 0, q = [];
        for (var k = 0; k < 8; k++) {
          var dx = modes[k].x - p.x, dy = modes[k].y - p.y;
          var w = Math.exp(-(dx * dx + dy * dy) / (2 * s2));
          q.push(w); tot += w;
        }
        if (tot < 1e-12) { tot = 1; q[0] = 1; }
        for (k = 0; k < 8; k++) {
          var r = q[k] / tot;
          sx += r * (modes[k].x - p.x) / s2;
          sy += r * (modes[k].y - p.y) / s2;
        }
        p.x += eta * 1.0 * sx + kT * gx * gauss();
        p.y += eta * 0.68 * sy + kT * gy * gauss();
      }
      step++;
    }
    var spare = null;
    function gauss() {
      if (spare !== null) { var v = spare; spare = null; return v; }
      var u, w, c;
      do { u = rnd() * 2 - 1; w = rnd() * 2 - 1; c = u * u + w * w; } while (c >= 1 || c === 0);
      c = Math.sqrt(-2 * Math.log(c) / c);
      spare = w * c; return u * c;
    }

    function covered() {
      var hit = 0, s15 = (1.5 * sigma) * (1.5 * sigma);
      for (var k = 0; k < 8; k++) {
        var n = 0;
        for (var i = 0; i < parts.length; i++) {
          var dx = parts[i].x - modes[k].x, dy = parts[i].y - modes[k].y;
          if (dx * dx + dy * dy < s15) { n++; if (n > parts.length * 0.01) break; }
        }
        if (n > parts.length * 0.01) hit++;
      }
      return hit;
    }

    function readout() {
      var L = PE.lang();
      if (out.ret) out.ret.textContent = phase === 'retrieve'
        ? (L === 'zh' ? '進行中' : 'RUNNING')
        : (L === 'zh' ? '完成' : 'SETTLED');
      if (out.m) out.m.textContent = overlap.toFixed(3);
      if (out.modes) out.modes.textContent = phase === 'sample' ? covered() + '/8' : '8';
      if (out.temp) out.temp.textContent = T.toFixed(2);
      if (out.step) out.step.textContent = phase === 'retrieve' ? sweeps + '×' : String(step);
    }

    var acc = 0;
    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G();
      T += (targetT - T) * Math.min(1, dt / 400);
      ctx.clearRect(0, 0, W, H);

      if (phase === 'retrieve') {
        sweep(Math.max(200, (N / 26) | 0));
        drawLattice(c);
        if (overlap > 0.955 || sweeps >= 22) release();
      } else if (phase === 'sample') {
        var reps = PE.reduced ? 0 : 1;
        for (var r = 0; r < reps; r++) langevin(dt);
        drawParticles(c);
      }
      acc += dt;
      if (acc > 200) { acc = 0; readout(); }
    }

    function drawLattice(c) {
      var d = cell - 1.4;
      ctx.fillStyle = rgb(c.sig, 0.9);
      var shadow = PE.mode() === 'vivo';
      if (shadow) { ctx.shadowColor = rgb(c.sig, 0.55); ctx.shadowBlur = 6; }
      for (var i = 0; i < N; i++) {
        if (s[i] !== 1) continue;
        ctx.fillRect((i % cols) * cell, ((i / cols) | 0) * cell, d, d);
      }
      ctx.shadowBlur = 0;
      /* the residual: cells still disagreeing with the cue */
      ctx.fillStyle = rgb(c.pre, 0.5);
      for (i = 0; i < N; i++) {
        if (s[i] === X[0][i]) continue;
        ctx.fillRect((i % cols) * cell + cell * 0.3, ((i / cols) | 0) * cell + cell * 0.3, d * 0.42, d * 0.42);
      }
    }

    function drawParticles(c) {
      var vivo = PE.mode() === 'vivo';
      if (vivo) { ctx.shadowColor = rgb(c.sig, 0.5); ctx.shadowBlur = 7; }
      ctx.fillStyle = rgb(c.sig, vivo ? 0.85 : 0.7);
      for (var i = 0; i < parts.length; i++) {
        ctx.fillRect(parts[i].x - 1.1, parts[i].y - 1.1, 2.2, 2.2);
      }
      ctx.shadowBlur = 0;
      /* mode centres, drawn only as the crosshairs of a measurement */
      ctx.strokeStyle = rgb(c.pre, 0.42); ctx.lineWidth = 1;
      for (var k = 0; k < 8; k++) {
        var mo = modes[k];
        ctx.beginPath();
        ctx.moveTo(mo.x - 5, mo.y); ctx.lineTo(mo.x + 5, mo.y);
        ctx.moveTo(mo.x, mo.y - 5); ctx.lineTo(mo.x, mo.y + 5);
        ctx.stroke();
      }
    }

    function boot() {
      if (!size()) { setTimeout(boot, 120); return; }
      build();
      targetT = PE.mode() === 'fixed' ? 0.05 : 1;
      T = targetT;
      mount(cv, 'hero', frame, function () { if (size()) { build(); } });
      if (PE.reduced) { sweep(N * 24); release(); for (var i = 0; i < 260; i++) langevin(16.7); frame(16.7); }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

    /* the theme toggle is a real temperature schedule */
    PE.on('modechange', function (mode) { targetT = mode === 'fixed' ? 0.05 : 1; });
    /* the language toggle is a new retrieval cue */
    PE.on('langchange', function () { if (size()) { build(); } });
    cv.addEventListener('click', function () { if (size()) build(); PE.stimulate(1.2); });
    cv.style.cursor = 'crosshair';
  }

  /* ═════════════════════════════════════════════════════════════
     2. FIGURE — Hopfield retrieval, with the corruption in your hand
     ═══════════════════════════════════════════════════════════ */
  function figHopfield(fig) {
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]');
    var ctl = fig.querySelector('[data-ctl]');
    var cols = 60, rows = 26, N = cols * rows, P = 3;
    var X = [], Z = [], A, s, m, cur = 0, sweeps = 0, ov = 0, noise = 0.42, settled = false;
    var rnd = PE.rng(0xbeef), ctx, W, H, cell;
    var WORDS = ['HOPE', 'PE//1', 'MAP'];

    function raster(text, weight) {
      var oc = document.createElement('canvas'); oc.width = cols; oc.height = rows;
      var g = oc.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, cols, rows);
      var fs = Math.floor(rows * 0.72), font = function (n) { return weight + ' ' + n + 'px "Martian Mono",monospace'; };
      g.font = font(fs);
      while (g.measureText(text).width > cols * 0.88 && fs > 4) { fs--; g.font = font(fs); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, cols / 2, rows / 2);
      var d = g.getImageData(0, 0, cols, rows).data, o = new Int8Array(N);
      for (var i = 0; i < N; i++) o[i] = d[i * 4] > 110 ? 1 : -1;
      return o;
    }
    function store() {
      X = WORDS.map(function (w, i) { return raster(w, i === 0 ? '800' : '400'); });
      A = new Float32Array(N);
      var mu, i;
      for (mu = 0; mu < P; mu++) for (i = 0; i < N; i++) A[i] += X[mu][i];
      for (i = 0; i < N; i++) A[i] /= P;
      Z = X.map(function (x) {
        var z = new Float32Array(N);
        for (var k = 0; k < N; k++) z[k] = x[k] - A[k];
        return z;
      });
    }
    function corrupt() {
      s = new Int8Array(N);
      for (var i = 0; i < N; i++) s[i] = rnd() < noise ? -X[0][i] : X[0][i];
      m = new Float32Array(P);
      for (var mu = 0; mu < P; mu++) { var a = 0; for (i = 0; i < N; i++) a += Z[mu][i] * s[i]; m[mu] = a / N; }
      cur = 0; sweeps = 0; settled = false;
    }
    function stepN(budget) {
      var did = 0, flips = 0;
      while (did < budget) {
        var i = cur % N;
        var h = -(P / N) * s[i];
        for (var mu = 0; mu < P; mu++) h += Z[mu][i] * m[mu];
        var ns = h >= 0 ? 1 : -1;
        if (ns !== s[i]) { var d = ns - s[i]; for (mu = 0; mu < P; mu++) m[mu] += Z[mu][i] * d / N; s[i] = ns; flips++; }
        cur++; did++;
        if (cur % N === 0) sweeps++;
      }
      var num = 0, den = 0;
      for (var k = 0; k < N; k++) { num += Z[0][k] * s[k]; den += Z[0][k] * Z[0][k]; }
      ov = den > 0 ? num / den : 0;
      if (flips === 0 && sweeps > 0) settled = true;
      return flips;
    }
    function size() {
      var w = cv.clientWidth; if (!w) return false;
      cell = Math.max(3, Math.floor(w / cols));
      W = w; H = cell * rows + 2;
      ctx = fit(cv, H);
      return !!ctx;
    }
    var acc = 0;
    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G();
      if (!settled) stepN(Math.max(120, (N / 22) | 0));
      ctx.clearRect(0, 0, W, H);
      var ox = (W - cols * cell) / 2, d = cell - 1;
      ctx.fillStyle = rgb(c.sig, 0.9);
      for (var i = 0; i < N; i++) if (s[i] === 1) ctx.fillRect(ox + (i % cols) * cell, ((i / cols) | 0) * cell, d, d);
      ctx.fillStyle = rgb(c.pre, 0.55);
      for (i = 0; i < N; i++) if (s[i] !== X[0][i]) ctx.fillRect(ox + (i % cols) * cell + cell * 0.28, ((i / cols) | 0) * cell + cell * 0.28, d * 0.44, d * 0.44);
      acc += dt;
      if (acc > 180 && outEl) {
        acc = 0;
        outEl.textContent = 'm = ' + ov.toFixed(3) + ' · ' + sweeps + (PE.lang() === 'zh' ? ' 次掃描' : ' sweeps')
          + (settled ? (PE.lang() === 'zh' ? ' · 已收斂' : ' · settled') : '');
      }
    }
    store(); corrupt();
    control(ctl, {
      label: { en: 'Bit-flip corruption', zh: '位元翻轉損壞率' },
      min: 0, max: 0.6, step: 0.01, value: 0.42,
      format: function (v) { return (v * 100).toFixed(0) + '%'; },
      onInput: function (v) { noise = v; corrupt(); }
    });
    mount(fig, 'hopfield', frame, function () { size(); });
    size();
  }

  /* ═════════════════════════════════════════════════════════════
     3. FIGURE — descent finds the mode; sampling finds the posterior
     ═══════════════════════════════════════════════════════════ */
  function figLangevin(fig) {
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]'), ctl = fig.querySelector('[data-ctl]');
    var ctx, W, H, half, T = 1, modes = [], sigma = 20, eta = 6;
    var A = [], B = [], n = 200, rnd = PE.rng(0x1a2b), spare = null;
    function gauss() {
      if (spare !== null) { var v = spare; spare = null; return v; }
      var u, w, c; do { u = rnd() * 2 - 1; w = rnd() * 2 - 1; c = u * u + w * w; } while (c >= 1 || c === 0);
      c = Math.sqrt(-2 * Math.log(c) / c); spare = w * c; return u * c;
    }
    function size() {
      var w = cv.clientWidth; if (!w) return false;
      W = w; H = Math.max(200, Math.min(300, w * 0.42));
      ctx = fit(cv, H); if (!ctx) return false;
      half = W / 2;
      var cx = half / 2, cy = H / 2, R = Math.min(half * 0.30, H * 0.31);
      sigma = Math.max(9, R * 0.30);
      eta = sigma * sigma * 0.020;
      modes = [];
      for (var k = 0; k < 8; k++) {
        var a = (k / 8) * Math.PI * 2 + 0.4;
        modes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }
      A = []; B = [];
      for (var i = 0; i < n; i++) {
        A.push({ x: cx + gauss() * R * 0.16, y: cy + gauss() * R * 0.16 });
        B.push({ x: cx + gauss() * R * 0.16, y: cy + gauss() * R * 0.16 });
      }
      return true;
    }
    function score(p) {
      var sx = 0, sy = 0, tot = 0, q = [], s2 = sigma * sigma;
      for (var k = 0; k < 8; k++) {
        var dx = modes[k].x - p.x, dy = modes[k].y - p.y;
        var w = Math.exp(-(dx * dx + dy * dy) / (2 * s2));
        q.push(w); tot += w;
      }
      if (tot < 1e-12) { tot = 1; q[0] = 1; }
      for (k = 0; k < 8; k++) { var r = q[k] / tot; sx += r * (modes[k].x - p.x) / s2; sy += r * (modes[k].y - p.y) / s2; }
      return [sx, sy];
    }
    /* Both columns end up sitting on modes, so counting modes does not
       separate them. What separates them is width: descent returns point
       masses and keeps none of the posterior's shape, while the sampler
       reproduces the true spread. Measure the spread and report it in
       units of the density's own sigma. */
    function spread(set) {
      var acc = 0;
      for (var i = 0; i < set.length; i++) {
        var best = Infinity;
        for (var k = 0; k < 8; k++) {
          var dx = set[i].x - modes[k].x, dy = set[i].y - modes[k].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
        acc += best;
      }
      return Math.sqrt(acc / Math.max(1, set.length)) / sigma;
    }
    var acc = 0;
    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G(), i, g;
      for (i = 0; i < n; i++) {          /* left: descent only */
        g = score(A[i]); A[i].x += eta * g[0]; A[i].y += eta * 0.68 * g[1];
      }
      var kT = Math.sqrt(Math.max(0, eta * T));
      for (i = 0; i < n; i++) {          /* right: descend and diffuse */
        g = score(B[i]);
        B[i].x += eta * g[0] + kT * Math.SQRT2 * gauss();
        B[i].y += eta * 0.68 * g[1] + kT * Math.sqrt(2 * 0.68) * gauss();
      }
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = rgb(c.muted, 0.28); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(half, 8); ctx.lineTo(half, H - 8); ctx.stroke();
      [[A, 0, c.pre], [B, half, c.sig]].forEach(function (grp) {
        var set = grp[0], ox = grp[1], col = grp[2];
        ctx.strokeStyle = rgb(c.muted, 0.30);
        for (var k = 0; k < 8; k++) {
          ctx.beginPath();
          ctx.arc(modes[k].x + ox, modes[k].y, sigma, 0, 6.2832);
          ctx.stroke();
        }
        ctx.fillStyle = rgb(col, 0.8);
        for (var i2 = 0; i2 < set.length; i2++) ctx.fillRect(set[i2].x + ox - 1.2, set[i2].y - 1.2, 2.4, 2.4);
      });
      ctx.font = '600 10px "Martian Mono",monospace';
      ctx.fillStyle = rgb(c.pre, 0.9);
      ctx.fillText(PE.lang() === 'zh' ? '梯度下降 · MAP' : 'DESCENT · MAP', 10, H - 10);
      ctx.fillStyle = rgb(c.sig, 0.9);
      ctx.fillText(PE.lang() === 'zh' ? 'LANGEVIN · 後驗' : 'LANGEVIN · POSTERIOR', half + 10, H - 10);
      acc += dt;
      if (acc > 200 && outEl) {
        acc = 0;
        var L = PE.lang() === 'zh';
        outEl.textContent = (L ? '下降寬度 ' : 'descent width ') + spread(A).toFixed(2) + 'σ · '
          + (L ? '取樣寬度 ' : 'sampled width ') + spread(B).toFixed(2) + 'σ · T = ' + T.toFixed(2);
      }
    }
    size();
    control(ctl, {
      label: { en: 'Temperature T', zh: '溫度 T' },
      min: 0, max: 2, step: 0.05, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { T = v; }
    });
    mount(fig, 'langevin', frame, function () { size(); });
  }

  /* ═════════════════════════════════════════════════════════════
     4. FIGURE — a population vector, and what it costs to lose voxels
     ═══════════════════════════════════════════════════════════ */
  function figFmri(fig) {
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]'), ctl = fig.querySelector('[data-ctl]');
    var ctx, W, H, V = 48, vox = [], drop = 0, t = 0, err = 0, rmse = 0, rnd = PE.rng(0xf3a1);
    function make() {
      vox = [];
      for (var i = 0; i < V; i++) {
        vox.push({ p: (i + 0.5) / V, w: 0.055 + rnd() * 0.05, live: true, r: 0 });
      }
      apply();
    }
    function apply() {
      var kill = Math.round(V * drop), idx = [];
      for (var i = 0; i < V; i++) { vox[i].live = true; idx.push(i); }
      for (i = idx.length - 1; i > 0; i--) { var j = (rnd() * (i + 1)) | 0, tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
      for (i = 0; i < kill; i++) vox[idx[i]].live = false;
    }
    function size() { var w = cv.clientWidth; if (!w) return false; W = w; H = Math.max(190, Math.min(260, w * 0.36)); ctx = fit(cv, H); return !!ctx; }
    var acc = 0, k = 0;
    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G();
      t += dt * 0.00045;
      var x = 0.5 + 0.36 * Math.sin(t * 1.6);
      var num = 0, den = 0;
      for (var i = 0; i < V; i++) {
        var v = vox[i];
        if (!v.live) { v.r = 0; continue; }
        var z = (x - v.p) / v.w;
        v.r = Math.max(0, Math.exp(-0.5 * z * z) + (rnd() - 0.5) * 0.09);
        num += v.r * v.p; den += v.r;
      }
      var xh = den > 1e-6 ? num / den : 0.5;
      err = Math.abs(xh - x);
      rmse += (err * err - rmse) * 0.03;

      ctx.clearRect(0, 0, W, H);
      var pad = 14, w = W - pad * 2, base = H - 26;
      /* tuning curves, faint */
      ctx.lineWidth = 1;
      for (i = 0; i < V; i++) {
        var vv = vox[i];
        ctx.strokeStyle = rgb(vv.live ? c.muted : c.muted, vv.live ? 0.20 : 0.06);
        ctx.beginPath();
        for (var q = 0; q <= 40; q++) {
          var px = q / 40, zz = (px - vv.p) / vv.w, y = base - Math.exp(-0.5 * zz * zz) * (base - 30) * 0.42;
          q ? ctx.lineTo(pad + px * w, y) : ctx.moveTo(pad + px * w, y);
        }
        ctx.stroke();
      }
      /* live population response */
      for (i = 0; i < V; i++) {
        var v2 = vox[i];
        if (!v2.live) continue;
        var bx = pad + v2.p * w, bh = v2.r * (base - 30) * 0.78;
        ctx.fillStyle = rgb(c.sig, 0.75);
        ctx.fillRect(bx - 1.6, base - bh, 3.2, bh);
      }
      /* axis */
      ctx.strokeStyle = rgb(c.muted, 0.4);
      ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(pad + w, base); ctx.stroke();
      /* truth and estimate */
      function marker(px, col, label) {
        var mx = pad + px * w;
        ctx.strokeStyle = rgb(col, 0.9); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, 22); ctx.lineTo(mx, base + 6); ctx.stroke();
        ctx.fillStyle = rgb(col, 0.95);
        ctx.font = '600 9px "Martian Mono",monospace';
        ctx.fillText(label, mx + 4, 20);
      }
      marker(x, c.pre, PE.lang() === 'zh' ? '真實' : 'TRUE');
      marker(xh, c.sig, PE.lang() === 'zh' ? '解碼' : 'DECODED');

      acc += dt;
      if (acc > 200 && outEl) {
        acc = 0;
        var live = vox.filter(function (v) { return v.live; }).length;
        outEl.textContent = live + '/' + V + ' ' + (PE.lang() === 'zh' ? '體素' : 'voxels')
          + ' · RMSE ' + Math.sqrt(rmse).toFixed(3);
      }
    }
    make(); size();
    control(ctl, {
      label: { en: 'Voxels dropped', zh: '移除體素比例' },
      min: 0, max: 0.9, step: 0.02, value: 0,
      format: function (v) { return (v * 100).toFixed(0) + '%'; },
      onInput: function (v) { drop = v; apply(); rmse = 0; }
    });
    mount(fig, 'fmri', frame, function () { size(); });
  }

  /* ═════════════════════════════════════════════════════════════
     5. FIGURE — reliability rises, diversity collapses, and the
        useful window between them is narrow. (MatrixQR's thesis.)
     ═══════════════════════════════════════════════════════════ */
  function figGuidance(fig) {
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]'), ctl = fig.querySelector('[data-ctl]');
    var ctx, W, H, wGuide = 1.2, curve = [], cloud = [], rnd = PE.rng(0x0c0f), spare = null;
    var STEPS = 14, NS = 150;
    function gauss() {
      if (spare !== null) { var v = spare; spare = null; return v; }
      var u, w, c; do { u = rnd() * 2 - 1; w = rnd() * 2 - 1; c = u * u + w * w; } while (c >= 1 || c === 0);
      c = Math.sqrt(-2 * Math.log(c) / c); spare = w * c; return u * c;
    }
    /* the constraint is an annulus: "still scannable". The base model
       is broad: "creative". Guidance pulls samples onto the annulus. */
    function run(w) {
      var pts = [], i, k;
      for (i = 0; i < NS; i++) pts.push({ x: gauss() * 0.42, y: gauss() * 0.42 });
      for (k = 0; k < STEPS; k++) {
        for (i = 0; i < NS; i++) {
          var p = pts[i], r = Math.hypot(p.x, p.y) || 1e-6;
          var pull = (0.55 - r) * w * 0.22;          /* ∇ towards the ring */
          p.x += (p.x / r) * pull + gauss() * 0.012;
          p.y += (p.y / r) * pull + gauss() * 0.012;
        }
      }
      var ok = 0;
      for (i = 0; i < NS; i++) {
        var rr = Math.hypot(pts[i].x, pts[i].y);
        if (rr > 0.46 && rr < 0.64) ok++;
      }
      /* diversity: mean pairwise distance, normalised by the base spread */
      var acc = 0, cnt = 0;
      for (i = 0; i < NS; i += 3) for (k = i + 3; k < NS; k += 3) {
        acc += Math.hypot(pts[i].x - pts[k].x, pts[i].y - pts[k].y); cnt++;
      }
      var div = cnt ? (acc / cnt) / 0.94 : 0;
      return { pts: pts, rel: ok / NS, div: Math.min(1, div) };
    }
    function sweep() {
      curve = [];
      for (var i = 0; i <= 24; i++) {
        var w = i / 24 * 4;
        var r = run(w);
        curve.push({ w: w, rel: r.rel, div: r.div });
      }
    }
    function size() { var w = cv.clientWidth; if (!w) return false; W = w; H = Math.max(220, Math.min(300, w * 0.40)); ctx = fit(cv, H); return !!ctx; }
    function frame() {
      if (!ctx && !size()) return;
      var c = G();
      ctx.clearRect(0, 0, W, H);
      var split = Math.min(W * 0.44, H * 1.1), pad = 14;

      /* left: the sample cloud at the current guidance */
      var cx = split / 2, cy = H / 2, R = Math.min(split, H) * 0.40;
      ctx.strokeStyle = rgb(c.muted, 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.46 / 0.55, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.64 / 0.55, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = rgb(c.sig, 0.75);
      for (var i = 0; i < cloud.length; i++) {
        var p = cloud[i];
        ctx.fillRect(cx + p.x * (R / 0.55) - 1.2, cy + p.y * (R / 0.55) - 1.2, 2.4, 2.4);
      }
      ctx.font = '600 9px "Martian Mono",monospace';
      ctx.fillStyle = rgb(c.muted, 0.9);
      ctx.fillText(PE.lang() === 'zh' ? '約束環 = 仍可掃描' : 'RING = STILL SCANNABLE', 10, H - 10);

      /* right: the two curves */
      var x0 = split + pad, x1 = W - pad, y0 = 22, y1 = H - 28, gw = x1 - x0, gh = y1 - y0;
      ctx.strokeStyle = rgb(c.muted, 0.30);
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
      function plot(key, col) {
        ctx.strokeStyle = rgb(col, 0.95); ctx.lineWidth = 1.5;
        ctx.beginPath();
        curve.forEach(function (pt, k) {
          var px = x0 + (pt.w / 4) * gw, py = y1 - pt[key] * gh;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
      plot('rel', G().sig);
      plot('div', G().pre);
      var mx = x0 + (wGuide / 4) * gw;
      ctx.strokeStyle = rgb(c.ink, 0.55); ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(mx, y0); ctx.lineTo(mx, y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rgb(c.sig, 0.95);
      ctx.fillText(PE.lang() === 'zh' ? '可靠度' : 'RELIABILITY', x0 + 4, y0 + 2);
      ctx.fillStyle = rgb(c.pre, 0.95);
      ctx.fillText(PE.lang() === 'zh' ? '多樣性' : 'DIVERSITY', x0 + 4, y0 + 14);
      ctx.fillStyle = rgb(c.muted, 0.8);
      ctx.fillText('w = 0', x0, y1 + 14);
      ctx.fillText('w = 4', x1 - 26, y1 + 14);
    }
    function recompute() {
      var r = run(wGuide);
      cloud = r.pts;
      if (outEl) {
        outEl.textContent = 'w = ' + wGuide.toFixed(1)
          + ' · ' + (PE.lang() === 'zh' ? '可靠度 ' : 'reliability ') + r.rel.toFixed(2)
          + ' · ' + (PE.lang() === 'zh' ? '多樣性 ' : 'diversity ') + r.div.toFixed(2);
      }
      frame();
    }
    size(); sweep();
    control(ctl, {
      label: { en: 'Guidance strength w', zh: '引導強度 w' },
      min: 0, max: 4, step: 0.1, value: 1.2,
      format: function (v) { return v.toFixed(1); },
      onInput: function (v) { wGuide = v; recompute(); }
    });
    /* static figure: it recomputes on input, it does not animate */
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { size(); recompute(); } }, { rootMargin: '120px' });
    io.observe(fig);
    addEventListener('resize', PE.debounce(function () { size(); frame(); }, 220), { passive: true });
    PE.on('modechange', function () { setTimeout(frame, 40); });
    PE.on('langchange', recompute);
  }

  /* ═════════════════════════════════════════════════════════════
     6. FIGURE — the relationship map. An edge exists only where the
        work actually uses the thread; the gaps are real gaps.
     ═══════════════════════════════════════════════════════════ */
  function figMap(fig) {
    var el = document.getElementById('fig-map');
    if (!el) return;
    var data = JSON.parse(el.textContent);
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]');
    var ctx, W, H, nodes = {}, hot = null, reveal = 0;

    function size() {
      var w = cv.clientWidth; if (!w) return false;
      W = w; H = Math.max(320, Math.min(460, w * 0.55));
      ctx = fit(cv, H); if (!ctx) return false;
      var th = data.nodes.filter(function (n) { return n.kind === 'thread'; });
      var pa = data.nodes.filter(function (n) { return n.kind === 'paper'; });
      var lx = W < 620 ? W * 0.24 : W * 0.22, rx = W < 620 ? W * 0.76 : W * 0.78;
      th.forEach(function (n, i) { nodes[n.id] = { x: lx, y: 44 + (H - 88) * (i / Math.max(1, th.length - 1)), n: n }; });
      pa.forEach(function (n, i) { nodes[n.id] = { x: rx, y: 34 + (H - 68) * (i / Math.max(1, pa.length - 1)), n: n }; });
      return true;
    }
    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G();
      reveal = Math.min(1, reveal + (dt || 16.7) / 900);
      ctx.clearRect(0, 0, W, H);

      data.edges.forEach(function (e2, ei) {
        var a = nodes[e2.a], b = nodes[e2.b];
        if (!a || !b) return;
        var lit = !hot || hot === e2.a || hot === e2.b;
        var ex = a.x + (b.x - a.x) * reveal, ey = a.y + (b.y - a.y) * reveal;
        ctx.strokeStyle = rgb(b.n.kind === 'paper' ? c.sig : c.inh, lit ? 0.62 : 0.10);
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        if (Math.abs(b.x - a.x) < 2) {
          /* thread to thread: both live in the same column, so bow the
             edge out of it — overlapping straight segments read as one */
          var bow = 26 + Math.abs(b.y - a.y) * 0.22 + ei * 5;
          ctx.bezierCurveTo(a.x - bow, a.y, a.x - bow, b.y, ex, ey);
        } else {
          var mid = (a.x + b.x) / 2;
          ctx.bezierCurveTo(mid, a.y, mid, b.y, ex, ey);
        }
        ctx.stroke();
      });

      Object.keys(nodes).forEach(function (k) {
        var nd = nodes[k], isThread = nd.n.kind === 'thread';
        var lit = !hot || hot === k || data.edges.some(function (e2) {
          return (e2.a === hot && e2.b === k) || (e2.b === hot && e2.a === k);
        });
        var col = isThread ? c.inh : c.sig;
        ctx.fillStyle = rgb(col, lit ? 0.95 : 0.2);
        ctx.strokeStyle = rgb(col, lit ? 0.95 : 0.2);
        ctx.lineWidth = 1;
        if (isThread) { ctx.beginPath(); ctx.arc(nd.x, nd.y, 4.5, 0, 6.2832); ctx.fill(); }
        else { ctx.strokeRect(nd.x - 4, nd.y - 4, 8, 8); }
        ctx.font = '600 10px "Martian Mono","Noto Sans TC",monospace';
        ctx.fillStyle = rgb(c.ink, lit ? 0.92 : 0.22);
        var label = PE.t(nd.n.label);
        if (label.length > 30) label = label.slice(0, 29) + '…';
        ctx.textAlign = isThread ? 'right' : 'left';
        ctx.fillText(label, nd.x + (isThread ? -11 : 11), nd.y + 3.5);
      });
      ctx.textAlign = 'left';
    }
    cv.addEventListener('pointermove', function (ev) {
      var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, found = null;
      Object.keys(nodes).forEach(function (k) {
        var nd = nodes[k];
        if (Math.hypot(mx - nd.x, my - nd.y) < 26) found = k;
      });
      if (found !== hot) {
        hot = found;
        if (outEl) {
          if (hot) {
            var edges = data.edges.filter(function (e2) { return e2.a === hot || e2.b === hot; });
            outEl.textContent = edges.length
              ? edges.map(function (e2) { return PE.t(e2.why); }).join(' · ')
              : (PE.lang() === 'zh' ? '沒有連線' : 'no edges');
          } else {
            outEl.textContent = data.nodes.length + (PE.lang() === 'zh' ? ' 節點 · ' : ' nodes · ')
              + data.edges.length + (PE.lang() === 'zh' ? ' 連線' : ' edges');
          }
        }
        frame(0);
      }
    });
    cv.addEventListener('pointerleave', function () { hot = null; frame(0); });
    size();
    if (outEl) outEl.textContent = data.nodes.length + ' nodes · ' + data.edges.length + ' edges';
    mount(fig, 'map', frame, function () { size(); });
  }

  /* ═════════════════════════════════════════════════════════════
     7. FIGURE — the record as a spike train. One tick per fact.
     ═══════════════════════════════════════════════════════════ */
  function figCareer(fig) {
    var el = document.getElementById('fig-career');
    if (!el) return;
    var events = JSON.parse(el.textContent);
    var cv = fig.querySelector('canvas'), outEl = fig.querySelector('[data-out]');
    var ctx, W, H, y0 = 9999, y1 = -9999, scan = 0, hot = -1, place = [];
    events.forEach(function (e2) { y0 = Math.min(y0, e2.year); y1 = Math.max(y1, e2.year); });

    /* an annotated timeline, not a bare raster: every event gets its
       marker, its stem, and its own short label, staggered into rows so
       twelve events over four years read as a composed plate rather
       than a sparse afterthought */
    var PAD = 56, ARM0 = 34, ROWH = 26;

    function layout() {
      var w = W - PAD * 2, span = Math.max(1, y1 - y0), group = {};
      events.forEach(function (e2, i) {
        var k = e2.year + '|' + e2.kind;
        (group[k] || (group[k] = [])).push(i);
      });
      place = new Array(events.length);
      Object.keys(group).forEach(function (k) {
        group[k].forEach(function (i, j) {
          place[i] = {
            x: PAD + ((events[i].year - y0) / span) * w + (j - (group[k].length - 1) / 2) * 10,
            row: j
          };
        });
      });
    }
    function size() {
      var w = cv.clientWidth; if (!w) return false;
      W = w; H = Math.max(240, Math.min(300, w * 0.30));
      ctx = fit(cv, H); if (!ctx) return false;
      layout(); return true;
    }

    function frame(dt) {
      if (!ctx && !size()) return;
      var c = G(), L = PE.lang() === 'zh';
      scan = Math.min(1, scan + (dt || 16.7) / 1400);
      ctx.clearRect(0, 0, W, H);
      var w = W - PAD * 2, mid = H * 0.52, span = Math.max(1, y1 - y0);

      /* alternating year fields, the way a print lays flat colour */
      for (var yy = y0; yy <= y1; yy++) {
        if ((yy - y0) % 2) continue;
        var xa = PAD + ((yy - y0) / span) * w - w / span / 2;
        ctx.fillStyle = rgb(c.muted, 0.055);
        ctx.fillRect(Math.max(8, xa), 16, w / span, H - 44);
      }

      /* the keyblock axis, ending in the wave curl */
      ctx.strokeStyle = rgb(c.ink, 0.55); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(10, mid); ctx.lineTo(PAD + w + 4, mid);
      /* the curl: a tightening spiral at the line's end */
      var sx = PAD + w + 4, sy = mid;
      for (var t = 0; t <= 1.001; t += 0.05) {
        var th = t * 4.4, r = 11 * (1 - t * 0.82);
        ctx.lineTo(sx + Math.sin(th) * r, sy - 11 + Math.cos(th + 3.14) * r + r * 0);
      }
      ctx.stroke();

      /* years */
      ctx.font = '600 10px "Martian Mono",monospace';
      ctx.textAlign = 'center';
      for (yy = y0; yy <= y1; yy++) {
        var x = PAD + ((yy - y0) / span) * w;
        ctx.strokeStyle = rgb(c.muted, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, mid - 4); ctx.lineTo(x, mid + 4); ctx.stroke();
        ctx.fillStyle = rgb(c.muted, 0.95);
        ctx.fillText(String(yy), x, H - 8);
      }

      /* events: marker + stem + label, staggered */
      ctx.font = '500 9px "Martian Mono","Noto Sans TC",monospace';
      events.forEach(function (e2, i) {
        var pl = place[i];
        if (!pl || (pl.x - PAD) / w > scan) return;
        var lit = hot < 0 || hot === i;
        var label = PE.t(e2.short || e2.label);

        if (e2.kind === 'trip') {
          /* field work sits on the axis it produced */
          ctx.fillStyle = rgb(c.pre, lit ? 0.95 : 0.25);
          ctx.beginPath();
          ctx.moveTo(pl.x, mid - 6); ctx.lineTo(pl.x + 6, mid); ctx.lineTo(pl.x, mid + 6); ctx.lineTo(pl.x - 6, mid);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = rgb(c.ink, lit ? 0.75 : 0.2);
          ctx.textAlign = 'center';
          ctx.fillText(label, pl.x, mid + 20);
          return;
        }

        var up = e2.kind === 'paper';
        var col = up ? c.sig : c.pre;
        var ey = up ? mid - ARM0 - pl.row * ROWH : mid + ARM0 + pl.row * ROWH;

        ctx.strokeStyle = rgb(col, lit ? 0.6 : 0.15); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pl.x, mid + (up ? -5 : 5)); ctx.lineTo(pl.x, ey + (up ? 5 : -5)); ctx.stroke();

        if (up) {
          /* papers: the open circle of the keyblock */
          ctx.strokeStyle = rgb(col, lit ? 0.95 : 0.25); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(pl.x, ey, 4.5, 0, 6.2832); ctx.stroke();
        } else {
          /* awards: the filled diamond */
          ctx.fillStyle = rgb(col, lit ? 0.95 : 0.25);
          ctx.beginPath();
          ctx.moveTo(pl.x, ey - 5.5); ctx.lineTo(pl.x + 5.5, ey); ctx.lineTo(pl.x, ey + 5.5); ctx.lineTo(pl.x - 5.5, ey);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = rgb(c.ink, lit ? 0.85 : 0.22);
        ctx.textAlign = 'center';
        ctx.fillText(label, pl.x, up ? ey - 10 : ey + 16);
      });
      ctx.textAlign = 'left';

      /* legend, one quiet row */
      ctx.font = '600 9px "Martian Mono",monospace';
      var lx = 12;
      ctx.strokeStyle = rgb(c.sig, 0.9); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(lx + 4, 12, 3.5, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = rgb(c.sig, 0.92); ctx.fillText(L ? '論文' : 'PAPERS', lx + 13, 15);
      lx += L ? 52 : 68;
      ctx.fillStyle = rgb(c.pre, 0.92);
      ctx.beginPath(); ctx.moveTo(lx + 4, 8); ctx.lineTo(lx + 8, 12); ctx.lineTo(lx + 4, 16); ctx.lineTo(lx, 12);
      ctx.closePath(); ctx.fill();
      ctx.fillText(L ? '獎項 · 現場' : 'AWARDS · FIELD', lx + 13, 15);

      if (outEl && hot < 0) {
        outEl.textContent = events.length + (L ? ' 個事件 · ' : ' events · ') + y0 + '–' + y1;
      }
    }

    function hit(mx) {
      var best = -1, bd = 15;
      for (var i = 0; i < place.length; i++) {
        if (!place[i]) continue;
        var d = Math.abs(mx - place[i].x);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    cv.addEventListener('pointermove', function (ev) {
      var r = cv.getBoundingClientRect();
      var i = hit(ev.clientX - r.left);
      if (i === hot) return;
      hot = i;
      if (outEl) {
        outEl.textContent = i >= 0
          ? events[i].year + ' · ' + PE.t(events[i].label)
          : events.length + (PE.lang() === 'zh' ? ' 個事件 · ' : ' events · ') + y0 + '–' + y1;
      }
      frame(0);
    });
    cv.addEventListener('pointerleave', function () { hot = -1; frame(0); });
    cv.style.cursor = 'crosshair';

    size();
    mount(fig, 'career', frame, function () { size(); scan = 0; });
  }

  /* ── wire up ──────────────────────────────────────────────── */
  function init() {
    var h = document.getElementById('hero');
    if (h) hero(h);
    var R = { hopfield: figHopfield, langevin: figLangevin, fmri: figFmri, guidance: figGuidance, map: figMap, career: figCareer };
    document.querySelectorAll('[data-fig]').forEach(function (fig) {
      var fn = R[fig.getAttribute('data-fig')];
      if (fn) { try { fn(fig); } catch (e) { console.error('figure', fig.getAttribute('data-fig'), e); } }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
