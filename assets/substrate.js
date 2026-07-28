/* ═══════════════════════════════════════════════════════════════
   PE//1 — the substrate: 墨入水 · ink dropped into still water

   Not a picture of ink in water — ink in water. A dye field is
   advected on the GPU through a divergence-free curl-noise flow
   (Bridson), with one extra force: ink is denser than water, so it
   sinks. Everything an ink drop does follows from that:

     the drop enters and billows outward,
     the billow destabilises into lobes,
     the lobes stretch into tendrils as the flow folds them,
     the tendrils sink, thin, and dissolve into haze.

   Two dye fields make the depth: R is fresh ink — sharp filaments —
   and G is haze, which fresh ink slowly becomes; haze diffuses,
   lags the flow, and fades. Crisp over soft is what makes the eye
   read water, not smoke.

   Drops are the only source. One falls into a margin every few
   seconds; a click or S lets one go where you are. Each drop is a
   prediction error arriving — a surprise dissolving into what is
   already known. The still water is 留白: the part of the world
   the model already predicted.

   The register is aizuri-e, 藍摺絵 — the all-Prussian-blue print:
     fixed  Prussian-deepened ink on pale water, under a bokashi
            band at the top of the sheet
     vivo   the same page at night — deep indigo water, the ink
            pale and luminous

   WebGL where available; a quiet, still Canvas2D sheet where not.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PE = window.PE;
  if (!PE) return;

  var cv = document.getElementById('substrate');
  if (!cv) return;

  var S = PE.state;
  var time = 0;
  var mode = 0;                 // 0 vivo, 1 fixed
  var MAXDROPS = 5;

  /* ── shared GLSL ──────────────────────────────────────────── */
  var NOISE = [
    'float hash(vec2 p){ p = fract(p * vec2(127.31, 311.7)); p += dot(p, p + 43.23); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i), b = hash(i + vec2(1.0,0.0));',
    '  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));',
    '  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);',
    '}',
    'float fbm2(vec2 p){',
    '  return vnoise(p) * 0.62 + vnoise(p * 2.13 + 17.7) * 0.38;',
    '}'
  ].join('\n');

  var VERT = [
    'attribute vec2 a;',
    'varying vec2 vUv;',
    'void main(){ vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }'
  ].join('\n');

  /* ── the water ────────────────────────────────────────────── */
  var SIM = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uState;',
    'uniform vec2 uTexel;',
    'uniform float uAspect, uTime, uStir;',
    'uniform vec4 uDrops[' + MAXDROPS + '];',
    'uniform vec4 uJets[' + MAXDROPS + '];',
    NOISE,

    /* the flow: curl of a noise potential — divergence-free by
       construction (Bridson, "Curl-Noise for Procedural Fluid Flow"),
       so the water swirls and folds but never sources or sinks. One
       large slow field carries the billows; one finer field cuts the
       tendrils. */
    'float psi(vec2 p){',
    '  return fbm2(p * 1.35 + vec2(0.0, uTime * 0.020))',
    '       + fbm2(p * 4.10 + vec2(31.7, uTime * 0.034)) * 0.24;',
    '}',
    'vec2 curl(vec2 p){',
    '  vec2 e = vec2(0.024, 0.0);',
    '  float dx = psi(p + e.xy) - psi(p - e.xy);',
    '  float dy = psi(p + e.yx) - psi(p - e.yx);',
    '  return vec2(dy, -dx) / (2.0 * e.x);',
    '}',

    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 p = vec2(uv.x * uAspect, uv.y);',
    '  vec4 s = texture2D(uState, uv);',
    '  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);',
    '  vec4 L = texture2D(uState, uv - tx), R = texture2D(uState, uv + tx);',
    '  vec4 D = texture2D(uState, uv - ty), U = texture2D(uState, uv + ty);',

    /* velocity: ambient swirl, the sink, the stir of the scroll */
    '  vec2 v = curl(p) * 0.9;',
    '  float dense = s.r + s.g * 0.35;',
    '  v.y -= dense * 0.9;',              /* ink is denser than water */
    '  v.y += uStir * 0.3;',

    /* each live drop drives a descending jet for a while — the momentum
       it arrived with. The billow and its lobes come from this colliding
       with the ambient curl, not from any drawn shape */
    '  for (int j = 0; j < ' + MAXDROPS + '; j++) {',
    '    vec4 jt = uJets[j];',
    '    vec2 jd = vec2((uv.x - jt.x) * uAspect, uv.y - jt.y);',
    '    float jg = exp(-dot(jd, jd) / max(1e-5, jt.z * jt.z * 3.2));',
    '    v.y -= jg * jt.w * 1.7;',
    '  }',

    /* semi-Lagrangian advection: fresh ink rides the full flow, haze
       lags it — two layers moving apart is what reads as depth */
    '  vec2 dtv = v * 0.00055;',
    '  float ink  = texture2D(uState, uv - dtv).r;',
    '  float inkAvg = (L.r + R.r + D.r + U.r) * 0.25;',
    '  ink += (ink - inkAvg) * 0.055;',
    '  vec2 hb = uv - dtv * 0.62;',
    '  float haze = texture2D(uState, hb).g;',

    /* haze also diffuses a little */
    '  float hsum = texture2D(uState, hb - tx).g + texture2D(uState, hb + tx).g',
    '             + texture2D(uState, hb - ty).g + texture2D(uState, hb + ty).g;',
    '  haze = mix(haze, hsum * 0.25, 0.22);',

    /* fresh ink ages into haze; both fade — the water clears. The decay
       is dithered: at 8 bits a pure multiplicative fade rounds back to
       itself and freckles of ink would hang in the water forever. */
    '  float dth = hash(uv * 137.0 + fract(uTime * 7.31));',
    '  float aging = ink * 0.0052;',
    '  ink  = max(0.0, ink * 0.9990 - aging - dth * 0.0009);',
    '  haze = max(0.0, haze * 0.9979 + aging - dth * 0.0007);',

    /* a drop, when one is let fall — a ring with a soft core, because
       a real drop enters as a vortex ring seen side-on */
    '  for (int i = 0; i < ' + MAXDROPS + '; i++) {',
    '    vec4 dr = uDrops[i];',
    '    float on = step(0.0001, dr.w);',
    '    vec2 dv = vec2((uv.x - dr.x) * uAspect, uv.y - dr.y);',
    '    float d2 = dot(dv, dv);',
    '    float ring = exp(-pow((sqrt(d2) - dr.z * 0.55) / (dr.z * 0.30), 2.0));',
    '    float core = exp(-d2 / (dr.z * dr.z * 0.22));',
    '    ink += (ring * 0.85 + core * 0.35) * dr.w * on;',
    '  }',

    '  gl_FragColor = clamp(vec4(ink, haze, 0.0, 1.0), 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ── reading the water back ───────────────────────────────── */
  var DRAW = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uState;',
    'uniform vec2 uRes;',
    'uniform float uAspect, uMode, uInt, uLevels;',
    'uniform vec3 uInk, uInkHaze, uBg, uBokashi;',
    NOISE,

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec4 s = texture2D(uState, uv);',

    /* crisp filaments over soft billow — two dyes, two colours */
    '  float fresh = smoothstep(0.015, 0.55, s.r);',
    '  float haze  = smoothstep(0.008, 0.70, s.g);',

    /* the copy sits on still water: the wash lives in the margins */
    '  float colm = smoothstep(0.05, 0.46, abs(uv.x - 0.5));',
    '  float damp = uInt * mix(mix(0.13, 0.05, uMode), 1.0, colm);',
    '  fresh *= damp; haze *= damp;',

    /* 浮世繪 — the sheet opens under a bokashi band, the way a
       print\'s sky is one graded pull of the baren */
    '  vec3 col = uBg;',
    '  float bok = smoothstep(0.84, 1.0, uv.y);',
    '  col = mix(col, uBokashi, bok * bok * mix(0.50, 0.30, uMode));',

    '  col = mix(col, uInkHaze, haze * 0.62);',
    '  col = mix(col, uInk, fresh * 0.84);',

    /* the faintest tooth, so still water is not dead pixels */
    '  vec2 p = vec2(uv.x * uAspect, uv.y);',
    '  col += (vnoise(p * 240.0) - 0.5) * 0.012;',

    '  float b2 = fract(floor(gl_FragCoord.x) * 0.5 + floor(gl_FragCoord.y) * floor(gl_FragCoord.y) * 0.75);',
    '  float b4 = fract(floor(gl_FragCoord.x * 0.5) * 0.5 + floor(gl_FragCoord.y * 0.5) * floor(gl_FragCoord.y * 0.5) * 0.75) * 0.25 + b2;',
    '  col = floor(col * uLevels + b4) / uLevels;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ── WebGL plumbing ───────────────────────────────────────── */
  function initGL() {
    var gl;
    try {
      gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false })
        || cv.getContext('experimental-webgl');
    } catch (e) { return null; }
    if (!gl || gl.isContextLost()) return null;

    function sh(type, src) {
      var o = gl.createShader(type);
      gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
      return o;
    }
    function prog(fsrc) {
      var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, fsrc);
      if (!vs || !fs) return null;
      var pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs);
      gl.bindAttribLocation(pr, 0, 'a');
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return null; }
      return pr;
    }
    var pSim = prog(SIM), pDraw = prog(DRAW);
    if (!pSim || !pDraw) return null;

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var type = gl.UNSIGNED_BYTE;

    function target(w, h, t) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, t, null);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); return null; }
      return { tex: tex, fb: fb };
    }

    var probe = target(4, 4, type);
    if (!probe) return null;
    gl.deleteTexture(probe.tex); gl.deleteFramebuffer(probe.fb);

    function uni(pr, names) {
      var U = {};
      names.forEach(function (n) {
        /* array uniforms are addressed as name[0] on strict drivers */
        U[n] = gl.getUniformLocation(pr, n) || gl.getUniformLocation(pr, n + '[0]');
      });
      return U;
    }
    return {
      gl: gl, type: type, target: target, pSim: pSim, pDraw: pDraw,
      uSim: uni(pSim, ['uState', 'uTexel', 'uAspect', 'uTime', 'uStir', 'uDrops', 'uJets']),
      uDraw: uni(pDraw, ['uState', 'uRes', 'uAspect', 'uMode', 'uInt', 'uLevels',
        'uInk', 'uInkHaze', 'uBg', 'uBokashi'])
    };
  }

  /* ── Canvas2D: a still sheet with sunk tendrils, no animation ── */
  function initCPU() {
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    var perm = new Uint8Array(512), r0 = PE.rng(0x9e37);
    for (var i = 0; i < 256; i++) perm[i] = (r0() * 256) | 0;
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function h2(x, y) { return perm[(perm[x & 255] + (y & 255)) & 255] / 255; }
    function vn(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
      var t = a + (b - a) * u;
      return t + ((c + (d - c) * u) - t) * v;
    }
    return { ctx: ctx, vn: vn, img: null, w: 0, h: 0 };
  }

  var G = null, cpu = null, lost = 0;
  if (!(G = initGL())) cpu = initCPU();
  if (!G && !cpu) return;

  cv.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    lost++;
    PE.loop.remove('substrate');
  });
  cv.addEventListener('webglcontextrestored', function () {
    if (lost > 1) { toCPU(); return; }
    G = initGL();
    if (!G) { toCPU(); return; }
    resize(); colours();
    if (!PE.reduced) startLoop();
  });
  function toCPU() {
    G = null;
    /* a lost 3D context poisons the canvas for 2D — replace it */
    var nc = cv.cloneNode(false);
    cv.parentNode.replaceChild(nc, cv);
    cv = nc;
    cpu = initCPU();
    if (cpu) { resize(); colours(); drawCPU(); }
  }

  /* ── sizing ───────────────────────────────────────────────── */
  var W = 0, H = 0, SW = 0, SH = 0, A = null, B = null, aspect = 1, seeded = 0;

  function resize() {
    var cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight;
    aspect = cw / Math.max(1, ch);
    var px = 2;
    if (innerWidth < 760) px = 3;
    if (cpu) px = 5;
    W = Math.max(2, Math.round(cw / px));
    H = Math.max(2, Math.round(ch / px));
    cv.width = W; cv.height = H;

    if (G) {
      SW = Math.max(96, Math.min(384, Math.round(cw / 3.8)));
      SH = Math.max(64, Math.round(SW / aspect));
      var gl = G.gl;
      if (A) { gl.deleteTexture(A.tex); gl.deleteFramebuffer(A.fb); }
      if (B) { gl.deleteTexture(B.tex); gl.deleteFramebuffer(B.fb); }
      A = G.target(SW, SH, G.type);
      B = G.target(SW, SH, G.type);
      clearWater();
      seeded = 0;
    }
    if (cpu) { cpu.img = cpu.ctx.createImageData(W, H); cpu.w = W; cpu.h = H; }
  }

  function clearWater() {
    var gl = G.gl;
    [A, B].forEach(function (t) {
      if (!t) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  var C = null, INK = [0, 0, 0], HAZE = [0, 0, 0], BOK = [0, 0, 0];
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function hex(v, fb) {
    var m = /^#([0-9a-f]{6})$/i.exec(v || '');
    return m ? [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255] : fb;
  }
  function colours() {
    C = PE.colors();
    INK = hex(css('--ink-drop'), C.ink);
    HAZE = hex(css('--ink-haze'), INK);
    BOK = hex(css('--bokashi'), INK);
  }
  colours(); resize();

  PE.on('modechange', function (m) {
    mode = m === 'fixed' ? 1 : 0;
    colours();
    if (PE.reduced) settle();
    else if (cpu) drawCPU();
  });
  addEventListener('resize', PE.debounce(function () {
    resize();
    if (PE.reduced) settle();
    else if (cpu) drawCPU();
  }, 200), { passive: true });

  /* ── drops ────────────────────────────────────────────────── */
  var drops = [], nextDrop = 2400, rnd = PE.rng(0x4b1d);
  var JETLIFE = 110;
  PE.drop = function (x, y, r, amt) {
    if (drops.length >= MAXDROPS) drops.shift();
    drops.push({ x: x, y: y, r: r || 0.05, amt: amt || 0.8, life: JETLIFE });
  };
  addEventListener('pointerdown', function (e) {
    if (e.target && e.target.closest && e.target.closest('a,button,input,label,dialog,[role="button"]')) return;
    PE.drop(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.05, 0.9);
  }, { passive: true });
  PE.on('pulse', function () {
    PE.drop(S.ptr.has ? S.ptr.x : 0.5, S.ptr.has ? 1 - S.ptr.y : 0.5, 0.065, 1.0);
  });

  function ambient(dt) {
    nextDrop -= dt;
    if (nextDrop > 0) return;
    nextDrop = 25000 + rnd() * 32000;
    /* one drop at a time, high in a margin — it needs room to fall */
    var side = rnd() < 0.5 ? 0.04 + rnd() * 0.20 : 0.76 + rnd() * 0.20;
    PE.drop(side, 0.72 + rnd() * 0.20, 0.030 + rnd() * 0.030, 0.55 + rnd() * 0.35);
  }

  /* ── run ──────────────────────────────────────────────────── */
  var dropBuf = new Float32Array(MAXDROPS * 4);
  var jetBuf = new Float32Array(MAXDROPS * 4);

  function step() {
    var gl = G.gl, u = G.uSim;
    gl.useProgram(G.pSim);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, SW, SH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(u.uState, 0);
    gl.uniform2f(u.uTexel, 1 / SW, 1 / SH);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uStir, Math.max(-1.5, Math.min(1.5, S.vel)));

    for (var k = 0; k < dropBuf.length; k++) { dropBuf[k] = 0; jetBuf[k] = 0; }
    for (var i = 0; i < drops.length && i < MAXDROPS; i++) {
      var d = drops[i];
      /* ink enters over the first few frames; the momentum outlives it */
      var born = JETLIFE - d.life;
      dropBuf[i * 4] = d.x; dropBuf[i * 4 + 1] = d.y;
      dropBuf[i * 4 + 2] = d.r;
      dropBuf[i * 4 + 3] = born < 12 ? d.amt * 0.8 * (1 - born / 12) : 0;
      jetBuf[i * 4] = d.x; jetBuf[i * 4 + 1] = d.y;
      jetBuf[i * 4 + 2] = d.r;
      jetBuf[i * 4 + 3] = d.amt * Math.pow(d.life / JETLIFE, 1.6);
      /* the jet's centre rides down with the plume it drives */
      d.y -= 0.0016 * (d.life / JETLIFE);
    }
    gl.uniform4fv(u.uDrops, dropBuf);
    gl.uniform4fv(u.uJets, jetBuf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    for (i = drops.length - 1; i >= 0; i--) { if (--drops[i].life <= 0) drops.splice(i, 1); }
    var t = A; A = B; B = t;
  }

  function present() {
    var gl = G.gl, u = G.uDraw;
    gl.useProgram(G.pDraw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(u.uState, 0);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uMode, mode);
    gl.uniform1f(u.uInt, S.intensity);
    gl.uniform1f(u.uLevels, 46.0);
    gl.uniform3fv(u.uInk, INK);
    gl.uniform3fv(u.uInkHaze, HAZE);
    gl.uniform3fv(u.uBg, C.void);
    gl.uniform3fv(u.uBokashi, BOK);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function settle() {
    if (!G) { if (cpu) drawCPU(); return; }
    PE.drop(0.13, 0.82, 0.05, 1.0);
    PE.drop(0.88, 0.64, 0.045, 0.85);
    for (var i = 0; i < 240; i++) { time += 0.016; step(); }
    present();
  }

  function drawCPU() {
    /* still water, a few frozen tendrils — quiet on purpose */
    var img = cpu.img, dd = img.data, w = cpu.w, h = cpu.h, vn = cpu.vn;
    var bg = C.void, i = 0;
    for (var y = 0; y < h; y++) {
      var vy = 1 - y / h;
      var bok = Math.max(0, vy - 0.84) / 0.16;
      for (var x = 0; x < w; x++) {
        var u = x / w;
        var colm = sstep(0.05, 0.46, Math.abs(u - 0.5));
        /* vertically elongated noise reads as sunk tendrils */
        var d1 = vn(u * aspect * 6.5, vy * 2.0 + u * 1.4);
        var d2 = vn(u * aspect * 16.0 + 40.0, vy * 5.0);
        var dens = Math.max(0, d1 * 0.7 + d2 * 0.3 - 0.58) * 2.4;
        dens *= colm * S.intensity * (mode ? 0.5 : 0.8);
        dens = Math.min(1, dens);
        for (var k = 0; k < 3; k++) {
          var v = bg[k] + (BOK[k] - bg[k]) * bok * bok * (mode ? 0.30 : 0.50);
          v = v + (INK[k] - v) * dens;
          dd[i + k] = Math.max(0, Math.min(255, v * 255)) | 0;
        }
        dd[i + 3] = 255;
        i += 4;
      }
    }
    cpu.ctx.putImageData(img, 0, 0);
  }
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* dev probe: what is actually in the water right now */
  PE._inkstat = function () {
    if (!G) return { gl: false };
    var gl = G.gl, n = 24, px = new Uint8Array(SW * 4);
    var out = { gl: true, SW: SW, SH: SH, type: G.type === gl.UNSIGNED_BYTE ? 'byte' : 'half',
      drops: drops.length, seeded: seeded, maxR: 0, maxG: 0,
      uDrops: !!G.uSim.uDrops, uJets: !!G.uSim.uJets };
    out.lost = gl.isContextLost();
    if (G.type === gl.UNSIGNED_BYTE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
      for (var row = 0; row < n; row++) {
        var y = ((row + 0.5) / n * SH) | 0;
        gl.readPixels(0, y, SW, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (var i = 0; i < SW; i++) {
          if (px[i * 4] > out.maxR) out.maxR = px[i * 4];
          if (px[i * 4 + 1] > out.maxG) out.maxG = px[i * 4 + 1];
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else { out.maxR = -1; out.maxG = -1; }
    return out;
  };

  cv.classList.add('live');

  var vitals = 0;
  function startLoop() {
    PE.loop.add('substrate', function (dt) {
      if (!G) return;
      if (++vitals % 48 === 0 && G.gl.isContextLost()) {
        PE.loop.remove('substrate');
        lost++;
        if (lost > 1) { toCPU(); return; }
        setTimeout(function () {
          var nc = cv.cloneNode(false);
          cv.parentNode.replaceChild(nc, cv);
          cv = nc;
          G = initGL();
          if (!G) { toCPU(); return; }
          resize(); colours(); seeded = 0;
          nc.classList.add('live');
          startLoop();
        }, 400);
        return;
      }
      time += dt * (mode ? 0.00034 : 0.001);   /* by day the water is nearly still */
      if (seeded < 90) { seeded += 2; step(); step(); }
      else { ambient(dt); step(); }
      present();
    });
  }
  if (PE.reduced) {
    settle();
  } else if (G) {
    startLoop();
  } else {
    drawCPU();
  }
  PE.on('motionchange', function (r) { if (r) { PE.loop.remove('substrate'); settle(); } });
})();
