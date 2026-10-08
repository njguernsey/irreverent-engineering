/*
 * matrix-text.js
 * A left-to-right glitch sweep for text. A jagged edge crosses the element,
 * sliced green copies of each glyph jitter around it, and the text on the far
 * side is swapped for the text on the near side.
 *
 *   <h1 data-matrix="load">…</h1>                    reveal on load
 *   <h1 data-matrix="load" data-matrix-from="mono">  reveal from a monospace copy
 *   <a  data-matrix="hover">…</a>                     replay on hover / focus
 *   <p  data-matrix="swap" data-matrix-text="## …">   rests as mono, swaps on hover
 *
 * Triggers combine: data-matrix="load hover".
 * Options: data-matrix-duration (ms), data-matrix-delay (ms).
 * Colours: --mx-color, --mx-hot, --mx-fringe on the element or any ancestor.
 *
 * JS: MatrixText.init(root), .reveal(el), .play(el), .show(el, 'final' | 'src')
 */
(function () {
  const CSS = `
.mx-host{position:relative}
.mx-host.mx-inline{display:inline-block}
.mx-final{display:block}
.mx-src{position:absolute;left:0;top:0;pointer-events:none;clip-path:inset(0 0 100% 0)}
.mx-src.mx-mono{font-family:var(--mx-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:var(--mx-mono-size,.82em);font-weight:400;font-style:normal;letter-spacing:0}
.mx-src.mx-mono *{font:inherit;letter-spacing:inherit}
.mx-fx{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:1}
.mx-fx>i{position:absolute;left:0;top:0;font-style:normal;white-space:pre;display:none}
.mx-fx>b{position:absolute;left:0;top:0;display:none}
`;
  const SCRAMBLE = '#%&*+=<>/\\|{}[]01';
  const HIDDEN = 'inset(0 0 100% 0)';
  const states = new WeakMap();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hash(a, b) {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

  function injectCSS() {
    if (document.getElementById('mx-style')) return;
    const s = document.createElement('style');
    s.id = 'mx-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function setup(host) {
    if (states.has(host)) return states.get(host);
    const triggers = (host.dataset.matrix || '').split(/\s+/);
    const swap = triggers.includes('swap');
    const from = host.dataset.matrixFrom || '';
    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.classList.add('mx-host');
    if (cs.display === 'inline') host.classList.add('mx-inline');

    const final = document.createElement('span');
    final.className = 'mx-final';
    while (host.firstChild) final.appendChild(host.firstChild);
    host.appendChild(final);

    const mono = swap || from === 'mono';
    const src = copy(final, mono);
    if (host.dataset.matrixText) src.textContent = host.dataset.matrixText;
    host.appendChild(src);
    // Hover replays in the element's own font, so a mono or custom-text source gets a plain twin.
    const layers = { final, src };
    if (triggers.includes('hover') && (mono || host.dataset.matrixText)) host.appendChild((layers.echo = copy(final, false)));

    const fx = document.createElement('span');
    fx.className = 'mx-fx';
    fx.setAttribute('aria-hidden', 'true');
    host.appendChild(fx);

    const st = {
      host, final, src, fx, triggers, swap, from, layers,
      current: 'final', L: null, R: null, p: 0, dir: 1,
      running: false, chars: [], pool: { i: [], b: [] },
    };
    states.set(host, st);
    place(st);
    new ResizeObserver(() => place(st)).observe(host);

    if (triggers.includes('hover')) {
      const go = () => play(host);
      host.addEventListener('mouseenter', go);
      host.addEventListener('focusin', go);
    }
    if (swap) {
      rest(st, 'src');
      host.addEventListener('mouseenter', () => show(host, 'final'));
      host.addEventListener('focusin', () => show(host, 'final'));
      host.addEventListener('mouseleave', () => show(host, 'src'));
      host.addEventListener('focusout', () => show(host, 'src'));
    }
    if (triggers.includes('load')) {
      rest(st, loadFrom(st));
      setTimeout(() => reveal(host), +host.dataset.matrixDelay || 0);
    }
    host.classList.add('mx-ready');
    return st;
  }

  function copy(final, mono) {
    const el = document.createElement('span');
    el.className = 'mx-src' + (mono ? ' mx-mono' : '');
    el.setAttribute('aria-hidden', 'true');
    for (const n of final.childNodes) el.appendChild(n.cloneNode(true));
    el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    return el;
  }

  // Line the copies up with the final text. Fractional width: a copy rounded down even
  // half a pixel narrower wraps its last word onto a new line.
  function place(st) {
    const h = st.host.getBoundingClientRect();
    const f = st.final.getBoundingClientRect();
    const left = f.left - h.left - st.host.clientLeft + 'px';
    const top = f.top - h.top - st.host.clientTop + 'px';
    for (const el of [...Object.values(st.layers), st.fx]) {
      if (el === st.final) continue;
      el.style.left = left;
      el.style.top = top;
      if (el !== st.fx) el.style.width = f.width + 'px';
    }
  }

  // Put the element at rest with one layer fully visible (null = nothing).
  function rest(st, name) {
    st.current = name;
    st.running = false;
    for (const [n, el] of Object.entries(st.layers)) {
      el.style.clipPath = n === name ? 'none' : HIDDEN;
      el.style.webkitMaskImage = el.style.maskImage = '';
    }
    for (const n of st.fx.children) n.style.display = 'none';
  }

  function measure(st) {
    place(st);
    const origin = st.final.getBoundingClientRect();
    const chars = [];
    const range = document.createRange();
    const fonts = new Map();
    let i = 0;
    for (const name of [st.L, st.R]) {
      if (!name) continue;
      const walker = document.createTreeWalker(st.layers[name], NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode()); ) {
        const parent = node.parentElement;
        if (!fonts.has(parent)) {
          const c = getComputedStyle(parent);
          fonts.set(parent, `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`);
        }
        const text = node.data;
        let at = 0;
        for (const ch of text) {
          const len = ch.length;
          if (ch.trim()) {
            range.setStart(node, at);
            range.setEnd(node, at + len);
            const r = [...range.getClientRects()].find((q) => q.width > 0);
            if (r) {
              const x = r.left - origin.left, y = r.top - origin.top;
              chars.push({ i: i++, ch, layer: name, x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2, font: fonts.get(parent) });
            }
          }
          at += len;
        }
      }
    }
    const fcs = getComputedStyle(st.final);
    const fs = parseFloat(fcs.fontSize);
    const lh = parseFloat(fcs.lineHeight) || fs * 1.25;
    const boxes = [st.final, st.layers[st.L], st.layers[st.R]].filter(Boolean).map((el) => el.getBoundingClientRect());
    const W = Math.max(...boxes.map((b) => b.width));
    const H = Math.max(...boxes.map((b) => b.height));
    const hs = getComputedStyle(st.host);
    st.chars = chars;
    st.W = W;
    st.H = H;
    st.stripH = Math.max(3, lh / 3);
    st.lineH = lh;
    st.J = Math.min(Math.max(W * 0.08, 14), 90);
    st.band = Math.min(Math.max(W * 0.14, 40), 170);
    st.pad = st.J + st.band;
    st.strips = Math.ceil((H + 20) / st.stripH);
    st.lineNoise = Array.from({ length: Math.ceil(H / lh) + 2 }, () => Math.random() * 2 - 1);
    st.color = hs.getPropertyValue('--mx-color').trim() || '#3dff8e';
    st.hot = hs.getPropertyValue('--mx-hot').trim() || '#e4fff0';
    st.fringe = hs.getPropertyValue('--mx-fringe').trim() || '#ff4df0';
    st.dur = +st.host.dataset.matrixDuration || Math.min(Math.max(W * 1.6, 650), 1700);
    st.seed = (Math.random() * 1e6) | 0;
  }

  function show(host, name, force) {
    const st = states.get(host) || setup(host);
    if (reduced()) return rest(st, name);
    if (st.running) {
      if (name === st.L) st.dir = 1;
      else if (name === st.R) st.dir = -1;
      return;
    }
    if (st.current === name && !force) return;
    st.L = name;
    st.R = force ? force : st.current;
    st.p = 0;
    st.dir = 1;
    measure(st);
    start(st);
  }

  // Replay the sweep in place: a same-font copy on the right, the final text on the left.
  function play(host) {
    const st = states.get(host) || setup(host);
    if (st.running || reduced()) return;
    if (st.swap) return show(host, st.current === 'final' ? 'src' : 'final');
    show(host, 'final', st.layers.echo ? 'echo' : 'src');
  }

  // Start from the source layer (mono) or from nothing, then sweep to the rest state.
  const loadFrom = (st) => (st.from === 'mono' && !st.swap ? 'src' : null);
  function reveal(host) {
    const st = states.get(host) || setup(host);
    rest(st, loadFrom(st));
    show(host, st.swap ? 'src' : 'final');
  }

  function start(st) {
    st.running = true;
    st.elapsed = 0;
    let last = performance.now();
    const step = (now) => {
      if (!st.running) return;
      // rAF timestamps can predate performance.now() at start, so never step backwards.
      const dt = Math.min(Math.max(now - last, 0), 40);
      last = now;
      st.elapsed += dt;
      st.p = Math.min(1, Math.max(0, st.p + (st.dir * dt) / st.dur));
      frame(st);
      if (st.p >= 1) return rest(st, st.L);
      if (st.p <= 0 && st.dir < 0) return rest(st, st.R);
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  function frame(st) {
    const { W, H, J, band, pad, stripH, lineH, strips, seed } = st;
    const tick = Math.floor(st.elapsed / 55);
    const base = -pad + ease(st.p) * (W + 2 * pad);

    const edges = new Array(strips);
    for (let s = 0; s < strips; s++) {
      const line = Math.floor((s * stripH) / lineH);
      let off = J * (0.65 * st.lineNoise[Math.min(line, st.lineNoise.length - 1)] + 0.35 * (hash(s + seed, tick) * 2 - 1));
      if (hash(s * 3 + seed, tick + 999) < 0.06) off += band * 0.7;
      edges[s] = base + off;
    }

    // Jagged, per-strip clip paths: incoming layer left of the edge, outgoing right of it.
    const big = W + 400;
    const left = ['-400px -40px'];
    const right = [`${big}px -40px`];
    for (let s = 0; s < strips; s++) {
      const y0 = s === 0 ? -40 : s * stripH;
      const y1 = s === strips - 1 ? H + 400 : (s + 1) * stripH;
      const e = edges[s].toFixed(1);
      left.push(`${e}px ${y0}px`, `${e}px ${y1}px`);
      right.push(`${e}px ${y0}px`, `${e}px ${y1}px`);
    }
    left.push(`-400px ${H + 400}px`);
    right.push(`${big}px ${H + 400}px`);

    for (const [n, el] of Object.entries(st.layers)) {
      if (n === st.L) {
        el.style.clipPath = `polygon(${left.join(',')})`;
        el.style.webkitMaskImage = el.style.maskImage =
          `linear-gradient(90deg,#000 ${base - band}px,rgba(0,0,0,.3) ${base + J}px)`;
      } else if (n === st.R) {
        el.style.clipPath = `polygon(${right.join(',')})`;
        el.style.webkitMaskImage = el.style.maskImage =
          `linear-gradient(90deg,rgba(0,0,0,.3) ${base - J}px,#000 ${base + band}px)`;
      } else {
        el.style.clipPath = HIDDEN;
      }
    }

    // Glitch copies around the edge.
    let gi = 0, bi = 0;
    for (const c of st.chars) {
      const s = Math.min(strips - 1, Math.max(0, Math.floor(c.cy / stripH)));
      const dx = c.cx - edges[s];
      let k;
      if (c.layer === st.L) k = dx < 0 ? 1 + dx / band : (1 - dx / (band * 0.5)) * 0.5;
      else k = dx > 0 ? 1 - dx / band : (1 + dx / (band * 0.5)) * 0.5;
      if (k <= 0) continue;
      const copies = k > 0.5 ? 2 : 1;
      for (let copy = 0; copy < copies; copy++) {
        const salt = c.i * 32 + copy * 16 + seed;
        const r = (n) => hash(salt + n, tick);
        if (r(0) > Math.min(1, k * 1.3)) continue;
        const sc = c.h / 20;

        if (r(1) < 0.3) {
          // Pixel dots, and now and then a long thin smear.
          const el = get(st, 'b', bi++);
          const w = r(2) < 0.2 ? c.w * (1 + r(6) * 3) : (2 + r(6) * 6) * sc;
          el.style.cssText =
            `display:block;width:${w.toFixed(1)}px;height:${Math.max(2, c.h * 0.09).toFixed(1)}px;` +
            `background:${r(3) < 0.3 ? st.hot : st.color};opacity:${(0.3 + 0.6 * k).toFixed(2)};` +
            `transform:translate(${(c.x + (r(4) - 0.5) * c.w * 3).toFixed(1)}px,${(c.y + r(5) * c.h).toFixed(1)}px)`;
          continue;
        }

        const el = get(st, 'i', gi++);
        const ch = r(6) > 0.85 ? SCRAMBLE[(r(7) * SCRAMBLE.length) | 0] : c.ch;
        if (el.textContent !== ch) el.textContent = ch;
        const jx = (r(2) - 0.5) * 2 * (0.3 + k) * 16 * sc;
        const top = r(3) * 60;
        const bot = r(4) * Math.max(0, 85 - top);
        const sx = r(5) < 0.15 ? 1 + r(8) * 2.5 : 1;
        const fringe = r(9) < 0.025;
        const col = fringe ? st.fringe : k > 0.7 && r(10) > 0.5 ? st.hot : st.color;
        el.style.cssText =
          `display:block;font:${c.font};line-height:${c.h}px;height:${c.h}px;color:${col};` +
          `opacity:${((fringe ? 0.5 : 1) * (0.35 + 0.65 * k)).toFixed(2)};text-shadow:0 0 ${(5 * sc).toFixed(1)}px ${col};` +
          `clip-path:inset(${top.toFixed(0)}% 0 ${bot.toFixed(0)}% 0);transform-origin:0 0;` +
          `transform:translate(${(c.x + jx).toFixed(1)}px,${c.y.toFixed(1)}px) scaleX(${sx.toFixed(2)})`;
      }
    }
    hide(st.pool.i, gi);
    hide(st.pool.b, bi);
  }

  function get(st, tag, n) {
    const pool = st.pool[tag];
    if (!pool[n]) {
      const el = document.createElement(tag);
      st.fx.appendChild(el);
      pool[n] = el;
    }
    return pool[n];
  }
  function hide(pool, from) {
    for (let n = from; n < pool.length; n++) pool[n].style.display = 'none';
  }

  function init(root = document) {
    injectCSS();
    const els = root.querySelectorAll('[data-matrix]');
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    return ready.then(() => els.forEach(setup));
  }

  window.MatrixText = { init, play, show, reveal, setup };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})();
