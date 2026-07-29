/* ═══════════════════════════════════════════════════════════════
   PE//1 — runtime core
   One animation owner. One event bus. One source of shared state.
   Everything else on this site registers here; nothing starts its
   own rAF chain.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var PE = (window.PE = {});

  /* ── 1. environment ─────────────────────────────────────── */
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = matchMedia('(pointer: fine)');
  PE.reduced = mqReduce.matches;
  PE.fine = mqFine.matches;
  mqReduce.addEventListener('change', function (e) {
    PE.reduced = e.matches;
    PE.emit('motionchange', e.matches);
  });

  /* ── 2. event bus ───────────────────────────────────────── */
  var subs = {};
  PE.on = function (name, fn) { (subs[name] || (subs[name] = [])).push(fn); return fn; };
  PE.emit = function (name, data) {
    var list = subs[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) { try { list[i](data); } catch (e) { console.error(e); } }
  };

  /* ── 3. shared state (written once per frame, read by all) ── */
  var S = (PE.state = {
    scroll: 0, prog: 0, vel: 0, docH: 1, vh: 1,
    ptr: { x: 0.5, y: 0.3, has: false },
    intensity: 1,      // substrate amplitude; drops inside reading zones
    pulse: 0,          // injected current, decays
    layer: 0,          // cortical layer index 0..5
    dt: 16.7, fps: 60, t: 0
  });

  /* ── 4. seeded RNG (mulberry32) — determinism where it matters ── */
  PE.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ── 5. the single animation loop ───────────────────────── */
  var members = [], running = false, last = 0;
  PE.loop = {
    add: function (id, fn) {
      members.push({ id: id, fn: fn });
      start();
      return function () { PE.loop.remove(id); };
    },
    remove: function (id) { members = members.filter(function (m) { return m.id !== id; }); },
    has: function (id) { return members.some(function (m) { return m.id === id; }); }
  };
  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  function tick(now) {
    if (document.hidden || !members.length) { running = false; return; }
    var dt = Math.min(now - last, 64); last = now;
    S.dt = dt; S.t = now / 1000;
    S.fps += ((1000 / Math.max(dt, 1)) - S.fps) * 0.08;
    S.pulse *= Math.pow(0.9, dt / 16.7);
    if (S.pulse < 0.001) S.pulse = 0;
    S.vel *= Math.pow(0.86, dt / 16.7);
    for (var i = 0; i < members.length; i++) {
      try { members[i].fn(dt, now); } catch (e) { console.error('[' + members[i].id + ']', e); }
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  /* ── 6. colour access (tokens are the single source of truth) ── */
  var colourCache = null;
  function hex(v) {
    var c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000'; c.fillStyle = v.trim();
    var s = c.fillStyle;
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
    var m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  PE.colors = function () {
    if (colourCache) return colourCache;
    var cs = getComputedStyle(root);
    colourCache = {
      void: hex(cs.getPropertyValue('--void')),
      bg1: hex(cs.getPropertyValue('--bg1')),
      sig: hex(cs.getPropertyValue('--sig')),
      pre: hex(cs.getPropertyValue('--pre')),
      inh: hex(cs.getPropertyValue('--inh')),
      ink: hex(cs.getPropertyValue('--ink')),
      muted: hex(cs.getPropertyValue('--muted')),
      css: function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); }
    };
    return colourCache;
  };
  PE.on('modechange', function () { colourCache = null; });

  /* ── 7. language ────────────────────────────────────────── */
  PE.lang = function () { return root.getAttribute('lang') === 'zh-Hant' ? 'zh' : 'en'; };
  PE.t = function (o) { return o ? (o[PE.lang()] != null ? o[PE.lang()] : o.en) : ''; };

  /* ── 8. toast ───────────────────────────────────────────── */
  var toastEl, toastTimer;
  PE.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = PE.t(msg);
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  };

  /* ── 9. scroll + pointer sampling ───────────────────────── */
  var lastScroll = scrollY;
  function measure() {
    S.vh = innerHeight;
    S.docH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  }
  measure();
  addEventListener('resize', measure, { passive: true });
  addEventListener('scroll', function () {
    S.scroll = scrollY;
    S.vel += (scrollY - lastScroll) * 0.01;
    lastScroll = scrollY;
    S.prog = Math.min(1, Math.max(0, scrollY / S.docH));
  }, { passive: true });

  if (PE.fine) {
    addEventListener('pointermove', function (e) {
      S.ptr.x = e.clientX / innerWidth;
      S.ptr.y = e.clientY / innerHeight;
      S.ptr.has = true;
    }, { passive: true });
  }

  /* stimulate: inject a current pulse into the substrate */
  PE.stimulate = function (amp) {
    S.pulse = Math.min(1.6, S.pulse + (amp || 1));
    PE.emit('pulse', amp || 1);
  };

  /* ── 10. paper ────────────────────────────────────────────────
     There is no grain layer. A full-viewport element in a blend mode
     is an expensive composited layer on exactly the devices that can
     least afford one, and the sheet's tooth belongs to the sheet: the
     substrate shader carries it, ink and empty paper alike. */

  /* ── 11. boot: baseline acquisition ─────────────────────── */
  function boot() {
    var el = document.getElementById('boot');
    if (!el) return;
    if (PE.reduced || sessionStorage.getItem('pe.booted')) { el.remove(); return; }
    sessionStorage.setItem('pe.booted', '1');
    var lines = el.querySelectorAll('.l'), bar = el.querySelector('.track i'), i = 0;
    var step = function () {
      if (i < lines.length) {
        lines[i].classList.add('on');
        if (bar) bar.style.transform = 'scaleX(' + ((i + 1) / lines.length) + ')';
        i++;
        setTimeout(step, 105);
      } else {
        setTimeout(function () {
          el.classList.add('off');
          setTimeout(function () { el.remove(); }, 600);
          document.body.classList.add('booted');
          PE.emit('booted');
        }, 180);
      }
    };
    if (bar) bar.style.transition = 'transform 110ms linear';
    setTimeout(step, 60);
  }

  /* ── 12. imaging modality: vivo (live) ⇄ fixed (histology) ── */
  function applyMode(mode) {
    root.setAttribute('data-mode', mode);
    colourCache = null;
    var btn = document.querySelector('[data-act="mode"]');
    if (btn) {
      var label = mode === 'fixed'
        ? { en: 'DAY', zh: '日' }
        : { en: 'NIGHT', zh: '夜' };
      btn.querySelector('.lb').textContent = PE.t(label);
      var glyph = btn.querySelector('.mode-glyph');
      if (glyph) glyph.textContent = mode === 'fixed' ? '☀' : '☾';
      btn.setAttribute('aria-label', PE.t(mode === 'fixed'
        ? { en: 'Colour theme: day. Switch to night.', zh: '色彩主題：日。切換為夜。' }
        : { en: 'Colour theme: night. Switch to day.', zh: '色彩主題：夜。切換為日。' }));
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--void').trim());
    PE.emit('modechange', mode);
  }
  PE.mode = function () { return root.getAttribute('data-mode') || 'vivo'; };
  PE.setMode = function (mode, origin) {
    var wash = document.getElementById('wash');
    if (wash && !PE.reduced) {
      var cs = getComputedStyle(root);
      // wash in the colour we are leaving — a fixation front sweeping the field
      wash.style.background = cs.getPropertyValue('--void').trim();
      wash.style.setProperty('--wx', origin ? origin.x + 'px' : '92%');
      wash.style.setProperty('--wy', origin ? origin.y + 'px' : '4%');
      wash.classList.remove('run'); void wash.offsetWidth; wash.classList.add('run');
      setTimeout(function () { applyMode(mode); }, 150);
    } else applyMode(mode);
    try { localStorage.setItem('pe.mode', mode); } catch (e) {}
  };

  function applyLang(lang) {
    root.setAttribute('lang', lang === 'zh' ? 'zh-Hant' : 'en');
    var btn = document.querySelector('[data-act="lang"]');
    if (btn) {
      btn.querySelector('.lb').textContent = lang === 'zh' ? 'EN' : '中';
      btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換為中文');
    }
    var menu = document.querySelector('[data-act="drawer"]');
    if (menu) {
      var open = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-label', lang === 'zh' ? (open ? '關閉選單' : '開啟選單') : (open ? 'Close menu' : 'Open menu'));
    }
    document.querySelectorAll('[data-t-en]').forEach(function (el) {
      el.textContent = lang === 'zh' ? el.getAttribute('data-t-zh') : el.getAttribute('data-t-en');
    });
    document.querySelectorAll('img[data-alt-en]').forEach(function (el) {
      el.alt = lang === 'zh' ? el.getAttribute('data-alt-zh') : el.getAttribute('data-alt-en');
    });
    PE.emit('langchange', lang);
  }
  PE.setLang = function (lang) {
    var sweep = document.getElementById('reenc');
    if (sweep && !PE.reduced) {
      sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    }
    applyLang(lang);
    try { localStorage.setItem('pe.lang', lang); } catch (e) {}
  };

  /* restore preferences before first paint of chrome */
  (function restore() {
    var m, l;
    try { m = localStorage.getItem('pe.mode'); l = localStorage.getItem('pe.lang'); } catch (e) {}
    if (!m) m = matchMedia('(prefers-color-scheme: light)').matches ? 'fixed' : 'vivo';
    applyMode(m);
    if (l) applyLang(l);
    else applyLang((navigator.language || 'en').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
  })();

  /* ── 13. settling: sections resolve as they arrive ─────────────
     A sweep, not only an observer. An observer misses anything the
     reader jumps over — an in-page anchor, Cmd+End, find-in-page —
     and a section that was jumped past would stay invisible. The
     sweep settles anything that has reached the viewport by any
     means, and a hard timeout settles everything regardless, so a
     broken frame can never cost the reader the content.            */
  function observe() {
    var pending = Array.prototype.slice.call(document.querySelectorAll('.sec, .settle'));

    function settle(el) {
      el.classList.add('settled');
      var id = el.id;
      if (id) {
        var tick = document.querySelector('.rail .tick[data-for="' + id + '"]');
        if (tick && !tick.classList.contains('fired')) {
          tick.classList.add('fired');
          PE.emit('spike', { id: id, y: parseFloat(tick.style.top) || 0 });
        }
      }
    }

    var acc = 0;
    function sweep() {
      if (!pending.length) { PE.loop.remove('settle'); return; }
      var vh = innerHeight, keep = [];
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i];
        if (el.getBoundingClientRect().top < vh * 0.92) settle(el);
        else keep.push(el);
      }
      pending = keep;
    }
    PE.loop.add('settle', function (dt) {
      acc += dt;
      if (acc < 160) return;
      acc = 0;
      sweep();
    });
    sweep();

    /* insurance: content is never held hostage by an effect */
    setTimeout(function () {
      pending.forEach(settle);
      pending = [];
      PE.loop.remove('settle');
    }, 4000);

    /* reading zones dim the substrate — motion dies near copy */
    var reads = document.querySelectorAll('.reading, .prose');
    if (reads.length && 'IntersectionObserver' in window) {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.dataset.reading = en.isIntersecting ? '1' : ''; });
        PE.targetIntensity = document.querySelector('[data-reading="1"]') ? 0.26 : 1;
      }, { rootMargin: '-22% 0px -22% 0px' });
      reads.forEach(function (r) { rio.observe(r); });
    }
  }
  PE.targetIntensity = 1;
  PE.loop.add('intensity', function (dt) {
    S.intensity += (PE.targetIntensity - S.intensity) * Math.min(1, dt / 380);
  });

  /* ── 15. cortical depth axis ────────────────────────────── */
  function depthAxis() {
    var axis = document.querySelector('.depth');
    if (!axis) return;
    var lays = axis.querySelectorAll('.lay');
    if (!lays.length) return;
    var cur = -1;
    PE.loop.add('depth', function () {
      var i = Math.min(lays.length - 1, Math.floor(S.prog * lays.length));
      S.layer = i;
      if (i === cur) return;
      cur = i;
      for (var k = 0; k < lays.length; k++) lays[k].classList.toggle('on', k === i);
    });
  }

  /* ── 16. raster rail: the scrollbar is a spike train ────── */
  function rail() {
    var el = document.querySelector('.rail');
    if (!el) return;
    var head = el.querySelector('.head');
    var secs = Array.prototype.slice.call(document.querySelectorAll('.sec[id]'));
    var track = el.querySelector('.track');

    function layout() {
      el.querySelectorAll('.tick').forEach(function (t) { t.remove(); });
      var docH = Math.max(1, document.documentElement.scrollHeight);
      secs.forEach(function (s) {
        var top = (s.getBoundingClientRect().top + scrollY) / docH;
        var t = document.createElement('button');
        t.className = 'tick';
        t.type = 'button';
        t.style.top = (top * 100).toFixed(2) + '%';
        t.dataset.for = s.id;
        var name = s.dataset.rail || s.id;
        t.innerHTML = '<span class="lb"></span>';
        t.querySelector('.lb').textContent = name;
        t.setAttribute('aria-label', name);
        t.addEventListener('click', function () {
          s.scrollIntoView({ behavior: PE.reduced ? 'auto' : 'smooth', block: 'start' });
        });
        el.appendChild(t);
      });
    }
    layout();
    addEventListener('resize', debounce(layout, 220));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(layout, 60); });

    /* accumulated spike raster: every fired section leaves a mark */
    var cv = el.querySelector('.spikes'), ctx = cv && cv.getContext('2d'), spikes = [];
    PE.on('spike', function (s) { spikes.push({ y: s.y, t: performance.now() }); });

    PE.loop.add('rail', function () {
      if (head) {
        head.style.top = (S.prog * 100).toFixed(2) + '%';
        head.setAttribute('data-pct', Math.round(S.prog * 100) + '%');
      }
      if (!ctx) return;
      var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var c = PE.colors(), now = performance.now();
      for (var i = spikes.length - 1; i >= 0; i--) {
        var age = (now - spikes[i].t) / 1400;
        if (age > 1) { continue; }
        var y = spikes[i].y / 100 * h;
        ctx.globalAlpha = (1 - age) * 0.9;
        ctx.strokeStyle = 'rgb(' + c.sig.map(function (v) { return (v * 255) | 0; }).join(',') + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w * 0.5 - 14 * (1 - age), y); ctx.lineTo(w * 0.5 + 14 * (1 - age), y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ── 17. vitals HUD ─────────────────────────────────────── */
  function hud() {
    var el = document.querySelector('.hud');
    if (!el) return;
    var cv = el.querySelector('canvas'), ctx = cv && cv.getContext('2d');
    var fpsEl = el.querySelector('[data-v="fps"]');
    var posEl = el.querySelector('[data-v="pos"]');
    var layEl = el.querySelector('[data-v="layer"]');
    var clkEl = el.querySelector('[data-v="clock"]');
    var trace = new Float32Array(220), head = 0;
    var LAYERS = ['L1', 'L2/3', 'L4', 'L5a', 'L5b', 'L6'];
    var acc = 0;

    PE.loop.add('hud', function (dt) {
      acc += dt;
      /* frame duration is a real measured signal — plot it as an LFP */
      trace[head] = dt; head = (head + 1) % trace.length;
      if (acc > 240) {
        acc = 0;
        if (fpsEl) fpsEl.textContent = Math.round(S.fps);
        if (posEl) posEl.textContent = String(Math.round(S.prog * 100)).padStart(3, '0') + '%';
        if (layEl) layEl.textContent = LAYERS[Math.min(5, S.layer)] || 'L1';
        if (clkEl) {
          try {
            clkEl.textContent = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            }).format(new Date());
          } catch (e) { clkEl.textContent = '--:--:--'; }
        }
      }
      if (!ctx) return;
      var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (!w || !h) return;
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var c = PE.colors();
      ctx.strokeStyle = 'rgba(' + c.muted.map(function (v) { return (v * 255) | 0; }).join(',') + ',.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var n = trace.length, mid = h / 2;
      for (var i = 0; i < n; i++) {
        var v = trace[(head + i) % n] || 16.7;
        var y = mid - (v - 16.7) * (h / 26);
        y = Math.max(1, Math.min(h - 1, y));
        var x = (i / (n - 1)) * w;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
  }

  /* ── 18. cursor ───────────────────────────────────────────────
     Removed. Hiding the system cursor and drawing a follower that
     lags behind it is what makes a page feel unsteady; the reader's
     own pointer is more precise than anything drawn for them. */

  /* ── 19. receptive field on units ───────────────────────── */
  function receptive() {
    if (!PE.fine) return;
    document.addEventListener('pointermove', function (e) {
      var u = e.target.closest && e.target.closest('.unit,.card');
      if (!u) return;
      var r = u.getBoundingClientRect();
      u.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      u.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  /* ── 20. command console ────────────────────────────────── */
  function consolePanel() {
    var dlg = document.getElementById('console');
    if (!dlg) return;
    var input = dlg.querySelector('input'), list = dlg.querySelector('ul');
    var items = [], sel = 0;

    function build() {
      items = [];
      document.querySelectorAll('.bar nav a, #drawer a').forEach(function (a) {
        if (items.some(function (i) { return i.href === a.getAttribute('href'); })) return;
        items.push({
          group: { en: 'Route', zh: '頁面' },
          label: { en: a.querySelector('.en') ? a.querySelector('.en').textContent : a.textContent,
                   zh: a.querySelector('.zh') ? a.querySelector('.zh').textContent : a.textContent },
          href: a.getAttribute('href'), key: a.querySelector('.ch') ? a.querySelector('.ch').textContent : ''
        });
      });
      items.push({ group: { en: 'Control', zh: '控制' }, label: { en: 'Switch day / night theme', zh: '切換日／夜主題' }, key: 'T', run: function () { PE.setMode(PE.mode() === 'vivo' ? 'fixed' : 'vivo'); } });
      items.push({ group: { en: 'Control', zh: '控制' }, label: { en: 'Switch language', zh: '切換語言' }, key: 'L', run: function () { PE.setLang(PE.lang() === 'en' ? 'zh' : 'en'); } });
      items.push({ group: { en: 'Control', zh: '控制' }, label: { en: 'Inject a current pulse', zh: '注入電流脈衝' }, key: 'S', run: function () { PE.stimulate(1.4); PE.toast({ en: 'Pulse injected', zh: '已注入脈衝' }); } });
      var mail = document.querySelector('[data-act="mail"]');
      if (mail) items.push({ group: { en: 'Contact', zh: '聯絡' }, label: { en: 'Copy email address', zh: '複製電子郵件' }, key: 'E', run: function () { copyMail(); } });
      items.push({ group: { en: 'Contact', zh: '聯絡' }, label: { en: 'Download CV (PDF)', zh: '下載履歷 PDF' }, href: 'Chi-Wei_Lee_CV.pdf' });
      items.push({ group: { en: 'Contact', zh: '聯絡' }, label: { en: 'GitHub', zh: 'GitHub' }, href: 'https://github.com/Arthur031221' });
      document.querySelectorAll('[data-cmd]').forEach(function (el) {
        items.push({
          group: { en: 'Section', zh: '章節' },
          label: { en: el.getAttribute('data-cmd-en') || el.getAttribute('data-cmd'), zh: el.getAttribute('data-cmd-zh') || el.getAttribute('data-cmd') },
          jump: el
        });
      });
    }

    function render(q) {
      var lang = PE.lang();
      var ql = (q || '').toLowerCase().trim();
      var hits = items.filter(function (it) {
        if (!ql) return true;
        return (it.label.en + ' ' + it.label.zh + ' ' + (it.group.en || '')).toLowerCase().indexOf(ql) > -1;
      });
      list.innerHTML = '';
      if (!hits.length) {
        var e = document.createElement('li');
        e.className = 'empty';
        e.textContent = lang === 'zh' ? '沒有相符的指令' : 'No matching command';
        list.appendChild(e);
        return;
      }
      sel = Math.min(sel, hits.length - 1);
      hits.forEach(function (it, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        li.innerHTML = '<span class="g"></span><span class="n"></span><span class="k"></span>';
        li.querySelector('.g').textContent = it.group[lang] || it.group.en;
        li.querySelector('.n').textContent = it.label[lang] || it.label.en;
        li.querySelector('.k').textContent = it.key || '';
        li.addEventListener('click', function () { fire(it); });
        li.addEventListener('pointerenter', function () {
          sel = i;
          list.querySelectorAll('li').forEach(function (n, j) { n.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
        });
        list.appendChild(li);
      });
      hits.forEach(function (it, i) { it._i = i; });
      window.__peHits = hits;
    }

    function fire(it) {
      close();
      if (it.run) it.run();
      else if (it.jump) it.jump.scrollIntoView({ behavior: PE.reduced ? 'auto' : 'smooth', block: 'start' });
      else if (it.href) location.href = it.href;
    }
    function open() {
      build(); sel = 0; input.value = ''; render('');
      if (!dlg.open) dlg.showModal();
      setTimeout(function () { input.focus(); }, 20);
    }
    function close() { if (dlg.open) dlg.close(); }
    PE.openConsole = open;

    input.addEventListener('input', function () { sel = 0; render(input.value); });
    dlg.addEventListener('keydown', function (e) {
      var hits = window.__peHits || [];
      if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) { e.preventDefault(); sel = (sel + 1) % Math.max(1, hits.length); render(input.value); }
      else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) { e.preventDefault(); sel = (sel - 1 + hits.length) % Math.max(1, hits.length); render(input.value); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hits[sel]) fire(hits[sel]); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  }

  /* ── 21. lightbox ───────────────────────────────────────── */
  function lightbox() {
    var dlg = document.getElementById('lightbox');
    if (!dlg) return;
    var plates = Array.prototype.slice.call(document.querySelectorAll('[data-lb]'));
    if (!plates.length) return;
    var media = dlg.querySelector('[data-lb-media]');
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    media.appendChild(img);
    var num = dlg.querySelector('.n'), cap = dlg.querySelector('.cap'), i = 0;

    function show(k) {
      i = (k + plates.length) % plates.length;
      var p = plates[i], src = p.getAttribute('data-lb');
      var w = parseInt(p.getAttribute('data-lb-width'), 10);
      var h = parseInt(p.getAttribute('data-lb-height'), 10);
      if (w && h) { img.width = w; img.height = h; }
      img.src = src;
      img.alt = PE.lang() === 'zh'
        ? (p.getAttribute('data-alt-zh') || p.getAttribute('data-cap-zh') || '')
        : (p.getAttribute('data-alt-en') || p.getAttribute('data-cap-en') || '');
      if (num) num.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(plates.length).padStart(2, '0');
      if (cap) cap.textContent = PE.lang() === 'zh' ? (p.getAttribute('data-cap-zh') || '') : (p.getAttribute('data-cap-en') || '');
    }
    plates.forEach(function (p, k) {
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '0');
      var go = function () { show(k); if (!dlg.open) dlg.showModal(); };
      p.addEventListener('click', go);
      p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    });
    dlg.querySelectorAll('[data-lb-nav]').forEach(function (b) {
      b.addEventListener('click', function () { show(i + (b.getAttribute('data-lb-nav') === 'next' ? 1 : -1)); });
    });
    var close = dlg.querySelector('[data-lb-close]');
    if (close) close.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb')) dlg.close(); });
  }

  /* ── 21b. plates resolve onto their own placeholder ─────── */
  function plates() {
    document.querySelectorAll('.plate img').forEach(function (im) {
      if (im.complete && im.naturalWidth) { im.classList.add('in'); return; }
      im.addEventListener('load', function () { im.classList.add('in'); }, { once: true });
      im.addEventListener('error', function () { im.classList.add('in'); }, { once: true });
    });
  }

  /* ── 22. publication filters ────────────────────────────── */
  function filters() {
    var wrap = document.querySelector('.filters');
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var f = b.getAttribute('data-filter');
      wrap.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var n = 0;
      document.querySelectorAll('.ledger .row').forEach(function (r) {
        var ok = f === 'all' || r.getAttribute('data-status') === f;
        r.hidden = !ok;
        if (ok) n++;
      });
      var out = document.querySelector('[data-filter-count]');
      if (out) out.textContent = String(n).padStart(2, '0');
    });
  }

  /* ── 23. copy email ─────────────────────────────────────── */
  function copyMail() {
    var el = document.querySelector('[data-act="mail"]');
    var addr = el ? el.getAttribute('data-mail') : 'levi74108520963@gmail.com';
    var done = function () { PE.toast({ en: 'Address copied — ' + addr, zh: '已複製 — ' + addr }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, function () { location.href = 'mailto:' + addr; });
    else location.href = 'mailto:' + addr;
  }

  /* ── 24. chrome wiring ──────────────────────────────────── */
  function chrome() {
    var drawer = document.getElementById('drawer');
    var drawerButton = document.querySelector('[data-act="drawer"]');
    var drawerReturnFocus = null;
    var drawerBackground = [
      document.getElementById('main'),
      document.querySelector('.bar .id'),
      document.querySelector('.bar nav'),
      document.querySelector('.bar .ctl')
    ].filter(Boolean);

    function setDrawer(open, restoreFocus) {
      if (!drawer || !drawerButton) return;
      root.classList.toggle('drawer-open', open);
      drawerButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawerButton.setAttribute('aria-label', PE.lang() === 'zh'
        ? (open ? '關閉選單' : '開啟選單')
        : (open ? 'Close menu' : 'Open menu'));
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      drawer.inert = !open;
      drawerBackground.forEach(function (el) { el.inert = open; });
      if (open) {
        drawerReturnFocus = document.activeElement;
        var first = drawer.querySelector('a');
        if (first) requestAnimationFrame(function () { first.focus(); });
      } else if (restoreFocus !== false && drawerReturnFocus && drawerReturnFocus.focus) {
        drawerReturnFocus.focus();
        drawerReturnFocus = null;
      }
    }

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'mode') {
        var r = b.getBoundingClientRect();
        PE.setMode(PE.mode() === 'vivo' ? 'fixed' : 'vivo', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else if (act === 'lang') { PE.setLang(PE.lang() === 'en' ? 'zh' : 'en'); }
      else if (act === 'console') { e.preventDefault(); PE.openConsole && PE.openConsole(); }
      else if (act === 'mail') { e.preventDefault(); copyMail(); }
      else if (act === 'drawer') { setDrawer(!root.classList.contains('drawer-open')); }
      else if (act === 'top') { scrollTo({ top: 0, behavior: PE.reduced ? 'auto' : 'smooth' }); }
    });
    document.querySelectorAll('#drawer a').forEach(function (a) {
      a.addEventListener('click', function () { setDrawer(false, false); });
    });

    addEventListener('keydown', function (e) {
      if (root.classList.contains('drawer-open')) {
        if (e.key === 'Escape') { e.preventDefault(); setDrawer(false); return; }
        if (e.key === 'Tab' && drawer && drawerButton) {
          var links = Array.prototype.slice.call(drawer.querySelectorAll('a'));
          var first = links[0], last = links[links.length - 1], active = document.activeElement;
          if (!links.length) { e.preventDefault(); drawerButton.focus(); return; }
          if (active === drawerButton) {
            e.preventDefault(); (e.shiftKey ? last : first).focus(); return;
          }
          if (e.shiftKey && active === first) {
            e.preventDefault(); drawerButton.focus(); return;
          }
          if (!e.shiftKey && active === last) {
            e.preventDefault(); drawerButton.focus(); return;
          }
          if (!drawer.contains(active)) { e.preventDefault(); first.focus(); return; }
        }
      }
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); PE.openConsole && PE.openConsole(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); PE.openConsole && PE.openConsole(); }
      else if (e.key === 't' || e.key === 'T') { PE.setMode(PE.mode() === 'vivo' ? 'fixed' : 'vivo'); }
      else if (e.key === 'l' || e.key === 'L') { PE.setLang(PE.lang() === 'en' ? 'zh' : 'en'); }
      else if (e.key === 's' || e.key === 'S') { PE.stimulate(1.4); PE.toast({ en: 'Pulse injected', zh: '已注入脈衝' }); }
      else if (e.key === 'e' || e.key === 'E') { copyMail(); }
      else if (e.key === 'Escape') { setDrawer(false); }
    });

    var drawerMQ = matchMedia('(max-width:1100px)');
    drawerMQ.addEventListener('change', function (e) { if (!e.matches) setDrawer(false, false); });
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); var a = arguments, self = this; t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }
  PE.debounce = debounce;

  /* ── 25. go ─────────────────────────────────────────────── */
  function init() {
    chrome(); observe(); depthAxis(); rail(); hud(); receptive();
    consolePanel(); lightbox(); plates(); filters(); boot();
    /* the first screen resolves without waiting for the observer */
    var first = document.querySelector('.hero, .masthead');
    if (first) {
      first.classList.add('settled');
    }
    PE.emit('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
