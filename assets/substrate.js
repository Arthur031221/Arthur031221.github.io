/* ═══════════════════════════════════════════════════════════════
   PE//1 — the substrate: 墨流し · suminagashi

   Ink floated on water and folded, the oldest marbling there is.
   Three dyes live in one texture and ride the same slow flow:

     R  胭脂 crimson — top-down prediction
     G  紺青 Prussian blue — bottom-up evidence
     B  墨   sumi grey — where the two have mixed and cancelled

   The brush touches the surface on a slow wander, laying alternate
   rings of crimson and blue the way a suminagashi artist alternates
   sumi and indigo; the ambient curl folds the rings into marble.
   Where crimson and blue overlap they bleed into grey — prediction
   and evidence annihilating into the residual's ash. The paper
   itself stays readable because the reading column floats above
   the water on its own sheet.

   The flow is Bridson curl noise — divergence-free, so the marble
   folds forever without draining — dominated by one large slow
   octave, which is what makes it read as water and not smoke.
   There is no gravity here: suminagashi lives on the surface.

   A click or S touches the brush to the water where you are.

   WebGL where available; a still marbled sheet in Canvas2D where
   not. State textures are UNSIGNED_BYTE everywhere — half-float
   targets pass the completeness probe on some drivers and then
   silently render nothing — and the decay is hash-dithered so
   8-bit dye cannot freeze into permanent freckles.
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
  var MAXTOUCH = 6;

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
    'uniform vec4 uTouch[' + MAXTOUCH + '];',   /* x, y, radius, amount */
    'uniform vec4 uDye[' + MAXTOUCH + '];',     /* rgb weights, ring flag */
    NOISE,

    /* one large slow octave carries the marble; a faint finer one
       creases it — ≥75% of the energy stays in the largest scale */
    'float psi(vec2 p){',
    '  return fbm2(p * 0.85 + vec2(0.0, uTime * 0.011))',
    '       + fbm2(p * 2.60 + vec2(31.7, uTime * 0.019)) * 0.28;',
    '}',
    'vec2 curl(vec2 p){',
    '  vec2 e = vec2(0.030, 0.0);',
    '  float dx = psi(p + e.xy) - psi(p - e.xy);',
    '  float dy = psi(p + e.yx) - psi(p - e.yx);',
    '  return vec2(dy, -dx) / (2.0 * e.x);',
    '}',

    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 p = vec2(uv.x * uAspect, uv.y);',

    '  vec2 v = curl(p) * 0.62;',
    '  v.y += uStir * 0.22;',

    /* semi-Lagrangian advection of all three dyes together —
       floated ink shares the surface it rides on */
    '  vec2 back = uv - v * 0.00105;',
    '  vec3 dye = texture2D(uState, back).rgb;',

    /* a touch of diffusion: sharpening at 8 bits breeds scanlines, so
       the crispness is left to the fold lines in the display pass */
    '  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);',
    '  vec3 avg = (texture2D(uState, back - tx).rgb + texture2D(uState, back + tx).rgb',
    '            + texture2D(uState, back - ty).rgb + texture2D(uState, back + ty).rgb) * 0.25;',
    '  dye = mix(dye, avg, 0.045);',

    /* 破墨 — where crimson and blue ride together they bleed into
       sumi: prediction and evidence annihilating into ash */
    '  float meet = min(dye.r, dye.g);',
    '  dye.b += meet * 0.055;',
    '  dye.r -= meet * 0.030;',
    '  dye.g -= meet * 0.030;',

    /* suminagashi persists; only the faintest dithered clearing, so
       8-bit dye still fades instead of freezing */
    '  float dth = hash(uv * 137.0 + fract(uTime * 7.31));',
    '  dye = max(vec3(0.0), dye * 0.99985 - dth * 0.00045);',

    /* the brush touches the surface: a ring of one dye */
    '  for (int i = 0; i < ' + MAXTOUCH + '; i++) {',
    '    vec4 t = uTouch[i];',
    '    if (t.w < 0.0001) continue;',
    '    vec2 dv = vec2((uv.x - t.x) * uAspect, uv.y - t.y);',
    '    float d = length(dv);',
    '    float ring = exp(-pow((d - t.z * 0.78) / (t.z * 0.16), 2.0));',
    '    float core = exp(-d * d / (t.z * t.z * 0.16)) * 0.35;',
    '    dye += uDye[i].rgb * (ring + core) * t.w;',
    '  }',

    '  gl_FragColor = vec4(clamp(dye, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ── reading the water back ───────────────────────────────── */
  var DRAW = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uState;',
    'uniform vec2 uRes, uTexel;',
    'uniform float uAspect, uMode, uInt, uLevels;',
    'uniform vec3 uCrimson, uBlue, uSumi, uBg, uBokashi;',
    NOISE,

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec3 dye = texture2D(uState, uv).rgb;',

    /* the reading column floats above the water on its own sheet,
       so the marble only whispers beneath it */
    '  float colm = smoothstep(0.06, 0.47, abs(uv.x - 0.5));',
    '  float damp = uInt * mix(mix(0.52, 0.58, uMode), 1.0, colm);',
    '  dye *= damp;',

    '  float sr = smoothstep(0.012, 0.52, dye.r);',
    '  float sb = smoothstep(0.012, 0.52, dye.g);',
    '  float sg = smoothstep(0.016, 0.60, dye.b);',

    /* 浮世繪 — the sheet opens under a bokashi band */
    '  vec3 col = uBg;',
    '  float bok = smoothstep(0.84, 1.0, uv.y);',
    '  col = mix(col, uBokashi, bok * bok * mix(0.42, 0.26, uMode));',

    /* layered translucency, blue over crimson under sumi */
    '  col = mix(col, uCrimson, sr * 0.88);',
    '  col = mix(col, uBlue, sb * (1.0 - sr * 0.35) * 0.88);',
    '  col = mix(col, uSumi, sg * 0.62);',

    /* where the marble runs deep, the layers absorb each other down */
    '  float total = sr + sb + sg;',
    '  col *= 1.0 - 0.16 * smoothstep(0.9, 1.9, total);',

    /* the feathered fold line: the gradient of the marble itself */
    '  vec3 gx = texture2D(uState, uv + vec2(uTexel.x, 0.0)).rgb - texture2D(uState, uv - vec2(uTexel.x, 0.0)).rgb;',
    '  vec3 gy = texture2D(uState, uv + vec2(0.0, uTexel.y)).rgb - texture2D(uState, uv - vec2(0.0, uTexel.y)).rgb;',
    '  float edge = length(gx) + length(gy);',
    '  col = mix(col, uSumi, smoothstep(0.22, 0.85, edge) * damp * 0.30);',

    /* the faintest tooth, so still water is not dead pixels */
    '  vec2 p = vec2(uv.x * uAspect, uv.y);',
    '  col += (vnoise(p * 240.0) - 0.5) * 0.011;',

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

    function target(w, h) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); return null; }
      return { tex: tex, fb: fb };
    }
    var probe = target(4, 4);
    if (!probe) return null;
    gl.deleteTexture(probe.tex); gl.deleteFramebuffer(probe.fb);

    function uni(pr, names) {
      var U = {};
      names.forEach(function (n) {
        U[n] = gl.getUniformLocation(pr, n) || gl.getUniformLocation(pr, n + '[0]');
      });
      return U;
    }
    return {
      gl: gl, target: target, pSim: pSim, pDraw: pDraw,
      uSim: uni(pSim, ['uState', 'uTexel', 'uAspect', 'uTime', 'uStir', 'uTouch', 'uDye']),
      uDraw: uni(pDraw, ['uState', 'uRes', 'uTexel', 'uAspect', 'uMode', 'uInt', 'uLevels',
        'uCrimson', 'uBlue', 'uSumi', 'uBg', 'uBokashi'])
    };
  }

  /* ── Canvas2D: a still marbled sheet, no animation ────────── */
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
    return { ctx: ctx, vn: vn, fbm: fbm, img: null, w: 0, h: 0 };
  }

  var G = null, cpu = null, lost = 0;
  if (!(G = initGL())) cpu = initCPU();
  if (!G && !cpu) return;

  function toCPU() {
    G = null;
    var nc = cv.cloneNode(false);
    cv.parentNode.replaceChild(nc, cv);
    cv = nc;
    cpu = initCPU();
    if (cpu) { resize(); colours(); drawCPU(); cv.classList.add('live'); }
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
      SW = Math.max(96, Math.min(400, Math.round(cw / 3.6)));
      SH = Math.max(64, Math.round(SW / aspect));
      var gl = G.gl;
      if (A) { gl.deleteTexture(A.tex); gl.deleteFramebuffer(A.fb); }
      if (B) { gl.deleteTexture(B.tex); gl.deleteFramebuffer(B.fb); }
      A = G.target(SW, SH);
      B = G.target(SW, SH);
      var t = [A, B];
      for (var i = 0; i < 2; i++) {
        if (!t[i]) continue;
        gl.bindFramebuffer(gl.FRAMEBUFFER, t[i].fb);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      seeded = 0;
    }
    if (cpu) { cpu.img = cpu.ctx.createImageData(W, H); cpu.w = W; cpu.h = H; }
  }

  var C = null, CRIMSON = [0, 0, 0], BLUE = [0, 0, 0], SUMI = [0, 0, 0], BOK = [0, 0, 0];
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function hex(v, fb) {
    var m = /^#([0-9a-f]{6})$/i.exec(v || '');
    return m ? [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255] : fb;
  }
  function colours() {
    C = PE.colors();
    CRIMSON = hex(css('--dye-crimson'), C.pre);
    BLUE = hex(css('--dye-blue'), C.sig);
    SUMI = hex(css('--dye-sumi'), C.muted);
    BOK = hex(css('--bokashi'), BLUE);
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

  /* ── the brush ────────────────────────────────────────────────
     It wanders the water on slow noise and touches down on a beat,
     laying alternate crimson and blue — a third touch of sumi now
     and then — exactly as the marbler's two brushes alternate.  */
  var touches = [], rnd = PE.rng(0x4b1d), stroke = 0, nextTouch = 900;
  var DYES = [
    [1, 0, 0],   /* 胭脂 */
    [0, 1, 0],   /* 紺青 */
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]    /* 墨, every fifth touch */
  ];

  function brushAt(t) {
    /* the brush point drifts across the whole sheet, margins and all —
       the column sheet keeps the copy readable, not the brush's path */
    var x = 0.5 + 0.42 * (fclamp(nz(t * 0.021, 3.1)) * 2 - 1);
    var y = 0.5 + 0.38 * (fclamp(nz(t * 0.017, 9.7)) * 2 - 1);
    return { x: x, y: y };
  }
  var nzp = PE.rng(0x77aa), nzc = {};
  function nz(x, seed) {
    /* cheap 1-D value noise on integers */
    var i = Math.floor(x), f = x - i;
    function g(k) {
      var key = seed + ':' + k;
      if (!(key in nzc)) nzc[key] = PE.rng((seed * 1e4 + k * 131) >>> 0)();
      return nzc[key];
    }
    var u = f * f * (3 - 2 * f);
    return g(i) + (g(i + 1) - g(i)) * u;
  }
  function fclamp(v) { return Math.max(0, Math.min(1, v)); }

  function touch(x, y, r, amt, dye) {
    if (touches.length >= MAXTOUCH) touches.shift();
    touches.push({ x: x, y: y, r: r, amt: amt, dye: dye, life: 10 });
  }
  PE.drop = function (x, y, r, amt) {
    touch(x, y, r || 0.05, amt || 0.8, DYES[stroke++ % DYES.length]);
  };
  addEventListener('pointerdown', function (e) {
    if (e.target && e.target.closest && e.target.closest('a,button,input,label,dialog,[role="button"]')) return;
    PE.drop(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.055, 0.9);
  }, { passive: true });
  PE.on('pulse', function () {
    PE.drop(S.ptr.has ? S.ptr.x : 0.5, S.ptr.has ? 1 - S.ptr.y : 0.5, 0.07, 1.0);
  });

  function ambient(dt) {
    nextTouch -= dt;
    if (nextTouch > 0) return;
    nextTouch = 1100 + rnd() * 1400;
    var b = brushAt(time);
    touch(b.x, b.y, 0.045 + rnd() * 0.065, 0.6 + rnd() * 0.35, DYES[stroke++ % DYES.length]);
  }

  /* ── run ──────────────────────────────────────────────────── */
  var touchBuf = new Float32Array(MAXTOUCH * 4);
  var dyeBuf = new Float32Array(MAXTOUCH * 4);

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

    for (var k = 0; k < touchBuf.length; k++) { touchBuf[k] = 0; dyeBuf[k] = 0; }
    for (var i = 0; i < touches.length && i < MAXTOUCH; i++) {
      var t = touches[i];
      touchBuf[i * 4] = t.x; touchBuf[i * 4 + 1] = t.y;
      touchBuf[i * 4 + 2] = t.r;
      touchBuf[i * 4 + 3] = t.amt * 0.30 * (t.life / 10);
      dyeBuf[i * 4] = t.dye[0]; dyeBuf[i * 4 + 1] = t.dye[1]; dyeBuf[i * 4 + 2] = t.dye[2];
    }
    gl.uniform4fv(u.uTouch, touchBuf);
    gl.uniform4fv(u.uDye, dyeBuf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    for (i = touches.length - 1; i >= 0; i--) { if (--touches[i].life <= 0) touches.splice(i, 1); }
    var t2 = A; A = B; B = t2;
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
    gl.uniform2f(u.uTexel, 1 / SW, 1 / SH);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uMode, mode);
    gl.uniform1f(u.uInt, S.intensity);
    gl.uniform1f(u.uLevels, 46.0);
    gl.uniform3fv(u.uCrimson, CRIMSON);
    gl.uniform3fv(u.uBlue, BLUE);
    gl.uniform3fv(u.uSumi, SUMI);
    gl.uniform3fv(u.uBg, C.void);
    gl.uniform3fv(u.uBokashi, BOK);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* the sheet arrives already marbled: several strokes laid down and
     folded before the first frame is shown */
  function seedMarble(strokes, foldSteps) {
    for (var i = 0; i < strokes; i++) {
      var b = brushAt(time + i * 47.3);
      touch(b.x, b.y, 0.055 + rnd() * 0.075, 0.75 + rnd() * 0.25, DYES[stroke++ % DYES.length]);
      for (var j = 0; j < foldSteps; j++) { time += 0.016; step(); }
    }
  }

  function settle() {
    if (!G) { if (cpu) drawCPU(); return; }
    seedMarble(16, 44);
    present();
  }

  function drawCPU() {
    /* a still marble: warped concentric rings quantised to the dyes */
    var img = cpu.img, dd = img.data, w = cpu.w, h = cpu.h, fbm = cpu.fbm;
    var bg = C.void, i = 0;
    var cx = 0.38 * aspect, cy = 0.52;
    for (var y = 0; y < h; y++) {
      var vy = 1 - y / h;
      var bok = Math.max(0, vy - 0.84) / 0.16;
      for (var x = 0; x < w; x++) {
        var u = x / w;
        var colm = sstep(0.06, 0.47, Math.abs(u - 0.5));
        var px = u * aspect, py = vy;
        var wx = px + (fbm(px * 1.3, py * 1.3) - 0.5) * 1.15;
        var wy = py + (fbm(px * 1.3 + 40, py * 1.3 + 40) - 0.5) * 1.15;
        var d = Math.hypot(wx - cx, wy - cy);
        var band = d * 9.0;
        var bi2 = Math.floor(band) % 5;
        var frac = band - Math.floor(band);
        var soft = sstep(0.0, 0.30, frac) * (1 - sstep(0.70, 1.0, frac));
        var fall = Math.max(0, 1 - d * 1.15);
        var amt = soft * fall * (mode ? 0.44 : 0.34) * colm * S.intensity;
        var dye = bi2 === 4 ? SUMI : (bi2 % 2 === 0 ? CRIMSON : BLUE);
        for (var k = 0; k < 3; k++) {
          var v = bg[k] + (BOK[k] - bg[k]) * bok * bok * (mode ? 0.26 : 0.42);
          v = v + (dye[k] - v) * Math.min(1, amt);
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
      time += dt * (mode ? 0.00048 : 0.001);   /* the day's water is slower */
      if (seeded < 1) { seeded = 1; seedMarble(14, 36); }
      ambient(dt);
      step();
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
