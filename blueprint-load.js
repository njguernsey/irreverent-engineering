/*
 * blueprint-load.js
 *
 * A load-in that draws the page as a blueprint: a blue sheet with a grid
 * and rulers, hatched placeholders with tags, dimension lines. The real
 * type is then set in white over its placeholder, and the sheet wipes down
 * to the finished page. Everything is measured from the live layout.
 *
 *   <script src="blueprint-load.js"></script>
 *
 * Put it in <head> after your stylesheets, without defer or async, so the
 * sheet is up before the page paints.
 *
 * It draws the headings, paragraphs, links, buttons and media in the first
 * screen. To steer it:
 *   data-bp="Label"   draw this element, with this tag
 *   data-bp-ignore    leave this element and its children out
 *   data-bp-kind      text | small | media, when the guess is wrong
 *
 * On the script tag:
 *   data-speed="1.5"  faster; below 1 is slower
 *   data-once         once per browser session
 *   data-only         draw [data-bp] elements only
 *   data-manual       wait for BlueprintLoad.play()
 *   data-note-left, data-note-right   corner notes; default page title, date
 *   data-blue="#2e5ff6"
 *
 * The document hears 'blueprint:reveal' as the wipe starts and
 * 'blueprint:done' once the sheet is gone; <html> gets .bp-done. Start the
 * page's own entrance animations from one of those.
 *
 * ?bp=2.4 in the URL freezes the drawing at 2.4s. ?bp=off skips it.
 */
(() => {
  'use strict';
  if (window.BlueprintLoad) return;

  const doc = document;
  const root = doc.documentElement;
  const script = doc.currentScript;
  const opt = script ? script.dataset : {};
  const query = new URLSearchParams(location.search).get('bp');
  const speed = Math.min(4, Math.max(0.25, parseFloat(opt.speed) || 1));

  // The sheet's clock, in seconds at speed 1.
  const T = {
    grid: 0, guides: 0.12, bands: 0.3, notes: 0.55,
    small: 0.7, text: 1, media: 1.45, dims: 1.9,
    measure: 2.55, settle: 3.7, set: 4, wipe: 5.2, wipeFor: 1,
  };
  const END = T.wipe + T.wipeFor;
  const ms = (s) => (s * 1000) / speed;

  const OUT = 'cubic-bezier(.2,.75,.25,1)';
  const IN_OUT = 'cubic-bezier(.7,0,.25,1)';
  const MAJOR = 80;
  const FEATHER = 160;
  const SVG = 'http://www.w3.org/2000/svg';

  const AUTO = 'h1,h2,h3,h4,h5,h6,p,blockquote,figcaption,li,dt,dd,img,video,picture,canvas,iframe,svg,a,button,input,select,textarea';
  const MEDIA = /^(img|video|picture|canvas|iframe|svg)$/;
  const SMALL = /^(a|button|input|select|textarea|label)$/;
  const CHROME = 'nav,header,[role=navigation],[role=banner]';
  const DROP = /^(script|style|link|template|noscript|canvas|video|audio|iframe|object|embed)$/;

  // Properties that decide how the white copy of an element wraps.
  const TYPE = [
    'display', 'box-sizing', 'width', 'height', 'min-width', 'max-width',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
    'font-feature-settings', 'font-variation-settings', 'font-optical-sizing', 'font-kerning',
    'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-indent',
    'text-transform', 'white-space', 'word-break', 'overflow-wrap', 'hyphens',
    'vertical-align', 'direction', 'text-decoration-line', 'text-underline-offset',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
    'flex-grow', 'flex-shrink', 'flex-basis', 'align-self', 'order',
    'list-style-type', 'list-style-position',
  ];

  const RULES = `
html.bp-loading{background:var(--bp-blue,#2e5ff6)!important}
html.bp-loading body{visibility:hidden}
.bp{--blue:var(--bp-blue,#2e5ff6);--line:rgba(255,255,255,.46);--guide:rgba(255,255,255,.34);--hatch:rgba(255,255,255,.13);
--font:var(--bp-font,Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);--note:var(--bp-note-font,Fraunces,Georgia,serif);
position:fixed;inset:0;z-index:2147483000;overflow:hidden;visibility:visible;contain:strict;
background:var(--blue);color:#fff;font:400 12px/16px var(--font);-webkit-font-smoothing:antialiased;
cursor:default;user-select:none;-webkit-user-select:none;text-align:left}
.bp *,.bp *::before,.bp *::after{box-sizing:border-box}
.bp.is-wiping{pointer-events:none;
-webkit-mask-image:linear-gradient(transparent calc(var(--bp-wipe) - ${FEATHER}px),#000 var(--bp-wipe));
mask-image:linear-gradient(transparent calc(var(--bp-wipe) - ${FEATHER}px),#000 var(--bp-wipe))}
.bp.is-fading{pointer-events:none}
.bp-grid{position:absolute;inset:0;background-position:var(--gx) 0}
.bp-grid.is-minor{background-image:linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 0),linear-gradient(rgba(255,255,255,.05) 1px,transparent 0);background-size:16px 16px}
.bp-grid.is-major{background-image:linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 0),linear-gradient(rgba(255,255,255,.12) 1px,transparent 0);background-size:${MAJOR}px ${MAJOR}px}
.bp-band{position:absolute;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.3) 0 1px,transparent 1px 5px)}
.bp-band.is-top{left:0;right:0;top:0;height:10px;border-bottom:1px solid var(--line)}
.bp-band.is-left{left:0;top:10px;bottom:0;width:10px;border-right:1px solid var(--line)}
.bp-ticks{position:absolute}
.bp-ticks.is-top{left:10px;right:0;top:10px;height:6px;background:linear-gradient(90deg,var(--line) 1px,transparent 0) calc(var(--gx) - 10px) 0/${MAJOR}px 100%}
.bp-ticks.is-left{top:10px;bottom:0;left:10px;width:6px;background:linear-gradient(var(--line) 1px,transparent 0) 0 -10px/100% ${MAJOR}px}
.bp-gv{position:absolute;top:0;bottom:0;width:1px;background:var(--guide);transform-origin:50% 0}
.bp-gh{position:absolute;left:0;right:0;height:1px;background:var(--guide);transform-origin:0 50%}
.bp-note{position:absolute;font:italic 500 15px/20px var(--note);color:rgba(255,255,255,.86);white-space:nowrap}
.bp-item{position:absolute;left:0;top:0}
.bp-chip{position:absolute;padding:0 5px;border-radius:4px;background:#fff;color:var(--blue);font:400 12px/16px var(--font);letter-spacing:0;white-space:nowrap;font-variant-numeric:tabular-nums}
.bp-chip.is-quiet{background:var(--blue);color:#fff;box-shadow:inset 0 0 0 1px var(--line)}
.bp-ruler{top:3px;left:50%;translate:-50% 0}
.bp-box{position:absolute;overflow:hidden;border:1px solid var(--line);background:repeating-linear-gradient(-45deg,var(--hatch) 0 1px,transparent 1px 7px),rgba(255,255,255,.035)}
.bp-box.is-small{border:1px dashed rgba(255,255,255,.62);background:rgba(255,255,255,.03)}
.bp-box.is-media{background:rgba(255,255,255,.045)}
.bp-box svg{position:absolute;left:-1px;top:-1px;overflow:visible}
.bp-box line{stroke:var(--line);stroke-width:1;fill:none}
.bp-sheen{position:absolute;inset:0}
.bp-sheen::before{content:"";position:absolute;top:0;bottom:0;left:0;width:calc(var(--vw) * 2);will-change:transform;
background:linear-gradient(100deg,transparent 42%,rgba(255,255,255,.17) 50%,transparent 58%);animation:bp-sheen 3.4s linear infinite}
@keyframes bp-sheen{0%{transform:translateX(var(--x0))}70%,100%{transform:translateX(var(--x1))}}
.bp-dim{position:absolute;height:9px}
.bp-dim::before,.bp-dim::after{content:"";position:absolute;top:0;width:1px;height:9px;background:var(--line)}
.bp-dim::before{left:0}.bp-dim::after{right:0}
.bp-rule{position:absolute;left:0;right:0;top:4px;border-top:1px solid var(--line)}
.bp-dim.is-dashed .bp-rule{border-top:1px dashed rgba(255,255,255,.7)}
.bp-dim .bp-chip{left:50%;top:-4px;translate:-50% 0}
.bp-mid{translate:-50% 0}
.bp-vdim{position:absolute;width:9px}
.bp-vdim::before,.bp-vdim::after{content:"";position:absolute;left:0;width:9px;height:1px;background:var(--line)}
.bp-vdim::before{top:0}.bp-vdim::after{bottom:0}
.bp-vdim .bp-rule{top:0;bottom:0;left:4px;right:auto;border-top:0;border-left:1px dashed var(--line)}
.bp-gw{position:absolute;pointer-events:none}
.bp-ghost,.bp-ghost *{-webkit-text-fill-color:currentColor!important;background:none!important;box-shadow:none!important;text-shadow:none!important;
border-color:rgba(255,255,255,.4)!important;outline:0!important;animation:none!important;transition:none!important;opacity:1!important;
transform:none!important;filter:none!important;visibility:visible!important;text-decoration-color:rgba(255,255,255,.45)!important;
clip-path:none!important;-webkit-mask:none!important;mask:none!important;mix-blend-mode:normal!important;pointer-events:none!important}
.bp-ghost :is(img,svg,picture){filter:brightness(0) invert(1)!important;opacity:.85!important}
.bp-ghost::before,.bp-ghost::after,.bp-ghost ::before,.bp-ghost ::after{color:inherit!important;background:none!important;
border-color:rgba(255,255,255,.4)!important;box-shadow:none!important;animation:none!important;transition:none!important}
`;

  let sheet = null;

  let canWipe = false;
  try {
    CSS.registerProperty({ name: '--bp-wipe', syntax: '<length>', inherits: false, initialValue: '0px' });
    canWipe = true;
  } catch (e) {
    canWipe = !!e && e.name === 'InvalidModificationError';
  }

  // ---------- small helpers ----------

  const div = (cls, parent, box) => {
    const n = doc.createElement('div');
    n.className = cls;
    if (box) place(n, box);
    if (parent) parent.appendChild(n);
    return n;
  };
  const place = (n, b) => {
    if (b.l != null) n.style.left = b.l + 'px';
    if (b.t != null) n.style.top = b.t + 'px';
    if (b.w != null) n.style.width = b.w + 'px';
    if (b.h != null) n.style.height = b.h + 'px';
  };
  const chip = (parent, text, l, t, cls) => {
    const c = div('bp-chip' + (cls ? ' ' + cls : ''), parent, l == null ? null : { l, t });
    c.textContent = text;
    return c;
  };
  const rule = (parent) => div('bp-rule', parent);
  const snap = (r) => ({ l: Math.round(r.l), t: Math.round(r.t), w: Math.round(r.w), h: Math.round(r.h) });
  const boxOf = (r) => ({ l: r.left, t: r.top, w: r.width, h: r.height });
  const grow = (r, k) => ({ l: r.l - k, t: r.t - k, w: r.w + 2 * k, h: r.h + 2 * k });
  const hits = (a, b) => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;
  const wait = (t) => new Promise((res) => setTimeout(res, t));
  const emit = (name) => doc.dispatchEvent(new CustomEvent(name));
  const today = () => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  let pen = null;
  const textWidth = (text, font = 'italic 500 15px Fraunces, Georgia, serif') => {
    pen = pen || doc.createElement('canvas').getContext('2d');
    pen.font = font;
    return Math.ceil(pen.measureText(text).width * 1.04);
  };
  const chipWidth = (text) => textWidth(text, '400 12px Inter, ui-sans-serif, system-ui, sans-serif') + 10;

  // White type that keeps the page's hierarchy: ink stays bright, softer
  // greys land dimmer.
  function tone(color) {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return '#fff';
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (a < 0.1) return '#fff'; // gradient-clipped type
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const k = Math.max(0.45, 1 - 0.9 * Math.max(0, Math.sqrt(y) - 0.1));
    return `rgba(255,255,255,${(k * Math.min(1, a)).toFixed(3)})`;
  }

  // ---------- reading the page ----------

  // The extent of an element's visible glyphs, leaving out decorations
  // that sit outside the text flow.
  function inkOf(node) {
    const loose = new Map();
    const isLoose = (el) => {
      if (!el || el === node) return false;
      if (loose.has(el)) return loose.get(el);
      const cs = getComputedStyle(el);
      const v = el.getAttribute('aria-hidden') === 'true' || cs.position === 'absolute' ||
        cs.position === 'fixed' || cs.display === 'none' || isLoose(el.parentElement);
      loose.set(el, v);
      return v;
    };
    const walk = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const range = doc.createRange();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n, seen = 0;
    while ((n = walk.nextNode()) && seen < 800) {
      if (!n.data.trim() || isLoose(n.parentElement)) continue;
      seen++;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 0.5 || q.height < 0.5) continue;
        l = Math.min(l, q.left); t = Math.min(t, q.top);
        r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      }
    }
    return r > l ? { l, t, w: r - l, h: b - t } : null;
  }

  function kindOf(node, r, cs, marked) {
    if (node.dataset.bpKind) return node.dataset.bpKind;
    const tag = node.localName;
    if (MEDIA.test(tag)) {
      if (marked) return 'media';
      const loose = cs.position === 'absolute' || cs.position === 'fixed';
      if (loose && (tag === 'svg' || tag === 'canvas' || r.width < 96)) return null;
      return r.width >= 16 && r.height >= 16 ? 'media' : null;
    }
    if (SMALL.test(tag)) return !marked && r.height > 64 ? null : 'small';
    if (!node.textContent.trim()) return marked ? 'media' : null;
    if (!marked && tag === 'li' && node.querySelector('a,button')) return null;
    return node.closest(CHROME) && r.height < 48 ? 'small' : 'text';
  }

  function labelOf(node, kind, r) {
    const set = node.getAttribute('data-bp');
    if (set) return set;
    const tag = node.localName;
    if (tag === 'h1') return 'Title';
    if (/^h[2-6]$/.test(tag)) return 'Heading';
    if (kind === 'media') {
      if (r.width < 48 && r.height < 48) return 'Icon';
      return { video: 'Video', canvas: 'Canvas', svg: 'Graphic', iframe: 'Embed' }[tag] || 'Image';
    }
    if (kind === 'small') {
      if (tag === 'button') return 'Button';
      if (/^(input|select|textarea)$/.test(tag)) return 'Field';
      return node.closest(CHROME) ? 'Nav' : 'Link';
    }
    return 'Copy';
  }

  function collect(vw, vh) {
    const only = 'only' in opt;
    const pool = doc.body.querySelectorAll(only ? '[data-bp]' : AUTO + ',[data-bp]');
    const items = [];
    for (const node of pool) {
      if (items.length >= 48) break;
      if (node.closest('[data-bp-ignore]')) continue;
      const marked = node.hasAttribute('data-bp');
      if (!marked && node.closest('[aria-hidden="true"]')) continue;
      if (items.some((it) => it.node.contains(node))) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      if (!marked && r.width * r.height > vw * vh * 0.6) continue; // page backgrounds
      const cs = getComputedStyle(node);
      const kind = kindOf(node, r, cs, marked);
      if (!kind) continue;
      const box = boxOf(r);
      const ink = kind === 'text' ? inkOf(node) : box;
      if (!ink) continue;
      items.push({ node, cs, kind, box, ink, label: labelOf(node, kind, r), chrome: !!node.closest(CHROME) });
    }

    // Stacked media, such as an avatar's eyes over its head: keep the outer one.
    const media = items.filter((it) => it.kind === 'media').sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
    const kept = [];
    for (const m of media) {
      const inside = kept.some((k) => {
        const w = Math.min(k.box.l + k.box.w, m.box.l + m.box.w) - Math.max(k.box.l, m.box.l);
        const h = Math.min(k.box.t + k.box.h, m.box.t + m.box.h) - Math.max(k.box.t, m.box.t);
        return w > 0 && h > 0 && w * h > 0.7 * m.box.w * m.box.h;
      });
      if (inside) m.drop = true; else kept.push(m);
    }

    return items
      .filter((it) => !it.drop)
      .sort((a, b) => (Math.abs(a.ink.t - b.ink.t) > 8 ? a.ink.t - b.ink.t : a.ink.l - b.ink.l));
  }

  // Multi-line text narrower than its container is first drawn at the
  // container's width, then set to its real measure.
  function measureFrom(it, vw) {
    const { node, cs, ink } = it;
    const size = parseFloat(cs.fontSize) || 16;
    const lead = parseFloat(cs.lineHeight) || size * 1.35;
    if (ink.h < lead * 1.6 || !node.parentElement) return 0;
    const p = node.parentElement;
    const pr = p.getBoundingClientRect();
    const pcs = getComputedStyle(p);
    const right = Math.min(pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth), vw - 24);
    const w = Math.round(right - ink.l);
    return w > ink.w + 48 ? w : 0;
  }

  function chromeGuides(vw, vh) {
    const out = [];
    for (const n of doc.body.querySelectorAll(CHROME)) {
      if (out.length >= 2) break;
      if ((n.parentElement && n.parentElement.closest(CHROME)) || n.closest('[data-bp-ignore]')) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= vh) continue;
      if (r.width > vw * 0.5 && r.top < vh * 0.3) out.push({ y: Math.round(r.bottom) });
      else if (r.height > r.width) out.push({ x: Math.round(r.left + r.width / 2 < vw / 2 ? r.right + 20 : r.left - 20) });
    }
    return out;
  }

  // A white copy of the element, laid out exactly as the original.
  function ghostOf(it) {
    const { node, box } = it;
    const wrap = div('bp-gw', null, box);
    const clone = node.cloneNode(true);
    const src = [node, ...node.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    const cut = [];
    src.forEach((s, i) => {
      const d = dst[i];
      d.removeAttribute('id');
      if (i && (DROP.test(s.localName) || s.localName.includes('-') ||
        s.getAttribute('aria-hidden') === 'true' || s.hasAttribute('data-bp-ignore'))) {
        cut.push(d);
        return;
      }
      const cs = getComputedStyle(s);
      if (i && (cs.position === 'absolute' || cs.position === 'fixed')) {
        cut.push(d);
        return;
      }
      for (const p of TYPE) d.style.setProperty(p, cs.getPropertyValue(p), 'important');
      d.style.setProperty('color', tone(cs.color), 'important');
    });
    cut.forEach((d) => d.remove());
    clone.classList.add('bp-ghost');
    for (const [k, v] of [['position', 'absolute'], ['left', '0'], ['top', '0'], ['margin', '0'], ['max-width', 'none'], ['min-width', '0']]) {
      clone.style.setProperty(k, v, 'important');
    }
    wrap.appendChild(clone);
    return wrap;
  }

  // ---------- drawing ----------

  function draw() {
    const vw = innerWidth;
    const vh = innerHeight;
    const items = collect(vw, vh);
    for (const it of items) if (it.kind === 'text') it.from = measureFrom(it, vw);

    const main = items.filter((it) => it.kind !== 'media' && !it.chrome);
    const col = main.length && {
      l: Math.round(Math.min(...main.map((it) => it.ink.l)) - 24),
      r: Math.round(Math.max(...main.map((it) => it.ink.l + (it.from || it.ink.w))) + 24),
    };

    const layer = div('bp');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--gx', (col ? ((col.l % MAJOR) + MAJOR) % MAJOR : 0) + 'px');
    layer.style.setProperty('--vw', vw + 'px');

    const steps = [];
    const counters = [];
    const on = (node, frames, t, d, easing = OUT) => {
      const s = { node, frames, t, d, easing };
      steps.push(s);
      return s;
    };
    const fadeIn = [{ opacity: 0 }, { opacity: 1 }];
    const fadeOut = [{ opacity: 1 }, { opacity: 0 }];
    const rise = [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }];
    const fromLeft = [{ clipPath: 'inset(-2px 100% -2px 0)' }, { clipPath: 'inset(-2px 0 -2px 0)' }];
    const fromTop = [{ clipPath: 'inset(0 -2px 100% -2px)' }, { clipPath: 'inset(0 -2px 0 -2px)' }];
    const fromMid = [{ clipPath: 'inset(-24px 50% -24px 50%)' }, { clipPath: 'inset(-24px 0 -24px 0)' }];

    // The sheet: grid, rulers, setting-out lines.
    on(div('bp-grid is-minor', layer), fadeIn, T.grid, 0.6, 'linear');
    on(div('bp-grid is-major', layer), fadeIn, T.grid + 0.1, 0.6, 'linear');
    on(div('bp-band is-top', layer), fromLeft, T.bands, 0.8);
    on(div('bp-band is-left', layer), fromTop, T.bands + 0.05, 0.8);
    on(div('bp-ticks is-top', layer), fromLeft, T.bands + 0.1, 0.8);
    on(div('bp-ticks is-left', layer), fromTop, T.bands + 0.15, 0.8);
    on(chip(layer, String(vw), null, null, 'is-quiet bp-ruler'), fadeIn, T.bands + 0.45, 0.3);

    const guides = [];
    if (col && col.l > 12) guides.push({ x: col.l });
    if (col && col.r < vw - 12) guides.push({ x: col.r });
    guides.push(...chromeGuides(vw, vh));
    guides.forEach((g, i) => {
      const t = T.guides + i * 0.08;
      if (g.x != null) {
        on(div('bp-gv', layer, { l: g.x }), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], t, 0.9);
      } else {
        const across = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
        on(div('bp-gh', layer, { t: g.y }), across, t, 0.9);
        on(div('bp-gh', layer, { t: g.y + 4 }), across, t + 0.1, 0.9);
      }
    });

    // Corner notes go wherever they clear the drawing.
    const taken = items.map((it) => grow(it.ink, 14));
    const fits = (r) => r.l >= 12 && r.l + r.w <= vw - 12 && r.t >= 12 && r.t + r.h <= vh - 8 && !taken.some((q) => hits(q, r));
    [opt.noteLeft ?? doc.title, opt.noteRight ?? today()].forEach((text, i) => {
      if (!text) return;
      const w = textWidth(text);
      const x = i ? vw - 28 - w : 28;
      const spot = [{ l: x, t: 22, w, h: 20 }, { l: x, t: vh - 42, w, h: 20 }].find(fits);
      if (!spot) return;
      taken.push(spot);
      const n = div('bp-note', layer, { l: spot.l, t: spot.t });
      n.textContent = text;
      on(n, fromLeft, T.notes + i * 0.2, 0.8, 'cubic-bezier(.45,0,.55,1)');
    });

    // Placeholders, in reading order within each kind.
    const gap = (n, span, most) => Math.min(most, n > 1 ? span / (n - 1) : 0);
    const texts = items.filter((it) => it.kind === 'text');
    const smalls = items.filter((it) => it.kind === 'small');
    const media = items.filter((it) => it.kind === 'media');
    smalls.forEach((it, i) => (it.at = T.small + i * gap(smalls.length, 0.5, 0.07)));
    texts.forEach((it, i) => (it.at = T.text + i * gap(texts.length, 0.7, 0.11)));
    media.forEach((it, i) => (it.at = T.media + i * gap(media.length, 0.45, 0.12)));

    let dims = 0;
    let measures = 0;
    for (const it of items) {
      const g = (it.group = div('bp-item', layer));
      const b = snap(it.kind === 'text' ? grow(it.ink, 2) : it.ink);
      const w0 = it.from ? it.from + 4 : b.w;
      const box = div('bp-box is-' + it.kind, g, { l: b.l, t: b.t, w: w0, h: b.h });
      on(box, fromLeft, it.at, it.kind === 'media' ? 0.7 : 0.5);

      if (it.kind !== 'small') {
        const sheen = div('bp-sheen', box);
        sheen.style.setProperty('--x0', Math.round(-1.35 * vw - b.l) + 'px');
        sheen.style.setProperty('--x1', Math.round(0.35 * vw - b.l) + 'px');
      }

      if (it.kind === 'media') {
        box.style.borderRadius = it.cs.borderRadius;
        const svg = doc.createElementNS(SVG, 'svg');
        svg.setAttribute('width', b.w);
        svg.setAttribute('height', b.h);
        const len = Math.hypot(b.w, b.h);
        [[0, 0, b.w, b.h], [0, b.h, b.w, 0]].forEach(([x1, y1, x2, y2], k) => {
          const ln = doc.createElementNS(SVG, 'line');
          Object.entries({ x1, y1, x2, y2 }).forEach(([a, v]) => ln.setAttribute(a, v));
          ln.style.strokeDasharray = String(len);
          svg.appendChild(ln);
          on(ln, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], it.at + 0.2 + k * 0.1, 0.8);
        });
        box.appendChild(svg);
      }

      // Tag: inside roomy boxes, above small ones, beside links stacked in a
      // column, below when the top is taken.
      const inside = it.kind !== 'small' && b.h >= 30;
      const above = b.t - 19 >= 16;
      const tw = chipWidth(it.label);
      const stacked = it.kind === 'small' && b.l - tw - 8 >= 16 && items.some((o) => o !== it && o.kind === 'small' &&
        o.ink.t < b.t && b.t - (o.ink.t + o.ink.h) < 28 && o.ink.l < b.l + b.w && b.l < o.ink.l + o.ink.w);
      const tag = stacked
        ? chip(g, it.label, b.l - tw - 8, Math.round(b.t + b.h / 2 - 8))
        : chip(g, it.label, b.l + (inside ? 4 : 0), inside ? b.t + 4 : above ? b.t - 19 : b.t + b.h + 3);
      on(tag, rise, it.at + 0.12, 0.3);

      if (it.kind !== 'text') continue;

      const heading = /^h[1-3]$/.test(it.node.localName);
      const clear = !items.some((o) => o !== it && hits(grow(o.ink, 2), { l: b.l, t: b.t + b.h + 1, w: w0, h: 24 }));
      if (heading && !it.from) {
        const label = `${Math.round(it.ink.w)} × ${Math.round(it.ink.h)}`;
        const sw = chipWidth(label);
        const size = b.l + b.w + 10 + sw <= vw - 12
          ? chip(g, label, b.l + b.w + 10, Math.round(b.t + b.h / 2 - 8), 'is-quiet')
          : chip(g, label, b.l + b.w - sw - 4, b.t + b.h - 20, 'is-quiet');
        on(size, rise, T.dims, 0.3);
        continue;
      }

      let dim = null;
      let dimChip = null;
      if (clear) {
        dim = div('bp-dim', g, { l: b.l, t: b.t + b.h + 6, w: w0 });
        rule(dim);
        dimChip = chip(dim, String(w0));
        on(dim, fromMid, T.dims + dims * 0.08, 0.5);
        on(dimChip, fadeIn, T.dims + dims * 0.08 + 0.2, 0.25);
        dims++;
      }

      if (it.from) {
        const t0 = T.measure + measures * gap(texts.filter((o) => o.from).length, 0.6, 0.16);
        const narrow = [{ width: w0 + 'px' }, { width: b.w + 'px' }];
        const step = on(box, narrow, t0, 0.8, IN_OUT);
        if (dim) on(dim, narrow, t0, 0.8, IN_OUT);
        const mid = Math.round(b.t + b.h / 2) - 4;
        const rest = div('bp-dim is-dashed', g, { l: b.l + b.w, t: mid, w: w0 - b.w });
        rule(rest);
        const restChip = chip(g, '0', Math.round(b.l + (b.w + w0) / 2), mid - 20, 'bp-mid');
        on(rest, [{ clipPath: 'inset(-4px 0 -4px 100%)' }, { clipPath: 'inset(-4px 0 -4px 0)' }], t0, 0.8, IN_OUT);
        on(restChip, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
          t0 + 0.4, Math.max(0.4, T.settle - t0), 'linear');
        on(rest, fadeOut, T.settle + measures * 0.05, 0.35, 'linear');
        counters.push({ step, from: w0, to: b.w, dim: dimChip, rest: restChip });
        measures++;
      }
    }

    // Spacing between stacked blocks that share a left edge.
    const stack = items.filter((it) => it.kind !== 'media');
    let rungs = 0;
    for (let i = 1; i < stack.length; i++) {
      const a = stack[i - 1].ink;
      const c = stack[i].ink;
      const top = a.t + a.h + 2;
      const space = c.t - 2 - top;
      if (Math.abs(a.l - c.l) > 12 || space < 10 || space > 240) continue;
      const v = div('bp-vdim', layer, { l: Math.round(Math.min(a.l, c.l) - 16), t: Math.round(top), h: Math.round(space) });
      rule(v);
      on(v, fromTop, T.dims + 0.15 + rungs * 0.06, 0.4);
      on(v, fadeOut, T.set + 0.1, 0.4, 'linear');
      rungs++;
    }

    // The real type, set in white over its placeholder.
    const type = div('bp-type', layer);
    stack.forEach((it, i) => {
      const t = T.set + i * gap(stack.length, 0.8, 0.09);
      const ghost = ghostOf(it);
      type.appendChild(ghost);
      on(it.group, fadeOut, t, 0.4, 'linear');
      on(ghost, [
        { opacity: 0, filter: 'blur(6px)', transform: 'translateY(4px)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
      ], t + 0.05, 0.7);
    });

    return { layer, steps, counters, vh };
  }

  // ---------- playing ----------

  function progress(a) {
    const p = a.effect.getComputedTiming().progress;
    return p == null ? (a.currentTime > 0 ? 1 : 0) : p;
  }

  function count(s) {
    for (const c of s.counters) {
      const p = progress(c.step.anim);
      if (c.dim) c.dim.textContent = Math.round(c.from + (c.to - c.from) * p);
      c.rest.textContent = Math.round((c.from - c.to) * p);
    }
  }

  function mount(paused) {
    unmount();
    root.classList.remove('bp-done');
    root.classList.add('bp-loading');
    const s = draw();
    s.paused = paused;
    root.appendChild(s.layer);
    for (const st of s.steps) {
      st.anim = st.node.animate(st.frames, { delay: ms(st.t), duration: ms(st.d), easing: st.easing, fill: 'both' });
      if (paused) st.anim.pause();
    }
    s.wipe = s.layer.animate(
      canWipe ? [{ '--bp-wipe': '-8px' }, { '--bp-wipe': s.vh + FEATHER + 'px' }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration: ms(T.wipeFor), easing: canWipe ? 'cubic-bezier(.55,0,.35,1)' : 'linear', fill: 'both' }
    );
    s.wipe.pause();
    sheet = s;
    listen(true);
    return s;
  }

  function unmount() {
    const s = sheet;
    if (!s) return;
    clearTimeout(s.timer);
    clearTimeout(s.guard);
    clearTimeout(s.safety);
    cancelAnimationFrame(s.raf);
    s.layer.remove();
    sheet = null;
    listen(false);
  }

  function reveal(s, now) {
    if (s.revealing) return;
    s.revealing = true;
    clearTimeout(s.timer);
    const go = () => {
      if (sheet !== s) return;
      root.classList.remove('bp-loading');
      s.layer.classList.add(canWipe ? 'is-wiping' : 'is-fading');
      emit('blueprint:reveal');
      s.wipe.play();
      s.wipe.finished.then(() => done(s), () => {});
      s.safety = setTimeout(() => done(s), ms(T.wipeFor) + 1500);
    };
    if (now) go();
    else loaded(6000).then(go);
  }

  function done(s) {
    if (sheet !== s) return;
    unmount();
    root.classList.remove('bp-loading');
    root.classList.add('bp-done');
    try { sessionStorage.setItem('bp-played', '1'); } catch (e) { /* storage blocked */ }
    emit('blueprint:done');
  }

  function fail(err) {
    unmount();
    root.classList.remove('bp-loading');
    console.error('[blueprint-load]', err);
  }

  let readyP = null;
  function ready() {
    return readyP || (readyP = new Promise((res) => {
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', res, { once: true });
      else res();
    }).then(() => {
      void doc.body.offsetHeight; // lay out, so web fonts start loading
      return Promise.race([doc.fonts ? doc.fonts.ready : wait(0), wait(1500)]);
    }));
  }

  function loaded(most) {
    return new Promise((res) => {
      if (doc.readyState === 'complete') return res();
      addEventListener('load', res, { once: true });
      setTimeout(res, most);
    });
  }

  function play() {
    return ready().then(() => {
      const s = mount(false);
      s.timer = setTimeout(() => reveal(s, false), ms(T.wipe));
      s.guard = setTimeout(() => done(s), ms(END) + 9000);
      const loop = () => {
        if (sheet !== s) return;
        count(s);
        s.raf = requestAnimationFrame(loop);
      };
      s.raf = requestAnimationFrame(loop);
    }).catch(fail);
  }

  function seek(t) {
    return ready().then(() => {
      const s = sheet && sheet.paused ? sheet : mount(true);
      s.t = Math.max(0, Math.min(END, +t || 0));
      for (const st of s.steps) st.anim.currentTime = ms(s.t);
      const wiping = s.t > T.wipe;
      root.classList.toggle('bp-loading', !wiping);
      s.layer.classList.toggle(canWipe ? 'is-wiping' : 'is-fading', wiping);
      s.wipe.currentTime = ms(Math.max(0, s.t - T.wipe));
      count(s);
    }).catch(fail);
  }

  function skip() {
    const s = sheet;
    if (!s || s.paused || s.revealing) return;
    for (const st of s.steps) st.anim.finish();
    count(s);
    reveal(s, true);
  }

  function time() {
    const s = sheet;
    if (!s) return END;
    if (s.paused) return s.t || 0;
    if (s.revealing) return T.wipe + ((s.wipe.currentTime || 0) * speed) / 1000;
    const a = s.steps[0] && s.steps[0].anim;
    return a ? Math.min(T.wipe, ((a.currentTime || 0) * speed) / 1000) : 0;
  }

  // While the sheet is up, the page holds still: scrolling or a key skips
  // to the wipe, and a paused sheet redraws itself on resize.
  const KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']);
  const held = () => sheet && !(sheet.paused && sheet.t >= END);
  function onScroll(e) {
    if (!held()) return;
    e.preventDefault();
    skip();
  }
  function onKey(e) {
    if (!held() || sheet.paused || !KEYS.has(e.key)) return;
    e.preventDefault();
    skip();
  }
  function onPoint(e) {
    if (sheet && sheet.layer.contains(e.target)) skip();
  }
  function onResize() {
    if (!sheet) return;
    if (sheet.paused) {
      const t = sheet.t;
      unmount();
      seek(t);
    } else skip();
  }
  function listen(yes) {
    const f = yes ? 'addEventListener' : 'removeEventListener';
    window[f]('wheel', onScroll, { passive: false });
    window[f]('touchmove', onScroll, { passive: false });
    window[f]('keydown', onKey, true);
    window[f]('pointerdown', onPoint, true);
    window[f]('resize', onResize);
  }

  // ---------- start ----------

  const style = doc.createElement('style');
  style.id = 'bp-style';
  style.textContent = RULES;
  (doc.head || root).appendChild(style);
  if (opt.blue) root.style.setProperty('--bp-blue', opt.blue);

  let seen = false;
  try { seen = 'once' in opt && sessionStorage.getItem('bp-played') === '1'; } catch (e) { /* storage blocked */ }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frozen = query != null && query !== 'off' && !isNaN(parseFloat(query));

  if (frozen) {
    root.classList.add('bp-loading');
    seek(parseFloat(query));
  } else if (!(still || seen || query === 'off' || 'manual' in opt)) {
    root.classList.add('bp-loading');
    play();
  }

  window.BlueprintLoad = { play, seek, skip, time, duration: END };
})();
