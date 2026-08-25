/* Sir Henry's - motion layer
   Lenis inertial scroll, a WebGL lookbook gallery, scroll reveals and route transitions.
   Everything degrades: if WebGL or the libraries are missing, the CSS layout still stands. */

window.Motion = (() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasThree = () => typeof THREE !== 'undefined';

  /* ------------------------------------------------------------------ scroll */
  let lenis = null;
  function initScroll() {
    if (reduced || typeof Lenis === 'undefined') return null;
    lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      syncTouch: false,
      anchors: true,          // in-page anchors ease instead of jumping
      // Panels that scroll internally (cart drawer, mobile nav, size finder) must keep
      // native scrolling, otherwise Lenis swallows the gesture and moves the page behind.
      prevent: node => node.closest && !!node.closest('[data-lenis-prevent]')
    });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // drive the scroll-progress bar and header state off Lenis, not native scroll
    const bar = document.getElementById('progress');
    const hdr = document.querySelector('.hdr');
    lenis.on('scroll', ({ scroll, limit, velocity }) => {
      if (bar) bar.style.transform = `scaleX(${limit ? scroll / limit : 0})`;
      // Velocity-driven weight: cards settle a fraction behind the scroll, which is what
      // separates an inertial site from a static one. Kept small on purpose.
      const v = Math.max(-60, Math.min(60, velocity || 0));
      document.documentElement.style.setProperty('--vel', (v / 60).toFixed(3));
      if (hdr) {
        hdr.classList.toggle('shrunk', scroll > 80);
        // A white bar sitting on the cinematic black stage kills the effect, so let the
        // header invert while a dark section is passing behind it.
        const dark = [...document.querySelectorAll('.anat')].some(s => {
          const r = s.getBoundingClientRect();
          return r.top <= hdr.offsetHeight * 0.6 && r.bottom > hdr.offsetHeight * 0.6;
        });
        hdr.classList.toggle('on-dark', dark);
      }
    });
    return lenis;
  }
  const scrollTo = (t, o) => lenis ? lenis.scrollTo(t, o) : window.scrollTo({ top: 0 });
  const stopScroll = () => lenis && lenis.stop();
  const startScroll = () => lenis && lenis.start();

  /* ----------------------------------------------------------------- reveals */
  /* Reveal targets start at opacity 0, so "missed" means invisible forever. An
     IntersectionObserver drops entries during fast scrolling - and Lenis makes fast
     scrolling easy - so the sweep below is authoritative: every frame, anything whose top
     has crossed the viewport is revealed. Nothing can be skipped, and once an element is
     revealed it leaves the pending list, so the cost falls to zero. */
  let pending = [];
  function initReveals(root = document) {
    const targets = [...root.querySelectorAll('[data-reveal]:not(.in)')];
    if (reduced) { targets.forEach(e => e.classList.add('in')); return; }
    targets.forEach(e => { if (pending.indexOf(e) < 0) pending.push(e); });
    sweepReveals();
  }

  function sweepReveals() {
    if (!pending.length) return;
    const limit = innerHeight * 0.92;   // reveal a little before the element is fully in
    const still = [];
    for (const el of pending) {
      if (!el.isConnected) continue;                 // removed by a re-render
      const r = el.getBoundingClientRect();
      if (r.top < limit) {
        const d = parseFloat(el.dataset.reveal) || 0;
        if (d > 0) setTimeout(() => el.classList.add('in'), d * 1000);
        else el.classList.add('in');
      } else {
        still.push(el);
      }
    }
    pending = still;
  }

  /* auto-stagger: tag children of a container so they cascade in */
  function stagger(root = document) {
    root.querySelectorAll('[data-stagger]').forEach(box => {
      const step = parseFloat(box.dataset.stagger) || 0.07;
      [...box.children].forEach((c, i) => {
        if (c.hasAttribute('data-reveal')) return;
        c.setAttribute('data-reveal', (i * step).toFixed(2));
      });
    });
  }

  /* ---------------------------------------------------------------- parallax */
  let parallaxEls = [];
  function initParallax(root = document) {
    parallaxEls = [...root.querySelectorAll('[data-parallax]')];
  }
  function tickParallax() {
    const vh = innerHeight;
    parallaxEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const amt = parseFloat(el.dataset.parallax) || 0.12;
      const centre = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0,${(-centre * amt).toFixed(2)}px,0) scale(${1 + Math.abs(amt) * 0.5})`;
    });
    sweepReveals();          // authoritative: cannot miss an element the way an observer can
    requestAnimationFrame(tickParallax);
  }

  /* ------------------------------------------------------------- magnetic UI */
  function initMagnets(root = document) {
    if (reduced || matchMedia('(pointer: coarse)').matches) return;
    root.querySelectorAll('[data-magnet]').forEach(el => {
      if (el._magnet) return;
      el._magnet = true;
      const strength = parseFloat(el.dataset.magnet) || 0.28;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform =
          `translate(${(e.clientX - r.left - r.width / 2) * strength}px,${(e.clientY - r.top - r.height / 2) * strength}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* -------------------------------------------------------- WebGL lookbook   */
  /* The reference reel puts every figure in ONE shared white room: the focused garment is
     sharp and full-colour, its neighbours recede on a ground plane, shrinking and washing
     out toward the background until they are barely silhouettes. The plates are photographs
     on a near-white studio ground, so a luma key dissolves their edges and leaves the
     figure plus its baked floor shadow floating in the page. */
  const VERT = `
    uniform float uVel;
    varying vec2 vUv;
    varying float vDist;
    void main(){
      vUv = uv;
      vec3 p = position;
      float d = (modelMatrix * vec4(position, 1.0)).x;
      vDist = abs(d);
      // No geometry warp. Bending the plane on scroll velocity reads as sea-sickness on a
      // full-height rail, and a tailoring house should feel still, not elastic.
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D uTex;
    uniform sampler2D uTex2;   // the next angle of a turnaround, for the crossfade
    uniform float uMix;        // 0 = uTex, 1 = uTex2
    uniform float uVel;
    uniform float uPlaneAspect;
    uniform float uImageAspect;
    uniform float uHover;
    uniform float uFocus;      // 1 at the centre of the rail, 0 far away
    uniform vec3  uBg;         // page background, what distant figures dissolve into
    uniform float uReady;      // 0 until the texture has actually arrived
    varying vec2 vUv;

    // Eight photographed angles read as a slideshow if you cut between them. Mixing the
    // two either side of a fractional position turns the 45-degree step into a dissolve.
    vec4 plate(vec2 uv){
      return mix(texture2D(uTex, uv), texture2D(uTex2, uv), uMix);
    }

    vec2 coverUv(vec2 uv){
      vec2 s = uPlaneAspect > uImageAspect
        ? vec2(1.0, uImageAspect / uPlaneAspect)
        : vec2(uPlaneAspect / uImageAspect, 1.0);
      return (uv - 0.5) * s + 0.5;
    }

    void main(){
      vec2 uv = coverUv(vUv);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

      // Chromatic split kept far below the old value: a whisper on a fast flick, invisible
      // at rest. Anything stronger looks like a broken screen rather than motion blur.
      // Fringing should read as motion, never as a defect, so it is scaled by focus:
      // the garment you are looking at stays clean, only the passing ones smear.
      float shift = clamp(uVel * 0.0012, -0.0022, 0.0022) * (1.0 - uFocus * 0.75);
      vec4 mid = plate(uv);
      vec3 c;
      c.r = plate(uv + vec2(shift, 0.0)).r;
      c.g = mid.g;
      c.b = plate(uv - vec2(shift, 0.0)).b;

      // The plates arrive cut. There is nothing to key: the matte was computed once,
      // offline, by region growing from the border - which handles the ground's
      // gradient, the cast shadow and a light garment all at once, none of which a
      // per-pixel colour test at runtime ever managed together.
      float keep = mid.a;


      /* Whatever the key does not fully remove is pushed toward the page colour, in
         proportion to how nearly it was removed. A pixel the key was unsure about
         therefore arrives as the colour of the room rather than as a bright edge -
         so the residue is correct in whichever theme is on, which a fixed colour
         could never be. This is what actually kills the halo. */
      c = mix(uBg, c, smoothstep(0.0, 0.30, keep));

      // recede: distant figures desaturate and wash toward the page colour
      float g = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(g), c, mix(0.25, 1.0, uFocus));
      c = mix(uBg, c, mix(0.16, 1.0, uFocus));
      c *= mix(0.97, 1.03, uHover);

      /* No feather. It existed to hide the edges of a rectangle that a colour key
         could not fully remove; a cut plate has no rectangle, and eating 18% of the
         plane's width and the bottom fifth of it was cropping the shoes off the
         outfit - which is the whole point of a lookbook. */
      float a = keep * mix(0.35, 1.0, uFocus) * uReady;
      if (a < 0.01) discard;
      gl_FragColor = vec4(c, a);
    }`;

  /* Read the studio ground off the plate as a GRADIENT, not a colour.

     Measured across the real plates, the ground runs 15 to 30 levels darker at the
     floor than at the top, and every plate is different. One median gives a key
     that is right at one height and wrong everywhere else - which left a pale
     rectangle under every model.

     Two medians: the top band and the upper side margins for the top colour, the
     lower side margins and the floor for the bottom. Medians rather than means so
     one stray dark pixel of a shoe cannot drag either. Returns two normalised
     triples. */
  const groundCache = new Map();
  function sampleGround(img) {
    const src = img.currentSrc || img.src;
    if (groundCache.has(src)) return groundCache.get(src);
    try {
      const c = document.createElement('canvas');
      const W = 64, H = 64;
      c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;

      const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1] / 255; };
      const medianOf = idx => {
        const rs = [], gs = [], bs = [];
        idx.forEach(i => { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); });
        return [med(rs), med(gs), med(bs)];
      };

      const topIdx = [], botIdx = [];
      for (let x = 0; x < W; x++) {                       // the top two rows
        topIdx.push((0 * W + x) * 4); topIdx.push((1 * W + x) * 4);
      }
      for (let y = 0; y < H * 0.30; y++) {                // upper side margins
        topIdx.push((y * W) * 4); topIdx.push((y * W + W - 1) * 4);
      }
      for (let y = Math.floor(H * 0.72); y < H; y++) {    // lower side margins
        botIdx.push((y * W) * 4); botIdx.push((y * W + W - 1) * 4);
      }
      for (let x = 0; x < W; x++) {                       // and the floor itself
        botIdx.push(((H - 1) * W + x) * 4); botIdx.push(((H - 2) * W + x) * 4);
      }

      const out = { top: medianOf(topIdx), bot: medianOf(botIdx) };
      groundCache.set(src, out);
      return out;
    } catch (e) { return null; }   // tainted canvas (cross-origin): keep the default
  }

  /* Hand a sampled ground to a material. Separate from the loader callback because
     the callback can fire before the material exists (a cached texture loads
     synchronously) and after (a cold one does not), and both paths have to work. */
  function applyGround(mat, ground, aspect) {
    if (!mat) return;
    if (aspect) mat.uniforms.uImageAspect.value = aspect;
    mat.uniforms.uReady.value = 1;
  }

  const RAIL_TURN_SECONDS = 12;       // one revolution on the rail, at any frame count

  class Rail {
    constructor(canvas, items, opts = {}) {
      this.canvas = canvas;
      this.items = items;
      this.onPick = opts.onPick || (() => {});
      this.gap = opts.gap || 4.4;
      this.target = 0; this.current = 0; this.vel = 0;
      this.dragging = false; this.moved = 0;
      this.width = canvas.clientWidth; this.height = canvas.clientHeight;
      this._build();
      this._bind();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
    }

    _build() {
      // preserveDrawingBuffer lets the canvas be read back / exported for QA and press shots
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.setSize(this.width, this.height, false);
      this.scene = new THREE.Scene();

      const frustum = 10;
      const aspect = this.width / this.height;
      this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
      this.camera.position.z = 13;

      // Read the room's colour from the stylesheet rather than repeating it here.
      // The CSS paints the page behind the canvas and the shader dissolves distant
      // figures into the same value; two literals would drift the first time the
      // theme changed, and did.
      const bg = new THREE.Color(roomBg());
      const loader = new THREE.TextureLoader();
      const planeH = frustum * 0.78;
      this.meshes = this.items.map((it, i) => {
        const planeW = planeH * 0.75;                       // 3:4 portrait
        const geo = new THREE.PlaneGeometry(planeW, planeH, 26, 26);
        /* The onLoad callback used to reach forward to `mat`, which is declared with
           const twenty lines below it. A texture served from cache fires onLoad
           synchronously, and reaching a const before its initialiser is a
           ReferenceError - so on a warm reload the ground was never sampled and the
           key ran against its default for the whole session. Hold the result and
           apply it once the material exists. */
        let ground = null, aspect = null;
        const tex = loader.load(it.src, t => {
          t.minFilter = THREE.LinearFilter;
          t.generateMipmaps = false;
          aspect = t.image.width / t.image.height;
          ground = sampleGround(t.image);
          if (mat) applyGround(mat, ground, aspect);
        });
        tex.colorSpace = THREE.SRGBColorSpace || undefined;
        // A garment with a photographed turnaround carries all its angles into the room,
        // so it turns as it travels the rail instead of sliding past as a flat plate.
        // Only garments that actually have eight plates do this; the rest stay flat
        // rather than fake it.
        const spinTex = (it.spin || []).map(src => {
          const t = loader.load(src, tt => { tt.minFilter = THREE.LinearFilter; tt.generateMipmaps = false; });
          t.colorSpace = THREE.SRGBColorSpace || undefined;
          return t;
        });
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG, transparent: true,
          uniforms: {
            uTex: { value: tex }, uTex2: { value: tex }, uMix: { value: 0 },
            uVel: { value: 0 }, uFocus: { value: 1 },
            uPlaneAspect: { value: planeW / planeH },
            uImageAspect: { value: 0.75 },
            uHover: { value: 0 },
            uBg: { value: new THREE.Vector3(bg.r, bg.g, bg.b) },
            // uReady keeps a plate invisible until its texture lands, rather than
            // drawing an empty black frame at full opacity.
            uReady: { value: 0 }
          },
          depthWrite: false
        });
        // the texture may already have arrived while the material was being built
        if (ground || aspect) applyGround(mat, ground, aspect);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { index: i, item: it, spinTex, spinShown: -1, baseTex: tex };
        this.scene.add(mesh);
        return mesh;
      });
      this.span = this.meshes.length * this.gap;
    }

    _bind() {
      const c = this.canvas;
      this._onWheel = e => {
        // only hijack the wheel for horizontal intent or when hovering the rail
        this.target += e.deltaY * 0.0032 + e.deltaX * 0.0032;
        e.preventDefault();
      };
      c.addEventListener('wheel', this._onWheel, { passive: false });

      this._down = e => { this.dragging = true; this.startX = e.clientX; this.startT = this.target; this.moved = 0; c.setPointerCapture(e.pointerId); c.classList.add('grabbing'); };
      this._move = e => {
        const r = c.getBoundingClientRect();
        this.pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
        if (!this.dragging) return;
        const dx = e.clientX - this.startX;
        this.moved = Math.max(this.moved, Math.abs(dx));
        this.target = this.startT - dx * 0.012;
      };
      this._up = e => {
        if (this.dragging && this.moved < 6) this._pick();
        this.dragging = false; c.classList.remove('grabbing');
      };
      c.addEventListener('pointerdown', this._down);
      c.addEventListener('pointermove', this._move);
      c.addEventListener('pointerup', this._up);
      c.addEventListener('pointerleave', () => { this.dragging = false; this.pointer = null; });

      this._resize = () => {
        this.width = c.clientWidth; this.height = c.clientHeight;
        this.renderer.setSize(this.width, this.height, false);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
      };
      addEventListener('resize', this._resize);
    }

    _pick() {
      if (!this.pointer) return;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
      const hit = ray.intersectObjects(this.meshes)[0];
      if (hit) this.onPick(hit.object.userData.item);
    }

    _loop(now) {
      // Do not burn GPU on a rail nobody can see. On weaker hardware this section alone
      // can dominate the frame budget and drag the scroll-scrubbed video down with it.
      const vr = this.canvas.getBoundingClientRect();
      if (vr.bottom < -200 || vr.top > innerHeight + 200) {
        this._last = 0;
        this._raf = requestAnimationFrame(this._loop);
        return;
      }
      // Frame-rate independent easing: a fixed per-frame factor left the rail (and its
      // focus fade) mid-transition on slower frames, so the centred garment stayed washed out.
      const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
      this._last = now;
      // rate is per revolution, so a 24-frame subsample turns at the same speed as 72
      const spun = this.meshes.find(m => m.userData.spinTex && m.userData.spinTex.length);
      if (!reduced && spun) this._spin = (this._spin || 0) +
        (spun.userData.spinTex.length / RAIL_TURN_SECONDS) * dt;
      const k = 1 - Math.exp(-6.5 * dt);
      this.current += (this.target - this.current) * k;
      this.vel = this.target - this.current;

      let hovered = null;
      if (this.pointer && !this.dragging) {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
        const hit = ray.intersectObjects(this.meshes)[0];
        hovered = hit ? hit.object : null;
      }
      this.canvas.style.cursor = hovered ? 'pointer' : (this.dragging ? 'grabbing' : 'grab');

      this.meshes.forEach(m => {
        const i = m.userData.index;
        // wrap into an endless row
        let x = i * this.gap - this.current * this.gap;
        x = ((x + this.span * 1.5) % this.span + this.span) % this.span - this.span * 0.5;

        // push neighbours back along a ground plane so they shrink toward a vanishing
        // point and settle slightly higher in frame, exactly as the reference does
        const d = Math.abs(x);
        const z = -d * 1.15;
        m.position.set(x, d * 0.085, z);

        const focus = 1 - Math.min(d / 7.5, 1);            // 1 centred, 0 far out
        const u = m.material.uniforms;
        const kf = 1 - Math.exp(-14 * dt);
        u.uFocus.value += (focus - u.uFocus.value) * kf;
        u.uVel.value = this.vel * 6.0;
        const h = m === hovered ? 1 : 0;
        u.uHover.value += (h - u.uHover.value) * kf;

        // The reference film has the garment turning in place on its own, continuously -
        // nobody drags it. So the angle comes off a shared clock, not off the rail
        // position, and adjacent angles are crossfaded by the fraction between them.
        const st = m.userData.spinTex;
        if (st && st.length) {
          const NA = st.length;
          const wrapped = ((this._spin % NA) + NA) % NA;
          const i0 = Math.floor(wrapped), i1 = (i0 + 1) % NA;
          u.uTex.value = st[i0];
          u.uTex2.value = st[i1];
          u.uMix.value = wrapped - i0;
          m.userData.spinShown = (wrapped - i0) < 0.5 ? i0 : i1;
        }

        const s = (0.82 + focus * 0.18) * (1 + u.uHover.value * 0.04);
        m.scale.set(s, s, 1);
        m.renderOrder = Math.round(1000 - d * 10);          // near draws over far
      });
      // draw far-to-near so the alpha blending stacks correctly
      this.scene.children.sort((a, b) => a.position.z - b.position.z);

      // report whichever garment is currently centred so the caption can follow it
      const centred = this.meshes.reduce((a, b) => Math.abs(a.position.x) < Math.abs(b.position.x) ? a : b);
      if (centred !== this._centred) {
        this._centred = centred;
        if (this.onFocusChange) this.onFocusChange(centred.userData.item);
      }

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(this._loop);
    }

    destroy() {
      cancelAnimationFrame(this._raf);
      removeEventListener('resize', this._resize);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.meshes.forEach(m => {
        m.geometry.dispose();
        // uTex may be pointing at any of the turnaround angles, so dispose by handle
        if (m.userData.baseTex) m.userData.baseTex.dispose();
        (m.userData.spinTex || []).forEach(t => t.dispose());
        if (!m.userData.baseTex) m.material.uniforms.uTex.value.dispose();
        m.material.dispose();
      });
      this.renderer.dispose();
    }
  }

  let rail = null;
  // --room-bg lives in site.css and flips with the theme.
  function roomBg() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--room-bg').trim();
    return v || '#f2f0ec';
  }

  /* Called when the theme changes. The room is a live WebGL scene, so it cannot be
     re-read from CSS by a repaint the way everything else on the page is - the
     dissolve colour is a uniform and has to be handed over. */
  function retheme() {
    if (!rail || !rail.meshes) return;
    const c = new THREE.Color(roomBg());
    rail.meshes.forEach(m => {
      const u = m.material && m.material.uniforms;
      if (u && u.uBg) u.uBg.value.set(c.r, c.g, c.b);
    });
  }

  function mountRail(canvas, items, onPick) {
    unmountRail();
    if (!canvas || !hasThree() || reduced) return null;
    try { rail = new Rail(canvas, items, { onPick }); }
    catch (e) { console.warn('WebGL rail unavailable:', e.message); rail = null; }
    return rail;
  }
  function unmountRail() { if (rail) { rail.destroy(); rail = null; } }

  /* --------------------------------------------- the anatomy dressing sequence
     A pinned stage where each scroll step lays one more garment onto the same
     centred figure: body -> shirt -> waistcoat -> open jacket -> finished suit.
     Copy alternates left/right and crossfades with the layer. */
  let anatRaf = null;
  function mountAnatomy(section) {
    unmountAnatomy();
    if (!section) return;
    const stage = section.querySelector('.anat-stage');
    // the camera transforms this inner layer; .anat-stage clips it to the panel
    const cam = stage ? (stage.querySelector('.anat-cam') || stage) : null;
    const frames = stage ? [...stage.querySelectorAll('.anat-f')] : [];
    const steps = [...section.querySelectorAll('.anat-step')];
    const bar = section.querySelector('.anat-rule i');
    const count = section.querySelector('.anat-count');
    const cue = section.querySelector('.anat-cue');
    const n = steps.length;
    if (!n || !frames.length) return;

    // An image sequence rather than a scrubbed <video>: no codec, no seeking, no blob URLs,
    // nothing that can stall. Every frame is a plain <img>, so if it renders at all it moves.
    const N = frames.length;
    let curr = 0, shownFrame = -1, shownStep = -1, last = 0;
    // Camera: each step names a focal point and a zoom, so the frame pushes in on the
    // garment being described and pulls back for the finished suit. Interpolated between
    // steps rather than snapped, so the move reads as a slow dolly, not a cut.
    const CAM = window.__ANAT_CAM || [];
    let camX = 50, camY = 50, camZ = 1;

    // decode the frames up front so scrubbing never waits on a fetch

    frames.forEach(f => { if (f.decode) f.decode().catch(() => {}); });

    const tick = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const r = section.getBoundingClientRect();
      const total = section.offsetHeight - innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / (total || 1)));

      // ease toward the scroll position so a flick does not strobe through 48 frames
      curr += (p - curr) * (reduced ? 1 : (1 - Math.exp(-11 * dt)));
      const fi = Math.max(0, Math.min(N - 1, Math.round(curr * (N - 1))));
      if (fi !== shownFrame) {
        if (shownFrame >= 0) frames[shownFrame].classList.remove('on');
        frames[fi].classList.add('on');
        shownFrame = fi;
      }

      const at = window.__ANAT_AT;
      let idx = 0;
      if (at && at.length === n) {
        for (let i = n - 1; i >= 0; i--) { if (p >= at[i]) { idx = i; break; } }
      } else {
        idx = Math.min(n - 1, Math.floor(p * n * 0.999));
      }

      // glide the camera between this step's framing and the next one's
      if (CAM.length === n) {
        const a = CAM[idx] || [50, 50, 1];
        const b = CAM[Math.min(n - 1, idx + 1)] || a;
        const from = at ? at[idx] : idx / n;
        const to = at ? (at[Math.min(n - 1, idx + 1)] ?? 1) : (idx + 1) / n;
        let t = to > from ? (p - from) / (to - from) : 0;
        t = Math.max(0, Math.min(1, t));
        t = t * t * (3 - 2 * t);                       // smoothstep
        const tx = a[0] + (b[0] - a[0]) * t;
        const ty = a[1] + (b[1] - a[1]) * t;
        const tz = a[2] + (b[2] - a[2]) * t;
        const k = 1 - Math.exp(-5 * dt);
        camX += (tx - camX) * k; camY += (ty - camY) * k; camZ += (tz - camZ) * k;
        cam.style.transformOrigin = camX.toFixed(2) + '% ' + camY.toFixed(2) + '%';
        cam.style.transform = 'scale(' + camZ.toFixed(4) + ')';
      }
      if (idx !== shownStep) {
        shownStep = idx;
        steps.forEach((st, i) => st.classList.toggle('on', i === idx));
        if (count) count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      }
      if (bar) bar.style.transform = `scaleX(${p})`;
      if (cue) cue.classList.toggle('gone', p > 0.06);
      anatRaf = requestAnimationFrame(tick);
    };
    anatRaf = requestAnimationFrame(tick);
  }

  function unmountAnatomy() {
    if (anatRaf) { cancelAnimationFrame(anatRaf); anatRaf = null; }
  }

  /* ---------------------------------------------------------- 360 spinner
     A frame sequence of the garment turning on the spot, played on a loop. It idles at
     one revolution every fourteen seconds - slow enough to read as display rather than
     animation - and hands control over the moment you touch it, resuming a few seconds
     after you let go. The frames come from an eight-second video of the man turning
     once, sampled to 72: the fix for "it doesn't look like it's spinning" was never in
     this code, it was having enough frames.
     Same frame-swap engine as the dressing sequence, so nothing depends on video seeking. */
  let spinners = [];
  const SPIN_TURN_SECONDS = 14;     // one full revolution, whatever the frame count
  const SPIN_RESUME_MS = 2600;      // how long a drag suppresses the idle turn

  function mountSpinners(root = document) {
    unmountSpinners();
    root.querySelectorAll('[data-spin]').forEach(box => {
      const frames = [...box.querySelectorAll('.spin-f')];
      if (frames.length < 2) return;
      const N = frames.length;
      const label = box.querySelector('[data-spin-deg]');
      let pos = 0, target = 0, raf = null, last = 0;
      let dragging = false, startX = 0, startT = 0, moved = 0;
      let idleAt = 0, visible = true, shown = -1;

      frames.forEach(f => { if (f.decode) f.decode().catch(() => {}); });

      // show exactly one frame - no blending, because there is nothing left to blend
      // across. The old crossfade existed to hide the 45-degree step between eight
      // stills and could not: dissolving two poses that far apart shows two overlapping
      // people, which is what made it unreadable. Five degrees apart, there is no step.
      const render = () => {
        const i = ((Math.round(pos) % N) + N) % N;
        if (i === shown) return;
        if (shown >= 0) { frames[shown].style.opacity = 0; frames[shown].classList.remove('on'); }
        frames[i].style.opacity = 1;
        frames[i].classList.add('on');
        shown = i;
        if (label) label.textContent = Math.round(i * (360 / N)) + '°';
      };

      const loop = (now) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        if (!dragging && !reduced && now > idleAt) target += (N / SPIN_TURN_SECONDS) * dt;
        // ease toward the target so a flick glides instead of snapping
        pos += (target - pos) * (1 - Math.exp(-9 * dt));
        render();
        raf = visible ? requestAnimationFrame(loop) : (raf = null);
      };
      const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(loop); } };

      // a turntable nobody is looking at is pure wasted battery
      const io = 'IntersectionObserver' in window && new IntersectionObserver(es => {
        visible = es[0].isIntersecting;
        if (visible) run(); else if (raf) { cancelAnimationFrame(raf); raf = null; }
      }, { rootMargin: '120px' });
      if (io) io.observe(box); else visible = true;

      const down = e => {
        dragging = true; moved = 0;
        startX = (e.touches ? e.touches[0].clientX : e.clientX);
        startT = target;
        box.classList.add('grabbing');
        if (e.pointerId != null && box.setPointerCapture) box.setPointerCapture(e.pointerId);
        run();
      };
      const move = e => {
        if (!dragging) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        const dx = x - startX;
        moved = Math.max(moved, Math.abs(dx));
        // a full drag across the box turns the garment right round
        target = startT + (dx / box.clientWidth) * N * 1.1;   // ~one turn per box width
        if (e.cancelable) e.preventDefault();
      };
      const up = () => {
        if (!dragging) return;
        dragging = false;
        box.classList.remove('grabbing');
        if (moved > 6) box.classList.add('spun');
        idleAt = performance.now() + SPIN_RESUME_MS;
        run();
      };

      box.addEventListener('pointerdown', down);
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerup', up);
      box.addEventListener('pointerleave', up);
      box.addEventListener('touchstart', down, { passive: true });
      box.addEventListener('touchmove', move, { passive: false });
      box.addEventListener('touchend', up);

      // keyboard, so it is not mouse-only
      box.tabIndex = 0;
      box.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        target += e.key === 'ArrowRight' ? 1 : -1;
        idleAt = performance.now() + SPIN_RESUME_MS;
        box.classList.add('spun');
        run(); e.preventDefault();
      });

      render(); run();

      spinners.push({ box, destroy() {
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect();
        box.removeEventListener('pointerdown', down);
        box.removeEventListener('pointermove', move);
        box.removeEventListener('pointerup', up);
      } });
    });
  }
  function unmountSpinners() { spinners.forEach(s => s.destroy()); spinners = []; }

  /* ------------------------------------------------------- route transitions */
  function transition(run) {
    const veil = document.getElementById('veil');
    if (reduced || !veil) { run(); return; }
    veil.classList.add('on');
    setTimeout(() => {
      run();
      requestAnimationFrame(() => {
        scrollTo(0, { immediate: true });
        setTimeout(() => veil.classList.remove('on'), 60);
      });
    }, 340);
  }

  /* ---------------------------------------------------------------- refresh  */
  function refresh(root = document) {
    stagger(root);
    initReveals(root);
    initParallax(root);
    initMagnets(root);
    if (lenis) lenis.resize();
  }

  function boot() {
    // marks that the motion layer is alive; the stylesheet keeps [data-reveal] content
    // fully visible until this lands, so a JS failure can never blank the page
    document.documentElement.classList.add('js');
    initScroll();
    requestAnimationFrame(tickParallax);
    refresh();
  }

  return { boot, refresh, mountRail, unmountRail, rail: () => rail, retheme,
           // ux.js reads the live scroll position from here: Lenis owns the scroll on
           // this site, so window.scrollY is stale by up to a frame and a half.
           lenis: () => lenis,
           mountAnatomy, unmountAnatomy,
           mountSpinners, unmountSpinners,
           transition, scrollTo, stopScroll, startScroll, reduced };
})();
