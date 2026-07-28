/* ═══════════════════════════════════════════════════════════════
   PE//1 — the substrate: 水墨 · an ink wash of the prediction error

   Two fields advect through six cortical laminae in opposite
   directions. Prediction descends from L1, evidence ascends from L6,
   and the ink is their residual.

   Which gives the composition its rule, and the rule is 留白:
   where prediction and evidence cancel, nothing is painted. The
   empty paper is not decoration and it is not restraint — it is the
   part of the world the model already predicted. Ink only appears
   where the prediction failed.

   The wash is built the way ink actually behaves on 宣紙:

     留白      most of the sheet is untouched
     邊緣濃聚  pigment migrates outward as water leaves, so the rim
               of every wash is darker than its interior
     五墨      value resolves into discrete tones, not a smooth ramp
     飛白      a starved brush breaks into streaks along its travel
     宣紙纖維  ink feathers anisotropically along the paper's fibres
     水痕      damp meeting wet leaves a hard-edged backrun
     破墨      dark ink dropped into a wet wash bleeds at the join

   IN VIVO inverts the sheet: the paper is night and the ink is
   luminous, which is what a rubbing (拓本) does to a carved stone.
   FIXED is ink on paper, the ordinary way round.

   WebGL where available; a Canvas2D wash that follows the same
   rules where not.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PE = window.PE;
  if (!PE) return;

  var cv = document.getElementById('substrate');
  if (!cv) return;

  var S = PE.state;
  var time = 0;          // advances only in vivo — a fixed sheet is dry
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
    'uniform float uTime, uMode, uInt, uProg, uPulse, uVel, uLevels, uTones;',
    'uniform vec3 uPre, uSig, uInk, uBg;',

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

    /* ordered dither: recursive Bayer, no lookup texture. At ink
       densities this reads as the tooth of the paper, not as banding. */
    'float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }',
    'float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    'float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }',

    /* stroke space — a slowly turning field, so washes and their dry
       streaks elongate along the direction the brush was travelling */
    'vec2 brush(vec2 p, float t){',
    '  float ang = (fbm(p * 0.42 + vec2(t * 0.008, 0.0)) - 0.5) * 2.6;',
    '  float c = cos(ang), s = sin(ang);',
    '  return mat2(c, -s, s, c) * p;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float aspect = uRes.x / uRes.y;',
    '  vec2 p = vec2(uv.x * aspect, 1.0 - uv.y);',   /* y = 0 at pia */
    '  float d = p.y;',

    /* laminar density — L4 is the granular input band, L5 the output band.
       The ink pools where the cortex is dense, which is why the wash has
       horizontal structure at all. */
    '  float l4  = exp(-pow((d - 0.42) / 0.055, 2.0));',
    '  float l23 = smoothstep(0.10, 0.19, d) * (1.0 - smoothstep(0.33, 0.42, d));',
    '  float l5  = smoothstep(0.50, 0.59, d) * (1.0 - smoothstep(0.74, 0.90, d));',
    '  float lam = 0.34 + 0.46 * l23 + 0.80 * l4 + 0.56 * l5;',
    '  lam *= 1.0 - smoothstep(0.88, 1.0, d) * 0.5;',
    '  lam *= 1.0 - smoothstep(0.07, 0.0, d) * 0.45;',

    '  float drift = uProg * 1.5 + uVel * 0.18;',

    /* the counterflow, warped hard: a brush does not travel in straight lines */
    '  vec2 q = vec2(p.x * 2.7, p.y * 3.2);',
    '  float w = fbm(q * 0.46 + vec2(uTime * 0.010, drift * 0.05));',
    '  vec2 qw = q + vec2(w * 1.25, w * 0.80);',
    '  float pred = fbm(qw + vec2(0.0, -uTime * 0.040 - drift));',
    '  float evid = fbm(qw * 1.06 + vec2(37.4, uTime * 0.052 - drift * 0.70));',

    /* the pointer wets the paper very slightly where you are reading */
    '  float r = distance(p, vec2(uPtr.x * aspect, 1.0 - uPtr.y));',
    '  evid += exp(-r * r * 26.0) * (0.045 + uPulse * 0.55);',

    /* THE RESIDUAL — and therefore the ink */
    '  float resid = (pred - evid) * 3.0;',
    '  float a = abs(resid);',

    '  vec2 bs = brush(p, uTime);',

    /* 留白 — nothing is painted below the threshold */
    '  float body = smoothstep(0.46, 1.12, a);',

    /* 邊緣濃聚 — pigment migrates to the perimeter as the water leaves */
    '  float rim = exp(-pow((a - 0.485) / 0.050, 2.0));',

    /* 五墨 — the wash resolves into discrete tones */
    '  float stepped = floor(body * uTones + 0.5) / uTones;',
    '  float ink = mix(body, stepped, 0.62);',

    /* 宣紙纖維 — ink feathers along the fibre, not across it */
    '  float fibre = vnoise(vec2(bs.x * 300.0, bs.y * 52.0));',
    '  ink *= mix(0.82, 1.0, fibre);',

    /* 飛白 — a starved brush breaks into streaks along its travel */
    '  float dry = vnoise(vec2(bs.x * 88.0, bs.y * 16.0 + w * 2.0));',
    '  ink *= mix(smoothstep(0.08, 0.72, dry), 1.0, smoothstep(0.50, 0.94, body));',

    /* granulation — pigment settles into the tooth of the sheet */
    '  ink *= mix(0.90, 1.0, vnoise(p * 290.0));',

    /* 水痕 — damp meeting wet leaves a hard-edged backrun */
    '  float bl = fbm(qw * 0.52 + vec2(19.0, -uTime * 0.014));',
    '  float bloom = exp(-pow((bl - 0.52) / 0.016, 2.0)) * smoothstep(0.04, 0.22, ink);',

    /* 破墨 — the second ink bleeds where it meets the first */
    '  float po = smoothstep(0.86, 1.20, a) * smoothstep(0.30, 0.70, fibre);',

    /* the recording column stays dry — a wash never runs under the copy */
    '  float colm = smoothstep(0.11, 0.41, abs(uv.x - 0.5));',
    '  float amp = lam * uInt * mix(0.17, 1.0, colm);',
    '  float gain = mix(0.58, 0.44, uMode);',

    '  float amt = (ink + rim * 0.34 + bloom * 0.22 + po * 0.18) * amp * gain;',
    '  amt = clamp(amt, 0.0, 1.0);',

    /* the tooth of the sheet is part of the sheet, not a layer over it —
       宣紙 is fibrous everywhere, including where no ink ever landed */
    '  float tooth = vnoise(p * 520.0 + bs * 26.0) + vnoise(p * 137.0) * 0.5;',
    '  vec3 paper = uBg + (tooth / 1.5 - 0.5) * mix(0.013, 0.024, uMode);',

    /* prediction and evidence stain differently, but only just — this is
       ink first and pigment second */
    '  vec3 tint = resid > 0.0 ? uPre : uSig;',
    '  vec3 inkCol = mix(uInk, tint, 0.13);',
    '  vec3 col = mix(paper, inkCol, amt);',

    /* the tooth of the paper */
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
    ['uRes', 'uPtr', 'uTime', 'uMode', 'uInt', 'uProg', 'uPulse', 'uVel', 'uLevels', 'uTones',
      'uPre', 'uSig', 'uInk', 'uBg'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

    return { gl: gl, U: U };
  }

  /* ── Canvas2D path: the same wash, computed on the CPU ────── */
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
    var B = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
    return { ctx: ctx, fbm: fbm, vn: vn, B: B, img: null, w: 0, h: 0 };
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

  var C = null, INK = [0, 0, 0];
  function colours() {
    C = PE.colors();
    var v = getComputedStyle(document.documentElement).getPropertyValue('--ink-wash').trim();
    var m = v.match(/^#([0-9a-f]{6})$/i);
    INK = m ? [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255]
      : C.ink;
  }
  colours(); resize();

  PE.on('modechange', function (m) {
    mode = m === 'fixed' ? 1 : 0;
    colours(); resize(); if (PE.reduced) draw(0);
  });
  addEventListener('resize', PE.debounce(function () { resize(); if (PE.reduced) draw(0); }, 180), { passive: true });

  /* ── draw ─────────────────────────────────────────────────── */
  function draw(dt) {
    if (!mode) time += dt * 0.001;      /* a fixed sheet is dry; it does not move */
    var levels = mode ? 14.0 : 30.0;
    var tones = mode ? 4.0 : 5.0;       /* 五墨, one fewer when printed */
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
      g.uniform1f(U.uTones, tones);
      g.uniform3fv(U.uPre, C.pre);
      g.uniform3fv(U.uSig, C.sig);
      g.uniform3fv(U.uInk, INK);
      g.uniform3fv(U.uBg, C.void);
      g.drawArrays(g.TRIANGLES, 0, 3);
      return;
    }

    /* CPU wash — fewer octaves, same rules */
    var img = cpu.img, dd = img.data, w = cpu.w, h = cpu.h, fbm = cpu.fbm, vn = cpu.vn, B = cpu.B;
    var aspect = w / h, drift = S.prog * 1.5, gain = mode ? 0.44 : 0.58;
    var bg = C.void, pre = C.pre, sig = C.sig;
    var i = 0;
    for (var y = 0; y < h; y++) {
      var dep = y / h;
      var l4 = Math.exp(-Math.pow((dep - 0.42) / 0.055, 2));
      var l23 = sstep(0.10, 0.19, dep) * (1 - sstep(0.33, 0.42, dep));
      var l5 = sstep(0.50, 0.59, dep) * (1 - sstep(0.74, 0.90, dep));
      var lam = (0.34 + 0.46 * l23 + 0.80 * l4 + 0.56 * l5) * (1 - sstep(0.88, 1.0, dep) * 0.5);
      for (var x = 0; x < w; x++) {
        var u = x / w;
        var amp = lam * intensity * (0.17 + 0.83 * sstep(0.11, 0.41, Math.abs(u - 0.5)));
        var qx = u * aspect * 2.7, qy = dep * 3.2;
        var ww = fbm(qx * 0.46, qy * 0.46);
        var wx = qx + ww * 1.25, wy = qy + ww * 0.80;
        var pred = fbm(wx, wy - time * 0.040 - drift);
        var evid = fbm(wx * 1.06 + 37.4, wy * 1.06 + time * 0.052 - drift * 0.70);
        var resid = (pred - evid) * 3.0, aa = Math.abs(resid);

        var body = sstep(0.46, 1.12, aa);
        var rim = Math.exp(-Math.pow((aa - 0.485) / 0.050, 2));
        var stepped = Math.floor(body * tones + 0.5) / tones;
        var ink = body + (stepped - body) * 0.62;
        var fibre = vn(u * aspect * 360, dep * 64);
        ink *= 0.82 + 0.18 * fibre;
        var dry = sstep(0.08, 0.72, vn(u * aspect * 88, dep * 16 + ww * 2));
        var solid = sstep(0.50, 0.94, body);
        ink *= dry + (1 - dry) * solid;
        var amt = Math.min(1, (ink + rim * 0.34) * amp * gain);

        var tint = resid > 0 ? pre : sig;
        var th = B[(y & 7) * 8 + (x & 7)] / 64;
        var tooth = (vn(u * aspect * 520, dep * 520) - 0.5) * (mode ? 0.024 : 0.013);
        for (var k = 0; k < 3; k++) {
          var inkc = INK[k] + (tint[k] - INK[k]) * 0.13;
          var v = bg[k] + tooth + (inkc - bg[k] - tooth) * amt;
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

  /* ── run ──────────────────────────────────────────────────── */
  cv.classList.add('live');
  if (PE.reduced) {
    draw(0);   /* one designed static sheet */
  } else {
    var acc = 0, budget = cpu ? 40 : 0;   /* the CPU wash runs at 25 fps */
    PE.loop.add('substrate', function (dt) {
      if (budget) { acc += dt; if (acc < budget) return; dt = acc; acc = 0; }
      draw(dt);
    });
  }
  PE.on('motionchange', function (r) {
    if (r) { PE.loop.remove('substrate'); draw(0); }
  });
})();
