/* ═══════════════════════════════════════════════════════════════
   PE//1 — the substrate: a cortical counterflow field

   Two fields advect through six laminae in opposite directions.
   Prediction descends from L1. Evidence ascends from L6. What you
   see is the residual: where the two agree they annihilate and the
   field goes quiet; where they disagree the disagreement is the
   only thing that survives. That is the whole theory, running.

   The image is then quantised through an 8×8 Bayer matrix at
   sensor resolution — in vivo it reads as photomultiplier noise,
   fixed it reads as a printed halftone plate.

   WebGL where available; an identical Canvas2D field where not.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PE = window.PE;
  if (!PE) return;

  var cv = document.getElementById('substrate');
  if (!cv) return;

  var S = PE.state;
  var time = 0;          // advances only in vivo — fixed tissue does not evolve
  var mode = 0;          // 0 vivo, 1 fixed

  /* ── shaders ──────────────────────────────────────────────── */
  var VERT = [
    'attribute vec2 a;',
    'void main(){ gl_Position = vec4(a, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform vec2 uPtr;',
    'uniform float uTime, uMode, uInt, uProg, uPulse, uVel, uLevels;',
    'uniform vec3 uPre, uSig, uInh, uBg;',

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
    '  for(int i = 0; i < 5; i++){ s += a * vnoise(p); p = m * p; a *= 0.5; }',
    '  return s;',
    '}',

    /* ordered dither: recursive Bayer, no lookup texture */
    'float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }',
    'float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    'float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / uRes.y;',
    '  vec2 p = vec2(uv.x * aspect, 1.0 - uv.y);',   /* y = 0 at pia */
    '  float d = p.y;',

    /* laminar density — L4 is the granular input band, L5 the output band */
    '  float l4  = exp(-pow((d - 0.42) / 0.05, 2.0));',
    '  float l23 = smoothstep(0.10, 0.19, d) * (1.0 - smoothstep(0.33, 0.42, d));',
    '  float l5  = smoothstep(0.50, 0.59, d) * (1.0 - smoothstep(0.74, 0.90, d));',
    '  float lam = 0.30 + 0.50 * l23 + 0.85 * l4 + 0.60 * l5;',
    '  lam *= 1.0 - smoothstep(0.88, 1.0, d) * 0.55;',
    '  lam *= 1.0 - smoothstep(0.06, 0.0, d) * 0.5;',

    '  float drift = uProg * 1.9 + uVel * 0.28;',
    '  vec2 q = vec2(p.x * 7.4, p.y * 8.6);',
    '  float w = fbm(q * 0.34 + vec2(uTime * 0.015, drift * 0.08));',
    '  vec2 qw = q + vec2(w * 0.85, w * 0.55);',

    /* the counterflow */
    '  float pred = fbm(qw + vec2(0.0, -uTime * 0.085 - drift));',
    '  float evid = fbm(qw * 1.07 + vec2(37.4, uTime * 0.105 - drift * 0.72));',

    /* the pointer is an electrode: it injects evidence where you look */
    '  float r = distance(p, vec2(uPtr.x * aspect, 1.0 - uPtr.y));',
    '  evid += exp(-r * r * 22.0) * (0.12 + uPulse * 0.9);',

    /* THE RESIDUAL, drawn as its own zero set.
       Filling area with the residual gives clouds; drawing the surfaces
       where prediction exactly cancels evidence gives a phase map, and a
       phase map is both quieter and more honest about what is happening. */
    '  float resid = (pred - evid) * 3.4;',
    '  float fq = resid * 1.75;',
    '  float band = abs(fract(fq) - 0.5);',
    '  float contour = smoothstep(0.055, 0.0, band);',
    '  float zero = smoothstep(0.14, 0.0, abs(resid));',   /* the true null surface */

    /* the recording column stays calm — motion does not run under copy */
    '  float colm = smoothstep(0.04, 0.34, abs(uv.x - 0.5));',
    '  float amp = lam * uInt * mix(0.16, 1.0, colm);',
    '  float sgn = mix(1.0, -1.0, uMode);',   /* in vivo it emits; fixed it stains */
    '  float gain = mix(0.30, 0.26, uMode);',

    '  vec3 tint = resid > 0.0 ? uPre : uSig;',
    '  vec3 f = vec3(0.0);',
    '  f += tint * contour * gain;',
    '  f += uInh * zero * gain * 0.40;',
    '  f += tint * abs(resid) * 0.022;',
    '  vec3 col = uBg + sgn * f * amp;',

    /* sensor quantisation */
    '  float th = bayer8(gl_FragCoord.xy);',
    '  col = floor(col * uLevels + th) / uLevels;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ── WebGL path ───────────────────────────────────────────── */
  function initGL() {
    var gl;
    try {
      gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' })
        || cv.getContext('experimental-webgl');
    } catch (e) { return null; }
    if (!gl) return null;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return null; }
    gl.useProgram(pr);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uRes', 'uPtr', 'uTime', 'uMode', 'uInt', 'uProg', 'uPulse', 'uVel', 'uLevels', 'uPre', 'uSig', 'uInh', 'uBg']
      .forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

    return { gl: gl, U: U };
  }

  /* ── Canvas2D path: the same field, computed on the CPU ───── */
  function initCPU() {
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    var perm = new Uint8Array(512), rnd = PE.rng(0x9e37);
    for (var i = 0; i < 256; i++) perm[i] = (rnd() * 256) | 0;
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function h2(x, y) { return perm[(perm[x & 255] + (y & 255)) & 255] / 255; }
    function vn(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
      return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    }
    function fbm(x, y) {
      var s = 0, a = 0.5;
      for (var o = 0; o < 3; o++) {
        s += a * vn(x, y);
        var nx = 1.62 * x + 1.18 * y, ny = -1.18 * x + 1.62 * y;
        x = nx; y = ny; a *= 0.5;
      }
      return s;
    }
    var B = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
    return { ctx: ctx, fbm: fbm, B: B, img: null, w: 0, h: 0 };
  }

  var gl = null, cpu = null;
  if (!(gl = initGL())) cpu = initCPU();
  if (!gl && !cpu) return;

  /* ── sizing: one render pixel is one dither cell ─────────── */
  var px = 2, W = 0, H = 0;
  cv.style.imageRendering = 'pixelated';
  function resize() {
    var cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight;
    px = mode ? 3 : 2;
    if (innerWidth < 760) px += 1;
    if (cpu) px = Math.max(px, 5);
    W = Math.max(2, Math.round(cw / px));
    H = Math.max(2, Math.round(ch / px));
    cv.width = W; cv.height = H;
    if (gl) gl.gl.viewport(0, 0, W, H);
    if (cpu) { cpu.img = cpu.ctx.createImageData(W, H); cpu.w = W; cpu.h = H; cpu.ctx.imageSmoothingEnabled = false; }
  }

  var C = null;
  function colours() { C = PE.colors(); }
  colours(); resize();

  PE.on('modechange', function (m) {
    mode = m === 'fixed' ? 1 : 0;
    colours(); resize(); if (PE.reduced) draw(0);
  });
  addEventListener('resize', PE.debounce(function () { resize(); if (PE.reduced) draw(0); }, 180), { passive: true });

  /* ── draw ─────────────────────────────────────────────────── */
  function draw(dt) {
    if (!mode) time += dt * 0.001;      /* fixed sections do not evolve */
    var levels = mode ? 6.0 : 22.0;
    var intensity = S.intensity;

    if (gl) {
      var g = gl.gl, U = gl.U;
      g.uniform2f(U.uRes, W, H);
      g.uniform2f(U.uPtr, S.ptr.x, S.ptr.y);
      g.uniform1f(U.uTime, time);
      g.uniform1f(U.uMode, mode);
      g.uniform1f(U.uInt, intensity);
      g.uniform1f(U.uProg, S.prog);
      g.uniform1f(U.uPulse, S.pulse);
      g.uniform1f(U.uVel, Math.max(-3, Math.min(3, S.vel)));
      g.uniform1f(U.uLevels, levels);
      g.uniform3fv(U.uPre, C.pre);
      g.uniform3fv(U.uSig, C.sig);
      g.uniform3fv(U.uInh, C.inh);
      g.uniform3fv(U.uBg, C.void);
      g.drawArrays(g.TRIANGLES, 0, 3);
      return;
    }

    /* CPU field — three octaves, same composition, same dither */
    var img = cpu.img, d = img.data, w = cpu.w, h = cpu.h, fbm = cpu.fbm, B = cpu.B;
    var aspect = w / h, drift = S.prog * 1.9, sgn = mode ? -1 : 1, gain = mode ? 0.34 : 0.46;
    var bg = C.void, pre = C.pre, sig = C.sig, inh = C.inh;
    var i = 0;
    for (var y = 0; y < h; y++) {
      var dep = y / h;
      var l4 = Math.exp(-Math.pow((dep - 0.42) / 0.05, 2));
      var l23 = sstep(0.10, 0.19, dep) * (1 - sstep(0.33, 0.42, dep));
      var l5 = sstep(0.50, 0.59, dep) * (1 - sstep(0.74, 0.90, dep));
      var lam = (0.30 + 0.50 * l23 + 0.85 * l4 + 0.60 * l5) * (1 - sstep(0.88, 1.0, dep) * 0.55);
      for (var x = 0; x < w; x++) {
        var u = x / w;
        var amp = lam * intensity * (0.16 + 0.84 * sstep(0.04, 0.34, Math.abs(u - 0.5)));
        var qx = u * aspect * 7.4, qy = dep * 8.6;
        var pred = fbm(qx, qy - time * 0.085 - drift);
        var evid = fbm(qx * 1.07 + 37.4, qy * 1.07 + time * 0.105 - drift * 0.72);
        var resid = (pred - evid) * 3.4;
        var fq = resid * 1.75;
        var band = Math.abs(fq - Math.floor(fq) - 0.5);
        var contour = sstep(0.055, 0.0, band);
        var zero = sstep(0.14, 0.0, Math.abs(resid));
        var tint = resid > 0 ? pre : sig;
        var th = B[(y & 7) * 8 + (x & 7)] / 64;
        for (var k = 0; k < 3; k++) {
          var f = tint[k] * contour * gain + inh[k] * zero * gain * 0.40 + tint[k] * Math.abs(resid) * 0.022;
          var v = bg[k] + sgn * f * amp;
          v = Math.floor(v * levels + th) / levels;
          d[i + k] = Math.max(0, Math.min(255, v * 255)) | 0;
        }
        d[i + 3] = 255;
        i += 4;
      }
    }
    cpu.ctx.putImageData(img, 0, 0);
  }
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ── run ──────────────────────────────────────────────────── */
  cv.classList.add('live');
  if (PE.reduced) {
    draw(0);   /* one designed static frame */
  } else {
    var acc = 0, budget = cpu ? 33 : 0;   /* CPU field runs at 30 fps */
    PE.loop.add('substrate', function (dt) {
      if (budget) { acc += dt; if (acc < budget) return; dt = acc; acc = 0; }
      draw(dt);
    });
  }
  PE.on('motionchange', function (r) {
    if (r) { PE.loop.remove('substrate'); draw(0); }
  });
})();
