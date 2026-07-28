/* ═══════════════════════════════════════════════════════════════
   PE//1 — the substrate: 水墨, simulated

   This is not a picture of an ink wash. It is a wash: a two-field
   fluid running on the GPU, ping-ponged between framebuffers, where
   every mark you see got there by the route ink takes on paper.

     R  suspended pigment, still in the water
     G  water
     B  pigment that has settled onto the sheet — what you see
     A  how much the sheet can still take. 積墨: a second wash over a
        first lays down differently, and leaves its overlap edge.

   The behaviours are consequences, not effects:

     暈染      water spreads by capillary action, faster along the
               fibre than across it, and carries pigment with it
     邊緣濃聚  water leaves fastest at the rim of a wet patch, so the
               flow runs outward and strands pigment at the edge —
               the darker terminus is emergent, never drawn
     水痕      fresh water lifts pigment that had already settled and
               carries it out to a hard cauliflower boundary
     五墨      the settled value is read back in discrete tones —
               焦 濃 重 淡 清
     飛白      a starved brush breaks into streaks, thin strokes only
     宣紙纖維  conductivity is anisotropic per texel

   Ink enters from two places. A drop, which spreads and dries where
   it lands. And the residual: where prediction and evidence fail to
   cancel, the sheet gets wet. 留白 is not a composition device — it
   is the part of the world the model already predicted.

   WebGL where available; a Canvas2D wash that follows the same rules
   without the fluid where not.
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
  var MAXDROPS = 6;

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
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 0.5;',
    '  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);',
    '  for(int i = 0; i < 3; i++){ s += a * vnoise(p); p = m * p; a *= 0.5; }',
    '  return s * 1.14;',
    '}',
    /* the sheet's own grain: which way the fibres run, per texel */
    'float fibre(vec2 uv){',
    '  return vnoise(uv * vec2(31.0, 118.0)) * 0.6 + vnoise(uv * vec2(9.0, 41.0)) * 0.4;',
    '}'
  ].join('\n');

  var VERT = [
    'attribute vec2 a;',
    'varying vec2 vUv;',
    'void main(){ vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }'
  ].join('\n');

  /* ── the wash itself ──────────────────────────────────────── */
  var SIM = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uState;',
    'uniform vec2 uTexel;',
    'uniform float uAspect, uTime, uProg, uInject, uFade;',
    'uniform vec4 uDrops[' + MAXDROPS + '];',
    NOISE,

    'void main(){',
    '  vec2 uv = vUv;',
    '  vec4 s = texture2D(uState, uv);',
    '  float ink = s.r, wat = s.g, dep = s.b, cap = s.a;',

    '  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);',
    '  vec4 L = texture2D(uState, uv - tx);',
    '  vec4 R = texture2D(uState, uv + tx);',
    '  vec4 D = texture2D(uState, uv - ty);',
    '  vec4 U = texture2D(uState, uv + ty);',

    /* 宣紙纖維 — capillary conductivity runs with the fibre */
    '  float f = fibre(uv);',
    '  float kx = 0.19 * (0.40 + 1.20 * f);',
    '  float ky = 0.19 * (0.40 + 1.20 * (1.0 - f));',

    /* water spreads: this is the 暈染 */
    '  float lapW = kx * (L.g + R.g - 2.0 * wat) + ky * (D.g + U.g - 2.0 * wat);',

    /* pigment only travels through wet paper */
    '  float wet = smoothstep(0.012, 0.20, wat);',
    '  float lapI = (kx * (L.r + R.r - 2.0 * ink) + ky * (D.r + U.r - 2.0 * ink)) * wet * 0.78;',

    /* the drying rim pulls the flow outward, which is where the darker
       edge of every wash comes from — it is not painted on */
    '  vec2 gw = vec2(R.g - L.g, U.g - D.g) * 0.5;',
    '  vec2 vel = -gw * 2.1;',
    '  float adv = texture2D(uState, uv - vel * uTexel * 1.6).r;',
    '  float newI = mix(ink, adv, wet * 0.88) + lapI;',
    '  float newW = wat + lapW;',

    /* evaporation, fastest where the wet patch ends */
    '  float evap = 0.0058 + length(gw) * 0.055;',
    '  newW = max(0.0, newW - evap * smoothstep(0.0, 0.06, newW));',

    /* as the water goes, the pigment it was carrying settles */
    '  float dried = max(0.0, wat - newW);',
    '  float settle = newI * min(0.80, 0.055 + dried * 7.5);',
    '  newI -= settle;',
    '  float newD = dep + settle * cap;',
    '  float newCap = max(0.10, cap - settle * 0.55);',

    /* 水痕 — fresh water lifts what had already dried and carries it out
       to a hard boundary */
    '  float lift = newD * smoothstep(0.44, 0.90, newW) * 0.030;',
    '  newD -= lift; newI += lift;',

    /* the sheet is not infinite in time: the wash reaches an equilibrium
       instead of silting up into mud */
    '  newD *= uFade;',
    '  newCap = min(1.0, newCap + (1.0 - uFade) * 0.6);',

    /* ── sources ──
       the residual: the sheet gets wet where the prediction failed. This is
       the expensive half of the step, and it is skipped outright while the
       reader is inside a block of copy — a coherent branch on a uniform. */
    '  if (uInject > 0.03) {',
    '  vec2 p = vec2(uv.x * uAspect, 1.0 - uv.y);',
    '  float drift = uProg * 1.5;',
    '  vec2 q = vec2(p.x * 2.7, p.y * 3.2);',
    '  float w2 = fbm(q * 0.46 + vec2(uTime * 0.010, drift * 0.05));',
    '  vec2 qw = q + vec2(w2 * 1.25, w2 * 0.80);',
    '  float pred = fbm(qw + vec2(0.0, -uTime * 0.040 - drift));',
    '  float evid = fbm(qw * 1.06 + vec2(37.4, uTime * 0.052 - drift * 0.70));',
    '  float resid = abs((pred - evid) * 3.0);',
    /* the laminae still decide where the cortex is dense */
    '  float l4 = exp(-pow((p.y - 0.42) / 0.055, 2.0));',
    '  float lam = 0.36 + 0.55 * l4 + 0.40 * smoothstep(0.50, 0.60, p.y) * (1.0 - smoothstep(0.76, 0.92, p.y));',
    '  float src = smoothstep(0.70, 1.15, resid) * lam * uInject;',
    '  newW += src * 0.038;',
    '  newI += src * 0.019;',
    '  }',

    /* and a drop, when one is let fall */
    '  for (int i = 0; i < ' + MAXDROPS + '; i++) {',
    '    vec4 dr = uDrops[i];',
    '    float on = step(0.0001, dr.w);',
    '    vec2 dv = vec2((uv.x - dr.x) * uAspect, uv.y - dr.y);',
    '    float g = exp(-dot(dv, dv) / max(1e-5, dr.z * dr.z));',
    '    newW += g * dr.w * on * 0.95;',
    '    newI += g * dr.w * on * 0.62;',
    '  }',

    '  gl_FragColor = clamp(vec4(newI, newW, newD, newCap), 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ── reading the sheet back ───────────────────────────────── */
  var DRAW = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uState;',
    'uniform vec2 uRes;',
    'uniform float uAspect, uMode, uInt, uLevels, uTones, uTime, uProg;',
    'uniform vec3 uPre, uSig, uInk, uBg, uMount;',
    NOISE,

    /* stroke space — washes and their dry streaks elongate along the
       direction the brush was travelling */
    'vec2 brush(vec2 p, float t){',
    '  float ang = (fbm(p * 0.42 + vec2(t * 0.008, 0.0)) - 0.5) * 2.6;',
    '  float c = cos(ang), s = sin(ang);',
    '  return mat2(c, -s, s, c) * p;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 p = vec2(uv.x * uAspect, 1.0 - uv.y);',
    '  vec2 bs = brush(p, uTime);',
    '  vec4 s = texture2D(uState, uv);',

    /* what has settled, plus what is still in the water */
    '  float pig = s.b + s.r * 0.55;',

    /* 五墨 — 焦 濃 重 淡 清 */
    '  float stepped = floor(pig * uTones + 0.5) / uTones;',
    '  float ink = mix(pig, stepped, 0.52);',

    /* the fibre shows through a thin wash */
    '  float fib = vnoise(vec2(bs.x * 300.0, bs.y * 52.0));',
    '  ink *= mix(0.84, 1.0, fib);',

    /* 飛白 — only where the brush was starved; a loaded brush is solid */
    '  float dry = vnoise(vec2(bs.x * 86.0, bs.y * 15.0));',
    '  ink *= mix(smoothstep(0.05, 0.74, dry), 1.0, smoothstep(0.42, 0.92, pig));',

    /* the copy sits on dry paper: a scroll keeps its painting in the margins */
    '  float colm = smoothstep(0.06, 0.47, abs(uv.x - 0.5));',
    '  ink *= uInt * mix(0.13, 1.0, colm);',
    '  ink = clamp(ink * mix(1.05, 0.92, uMode), 0.0, 1.0);',

    /* which field was losing decides the pigment, but only just: this is
       ink first and colour a long way second */
    '  float drift = uProg * 1.5;',
    '  vec2 q = vec2(p.x * 2.7, p.y * 3.2);',
    '  float w2 = fbm(q * 0.46 + vec2(uTime * 0.010, drift * 0.05));',
    '  vec2 qw = q + vec2(w2 * 1.25, w2 * 0.80);',
    '  float sgn = fbm(qw + vec2(0.0, -uTime * 0.040 - drift))',
    '            - fbm(qw * 1.06 + vec2(37.4, uTime * 0.052 - drift * 0.70));',
    '  vec3 tint = sgn > 0.0 ? uPre : uSig;',
    '  vec3 inkCol = mix(uInk, tint, 0.10);',

    /* the sheet: fibrous everywhere, including where no ink landed */
    '  float tooth = vnoise(p * 520.0 + bs * 26.0) + vnoise(p * 137.0) * 0.5;',
    '  vec3 paper = uBg + (tooth / 1.5 - 0.5) * mix(0.014, 0.026, uMode);',

    /* 斑點 — age spots, on the printed sheet only */
    '  float fox = smoothstep(0.885, 0.995, vnoise(p * 34.0 + 7.3))',
    '            * smoothstep(0.45, 0.92, vnoise(p * 190.0 + 11.0));',
    '  paper -= fox * uMode * vec3(0.050, 0.070, 0.098);',

    '  vec3 col = mix(paper, inkCol, ink);',

    /* 毛邊 — the sheet does not end on a ruled line */
    '  float en = vnoise(vec2(uv.y * 130.0, uv.x * 130.0));',
    '  float dl = min(uv.x, 1.0 - uv.x) * uAspect;',
    '  float deckle = smoothstep(0.0, 0.020, dl + (en - 0.5) * 0.016);',
    '  col = mix(mix(col, uMount, 0.55), col, deckle);',

    /* the tooth of the paper */
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
    if (!gl) return null;

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

    /* half-float where the driver will filter it, bytes otherwise. Ink
       tolerates 8 bits; the diffusion just quantises a little harder. */
    var type = gl.UNSIGNED_BYTE;
    var hf = gl.getExtension('OES_texture_half_float');
    var hfl = gl.getExtension('OES_texture_half_float_linear');
    if (hf && hfl) type = hf.HALF_FLOAT_OES;

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
    if (!probe && type !== gl.UNSIGNED_BYTE) { type = gl.UNSIGNED_BYTE; probe = target(4, 4, type); }
    if (!probe) return null;
    gl.deleteTexture(probe.tex); gl.deleteFramebuffer(probe.fb);

    function uni(pr, names) {
      var U = {};
      names.forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
      return U;
    }
    return {
      gl: gl, type: type, target: target, pSim: pSim, pDraw: pDraw,
      uSim: uni(pSim, ['uState', 'uTexel', 'uAspect', 'uTime', 'uProg', 'uInject', 'uFade', 'uDrops']),
      uDraw: uni(pDraw, ['uState', 'uRes', 'uAspect', 'uMode', 'uInt', 'uLevels', 'uTones', 'uTime', 'uProg',
        'uPre', 'uSig', 'uInk', 'uBg', 'uMount'])
    };
  }

  /* ── Canvas2D: the same rules, without the fluid ──────────── */
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
    function fbm(x, y) {
      var s = 0, am = 0.5;
      for (var o = 0; o < 3; o++) {
        s += am * vn(x, y);
        var nx = 1.62 * x + 1.18 * y, ny = -1.18 * x + 1.62 * y;
        x = nx; y = ny; am *= 0.5;
      }
      return s;
    }
    return { ctx: ctx, fbm: fbm, vn: vn, img: null, w: 0, h: 0 };
  }

  var G = null, cpu = null;
  if (!(G = initGL())) cpu = initCPU();
  if (!G && !cpu) return;

  /* ── sizing ───────────────────────────────────────────────── */
  var W = 0, H = 0, SW = 0, SH = 0, A = null, B = null, aspect = 1, seeded = 0;
  cv.style.imageRendering = 'pixelated';

  function resize() {
    var cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight;
    aspect = cw / Math.max(1, ch);
    var px = mode ? 3 : 2;
    if (innerWidth < 760) px += 1;
    if (cpu) px = Math.max(px, 5);
    W = Math.max(2, Math.round(cw / px));
    H = Math.max(2, Math.round(ch / px));
    cv.width = W; cv.height = H;

    if (G) {
      var gl = G.gl;
      /* the wash is smooth; it does not need the screen's resolution */
      SW = Math.max(64, Math.min(340, Math.round(cw / 4.2)));
      SH = Math.max(48, Math.round(SW / aspect));
      if (A) { gl.deleteTexture(A.tex); gl.deleteFramebuffer(A.fb); }
      if (B) { gl.deleteTexture(B.tex); gl.deleteFramebuffer(B.fb); }
      A = G.target(SW, SH, G.type);
      B = G.target(SW, SH, G.type);
      clearSheet();
      seeded = 0;
    }
    if (cpu) { cpu.img = cpu.ctx.createImageData(W, H); cpu.w = W; cpu.h = H; cpu.ctx.imageSmoothingEnabled = false; }
  }

  function clearSheet() {
    var gl = G.gl;
    [A, B].forEach(function (t) {
      if (!t) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.clearColor(0, 0, 0, 1);       /* dry, clean, and able to take ink */
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  var C = null, INK = [0, 0, 0], MOUNT = [0, 0, 0];
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function hex(v, fb) {
    var m = /^#([0-9a-f]{6})$/i.exec(v || '');
    return m ? [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255] : fb;
  }
  function colours() {
    C = PE.colors();
    INK = hex(css('--ink-wash'), C.ink);
    MOUNT = hex(css('--mount'), C.bg1);
  }
  colours(); resize();

  PE.on('modechange', function (m) {
    mode = m === 'fixed' ? 1 : 0;
    colours(); resize();
    if (PE.reduced) settle();
  });
  addEventListener('resize', PE.debounce(function () { resize(); if (PE.reduced) settle(); }, 200), { passive: true });

  /* ── drops ────────────────────────────────────────────────── */
  var drops = [], nextDrop = 2600, rnd = PE.rng(0x4b1d);
  PE.drop = function (x, y, r, amt) {
    if (drops.length >= MAXDROPS) drops.shift();
    drops.push({ x: x, y: y, r: r || 0.05, amt: amt || 0.85, life: 4 });
  };
  addEventListener('pointerdown', function (e) {
    if (e.target && e.target.closest && e.target.closest('a,button,input,label,dialog,[role="button"]')) return;
    PE.drop(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.055, 0.95);
  }, { passive: true });
  PE.on('pulse', function () {
    PE.drop(S.ptr.has ? S.ptr.x : 0.5, S.ptr.has ? 1 - S.ptr.y : 0.5, 0.075, 1.0);
  });

  function ambient(dt) {
    nextDrop -= dt;
    if (nextDrop > 0) return;
    nextDrop = 5400 + rnd() * 7200;
    /* fall in the margins, where the painting lives */
    var side = rnd() < 0.5 ? rnd() * 0.24 : 0.76 + rnd() * 0.24;
    PE.drop(side, 0.12 + rnd() * 0.76, 0.030 + rnd() * 0.042, 0.30 + rnd() * 0.30);
  }

  /* ── run ──────────────────────────────────────────────────── */
  var dropBuf = new Float32Array(MAXDROPS * 4);

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
    gl.uniform1f(u.uProg, S.prog);
    gl.uniform1f(u.uInject, S.intensity);
    gl.uniform1f(u.uFade, 0.9982);

    for (var k = 0; k < dropBuf.length; k++) dropBuf[k] = 0;
    for (var i = 0; i < drops.length && i < MAXDROPS; i++) {
      var d = drops[i];
      dropBuf[i * 4] = d.x; dropBuf[i * 4 + 1] = d.y;
      dropBuf[i * 4 + 2] = d.r; dropBuf[i * 4 + 3] = d.amt * (d.life / 4);
    }
    gl.uniform4fv(u.uDrops, dropBuf);
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
    gl.uniform1f(u.uLevels, mode ? 16.0 : 30.0);
    gl.uniform1f(u.uTones, mode ? 4.0 : 5.0);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uProg, S.prog);
    gl.uniform3fv(u.uPre, C.pre);
    gl.uniform3fv(u.uSig, C.sig);
    gl.uniform3fv(u.uInk, INK);
    gl.uniform3fv(u.uBg, C.void);
    gl.uniform3fv(u.uMount, MOUNT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function settle() {
    /* a designed sheet for readers who do not want it moving */
    if (!G) { drawCPU(40); return; }
    PE.drop(0.15, 0.66, 0.10, 1.0);
    PE.drop(0.87, 0.34, 0.085, 0.9);
    for (var i = 0; i < 110; i++) { time += 0.016; step(); }
    present();
  }

  function drawCPU(dt) {
    if (!mode) time += dt * 0.001;
    var img = cpu.img, dd = img.data, w = cpu.w, h = cpu.h, fbm = cpu.fbm, vn = cpu.vn;
    var levels = mode ? 16 : 30, tones = mode ? 4 : 5;
    var drift = S.prog * 1.5, gain = mode ? 0.92 : 1.05;
    var bg = C.void, pre = C.pre, sig = C.sig, i = 0;
    for (var y = 0; y < h; y++) {
      var dep = y / h;
      var l4 = Math.exp(-Math.pow((dep - 0.42) / 0.055, 2));
      var lam = 0.36 + 0.55 * l4 + 0.40 * sstep(0.50, 0.60, dep) * (1 - sstep(0.76, 0.92, dep));
      for (var x = 0; x < w; x++) {
        var u = x / w;
        var qx = u * aspect * 2.7, qy = dep * 3.2;
        var ww = fbm(qx * 0.46, qy * 0.46);
        var wx = qx + ww * 1.25, wy = qy + ww * 0.80;
        var sgn = fbm(wx, wy - time * 0.040 - drift) - fbm(wx * 1.06 + 37.4, wy * 1.06 + time * 0.052 - drift * 0.70);
        var aa = Math.abs(sgn * 3.0);
        var pig = sstep(0.46, 1.12, aa) * lam;
        var st = Math.floor(pig * tones + 0.5) / tones;
        var ink = pig + (st - pig) * 0.52;
        ink *= 0.84 + 0.16 * vn(u * aspect * 300, dep * 52);
        ink *= S.intensity * (0.13 + 0.87 * sstep(0.06, 0.47, Math.abs(u - 0.5))) * gain;
        ink = Math.max(0, Math.min(1, ink));
        var tint = sgn > 0 ? pre : sig;
        var tooth = (vn(u * aspect * 520, dep * 520) - 0.5) * (mode ? 0.026 : 0.014);
        var th = ((y & 7) * 8 + (x & 7)) / 64;
        for (var k = 0; k < 3; k++) {
          var inkc = INK[k] + (tint[k] - INK[k]) * 0.10;
          var paper = bg[k] + tooth;
          var v = paper + (inkc - paper) * ink;
          v = Math.floor(v * levels + th) / levels;
          dd[i + k] = Math.max(0, Math.min(255, v * 255)) | 0;
        }
        dd[i + 3] = 255;
        i += 4;
      }
    }
    cpu.ctx.putImageData(img, 0, 0);
  }
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  cv.classList.add('live');

  if (PE.reduced) {
    settle();
  } else if (G) {
    PE.loop.add('substrate', function (dt) {
      if (!mode) time += dt * 0.001;    /* a dry sheet has stopped */
      /* let the first sheet develop quickly: nobody should watch paper dry */
      if (seeded < 120) { seeded += 2; step(); step(); }
      else { ambient(dt); step(); }
      present();
    });
  } else {
    var acc = 0;
    PE.loop.add('substrate', function (dt) {
      acc += dt; if (acc < 40) return; drawCPU(acc); acc = 0;
    });
  }
  PE.on('motionchange', function (r) { if (r) { PE.loop.remove('substrate'); settle(); } });
})();
