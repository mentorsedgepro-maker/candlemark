(() => {
if (typeof THREE === 'undefined') return;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, SM = innerWidth < 700;
const mouse = { x: 0, y: 0 }, tilt = window.__tilt = { x: 0, y: 0 };
const setM = (x, y) => { mouse.x = tilt.x = Math.max(-.5, Math.min(.5, x)); mouse.y = tilt.y = Math.max(-.5, Math.min(.5, y)); };
addEventListener('pointermove', e => setM(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5));
if (matchMedia('(hover:none)').matches && typeof DeviceOrientationEvent !== 'undefined') {
  const on = e => { if (e.gamma != null) setM(e.gamma / 60, (e.beta - 45) / 60); };
  addEventListener('touchend', () => {
    const D = DeviceOrientationEvent;
    D.requestPermission ? D.requestPermission().then(s => s === 'granted' && addEventListener('deviceorientation', on)).catch(() => {}) : addEventListener('deviceorientation', on);
  }, { once: true });
}
const B = 0x2272E6, L = 0x8FBDF5, D = 0x14378C;

function stage(id, z = 14, fov = 45) {
  const c = document.getElementById(id); if (!c) return null;
  const w = c.parentElement, s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 1, .1, 100);
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: !SM, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2.5));
  cam.position.z = z;
  s.add(new THREE.AmbientLight(0xCFE1FF, .8));
  const k = new THREE.PointLight(0xffffff, 1.4, 60); k.position.set(-6, 8, 10); s.add(k);
  const rim = new THREE.PointLight(0x7DB4FF, 1, 60); rim.position.set(8, -3, 6); s.add(rim);
  const st = { s, cam, c, on: true, fns: [], done: false, clock: new THREE.Clock() };
  const rs = () => { const W = w.clientWidth, H = w.clientHeight; r.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  rs(); addEventListener('resize', rs);
  new IntersectionObserver(([e]) => st.on = e.isIntersecting).observe(c);
  (function loop() {
    requestAnimationFrame(loop);
    if (!st.on || (RM && st.done)) return;
    st.done = true;
    const t = st.clock.getElapsedTime();
    st.fns.forEach(f => f(t)); r.render(s, cam);
  })();
  return st;
}
const mat = (c, o = .35) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: o });
const dot = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), new THREE.MeshBasicMaterial({ color: c }));
const live = { items: [], vol: 0 };
const $ = id => document.getElementById(id);

async function pull() {
  if (typeof API_BASE === 'undefined') return;
  try {
    const [m, mt] = await Promise.all([
      fetch(API_BASE + '/markets').then(r => r.json()),
      fetch(API_BASE + '/mentors').then(r => r.json())
    ]);
    live.items = Array.isArray(m?.items) ? m.items : [];
    live.vol = live.items.length ? live.items.reduce((a, i) => a + Math.abs(i.chg || 0), 0) / live.items.length : 0;
    const open = live.items.filter(i => !i.closed).length;
    if ($('rsM')) $('rsM').textContent = String(mt?.items?.length ?? '—');
    if ($('rsC')) $('rsC').textContent = String((mt?.items ?? []).reduce((a, x) => a + (+x.copiers || 0), 0).toLocaleString());
    if ($('rsI')) $('rsI').textContent = open + ' / ' + live.items.length;
    if ($('volRead')) $('volRead').textContent = `Live average move today: ${live.vol.toFixed(2)}% across ${live.items.length} instruments.`;
  } catch (err) {}
}
pull(); setInterval(pull, 5000);

/* 1 — MARKETS GLOBE */
(() => {
  const g = stage('mkCanvas', 13); if (!g) return;
  const grp = new THREE.Group(); g.s.add(grp);
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), mat(B, .14)));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(3.92, 32, 24), new THREE.MeshStandardMaterial({ color: 0xEEF5FF, transparent: true, opacity: .9, roughness: .6 })));
  const ll = (a, o) => new THREE.Vector3(4 * Math.cos(a) * Math.cos(o), 4 * Math.sin(a), 4 * Math.cos(a) * Math.sin(o));
  const N = [...Array(24)].map((_, i) => ll(Math.sin(i * 12.9) * .9, i * 2.4));
  N.forEach(p => { const d = dot(.07, B); d.position.copy(p); grp.add(d); });
  const pulses = [];
  for (let i = 0; i < N.length; i++) {
    const a = N[i], b = N[(i * 7 + 5) % N.length]; if (a === b) continue;
    const m = a.clone().add(b).normalize().multiplyScalar(4 + a.distanceTo(b) * .32);
    const c = new THREE.QuadraticBezierCurve3(a, m, b);
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(32)), new THREE.LineBasicMaterial({ color: B, transparent: true, opacity: .3 })));
    const p = dot(.06, D); grp.add(p); pulses.push([p, c, i * .17, .12 + (i % 4) * .03]);
  }
  grp.rotation.x = .35;
  g.fns.push(t => {
    grp.rotation.y = t * .12 + mouse.x * 1.2; grp.rotation.x = .35 + mouse.y * .5;
    pulses.forEach(([p, c, o, s]) => p.position.copy(c.getPoint((o + t * s) % 1)));
  });
})();

/* 2 — COPYTRADING NETWORK */
(() => {
  const g = stage('copyCanvas', 12); if (!g) return;
  const root = new THREE.Group(); g.s.add(root);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: B, emissive: B, emissiveIntensity: .15, roughness: .4 }));
  root.add(core, new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(L, .5)));
  [3.2, 4.1, 5].forEach((r, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - .01, r + .01, 96), new THREE.MeshBasicMaterial({ color: B, transparent: true, opacity: .15, side: 2 })); m.rotation.x = Math.PI / 2 + i * .08; root.add(m); });
  const F = [...Array(SM ? 10 : 16)].map((_, i) => {
    const m = dot(.2, i % 3 ? L : D), ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: B, transparent: true, opacity: .25 }));
    const p = dot(.07, B); root.add(m, ln, p);
    return { m, ln, p, r: 3.2 + (i % 3) * .9, o: i * 2.4, sp: .15 + (i % 4) * .04, y: Math.sin(i * 3) * 1.2 };
  });
  root.rotation.x = .4;
  g.fns.push(t => {
    core.rotation.y = t * .5; core.scale.setScalar(1 + Math.sin(t * 2) * .05);
    root.rotation.y = mouse.x * .8; root.rotation.x = .4 + mouse.y * .4;
    F.forEach((f, i) => {
      const a = f.o + t * f.sp;
      f.m.position.set(Math.cos(a) * f.r, f.y, Math.sin(a) * f.r);
      const pos = f.ln.geometry.attributes.position; pos.setXYZ(1, f.m.position.x, f.m.position.y, f.m.position.z); pos.needsUpdate = true;
      f.p.position.copy(f.m.position).multiplyScalar(((t * .5 + i * .13) % 1));
    });
  });
})();

/* 3 — PRICE SURFACE */
(() => {
  const g = stage('terrCanvas', 15, 50); if (!g) return;
  g.cam.position.set(0, 7, 15); g.cam.lookAt(0, 0, 0);
  const geo = new THREE.PlaneGeometry(36, 22, SM ? 56 : 70, SM ? 36 : 44); geo.rotateX(-Math.PI / 2);
  g.s.add(new THREE.Mesh(geo, mat(B, .35)), new THREE.Points(geo, new THREE.PointsMaterial({ color: D, size: .07 })));
  const pos = geo.attributes.position;
  g.fns.push(t => {
    const mx = mouse.x * 30, mz = mouse.y * 18;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x - mx, z - mz);
      const A = .6 + Math.min(live.vol, 3) * .5;
      pos.setY(i, A * (Math.sin(x * .4 + t) * .8 + Math.cos(z * .5 + t * .8) * .7 + Math.sin((x + z) * .2 + t * .5) * 1.1 + Math.exp(-d * .15) * Math.sin(d - t * 3) * .9));
    }
    pos.needsUpdate = true; g.cam.position.x = mouse.x * 3; g.cam.lookAt(0, 0, 0);
  });
})();

/* 5 — TOOLS */
(() => {
  if (SM) return; const g = stage('toolCanvas', 11); if (!g) return;
  const G = [new THREE.TorusKnotGeometry(.8, .25, 80, 12), new THREE.OctahedronGeometry(1.1), new THREE.CylinderGeometry(1, 1, .4, 32)];
  const S = G.map((geo, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: [B, L, D][i], roughness: .35, metalness: .2 }));
    const w = new THREE.Mesh(geo, mat(B, .35)); w.scale.setScalar(1.15); m.add(w);
    m.position.x = (i - 1) * 3.2; g.s.add(m); return m;
  });
  let act = -1;
  document.querySelectorAll('.tl-stack .tool-card').forEach((c, i) => { c.onmouseenter = () => act = i; c.onmouseleave = () => act = -1; c.ontouchstart = () => act = i; });
  g.fns.push(t => S.forEach((m, i) => {
    m.rotation.y = t * .5 + i; m.rotation.x = t * .15 * (i + 1) + mouse.y;
    m.position.y = Math.sin(t + i * 2) * .4;
    const s = act === i ? 1.35 : 1; m.scale.x += (s - m.scale.x) * .08; m.scale.y = m.scale.z = m.scale.x;
  }));
})();

/* 8 — LIVE HEATMAP */
(() => {
  const g = stage('heatCanvas', 16, 42); if (!g) return;
  g.cam.position.set(0, 9, 14); g.cam.lookAt(0, 0, 0);
  const grp = new THREE.Group(); g.s.add(grp);
  grp.add(new THREE.GridHelper(16, 16, 0xA9C8F2, 0xD3E3F8));
  let bars = [];
  const build = () => {
    bars.forEach(b => grp.remove(b));
    bars = live.items.map((it, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .5 }));
      m.position.set((i % 6 - 2.5) * 2.2, 0, (Math.floor(i / 6) - 1.5) * 2.2); m.scale.set(1.5, .01, 1.5); grp.add(m); return m;
    });
  };
  const info = $('heatInfo'), ray = new THREE.Raycaster(), v = new THREE.Vector2();
  g.c.addEventListener('pointermove', e => {
    const r = g.c.getBoundingClientRect(); v.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, g.cam); const h = ray.intersectObjects(bars)[0];
    if (h) { const it = live.items[bars.indexOf(h.object)]; info.textContent = `${it.sym}  ${Number(it.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}  ${it.chg >= 0 ? '▲' : '▼'} ${Math.abs(it.chg).toFixed(2)}%${it.closed ? ' · closed' : ''}`; }
  });
  g.c.addEventListener('pointerdown', e => g.c.dispatchEvent(new PointerEvent('pointermove', e)));
  g.fns.push(t => {
    if (bars.length !== live.items.length) build();
    bars.forEach((b, i) => {
      const it = live.items[i], h = .4 + Math.min(Math.abs(it.chg), 5) * .7;
      b.material.color.setHex(it.chg >= 0 ? B : 0xD92D43);
      b.scale.y += (h - b.scale.y) * .06; b.position.y = b.scale.y / 2;
    });
    grp.rotation.y = Math.sin(t * .2) * .2 + mouse.x * .6;
  });
})();

/* 9 — RISK LAB */
(() => {
  const g = stage('riskCanvas', 14); if (!g) return;
  const N = 90, W = 10, U = .4, grp = new THREE.Group(); g.s.add(grp);
  const arr = new Float32Array(N * 3), geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
  grp.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: D })));
  const mk = c => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .2, side: 2 })); grp.add(m); return m; };
  const tpP = mk(B), slP = mk(0xD92D43), mid = new THREE.Mesh(new THREE.BoxGeometry(W, .03, .03), new THREE.MeshBasicMaterial({ color: D })); grp.add(mid);
  const mark = dot(.18, B); grp.add(mark);
  const sl = $('slR'), tp = $('tpR'), out = $('riskInfo');
  const lv = () => ({ s: +sl.value * U, t: +tp.value * U });
  const lab = (extra = '') => { $('slV').textContent = sl.value; $('tpV').textContent = tp.value;
    out.innerHTML = `<span>Reward : risk <b>${(tp.value / sl.value).toFixed(2)} : 1</b></span><span>${extra}</span>`; };
  let path = [], k = 0, wait = 0;
  const gen = () => { let y = 0; path = [0]; for (let i = 1; i < N; i++) { y += (Math.random() - .5) * .55; path.push(y); } k = 0; wait = 0; mark.material.color.setHex(B); lab('Simulated path, for education'); };
  const place = () => { const { s, t } = lv(); tpP.scale.y = t; tpP.position.y = t / 2; slP.scale.y = s; slP.position.y = -s / 2; };
  sl.oninput = tp.oninput = () => { place(); lab('Simulated path, for education'); };
  place(); gen();
  g.fns.push(() => {
    const { s, t } = lv();
    if (wait) { if (--wait === 0) gen(); return; }
    k = Math.min(k + .6, N - 1); const n = Math.floor(k);
    for (let i = 0; i <= n; i++) arr.set([-W / 2 + W * i / (N - 1), path[i], 0], i * 3);
    geo.setDrawRange(0, n + 1); geo.attributes.position.needsUpdate = true;
    mark.position.set(-W / 2 + W * n / (N - 1), path[n], 0);
    const y = path[n];
    if (y >= t) { mark.material.color.setHex(B); lab('Take profit hit'); wait = 120; }
    else if (y <= -s) { mark.material.color.setHex(0xD92D43); lab('Stop loss hit'); wait = 120; }
    else if (n === N - 1) { lab('Neither level hit'); wait = 120; }
    grp.rotation.y = mouse.x * .5;
  });
})();
})();
