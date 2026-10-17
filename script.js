/* ============================================================
  MENTORSEDGEPRO — INTERACTIONS & THREE.JS SCENES
============================================================ */

/* ---------- Cursor glow ---------- */
const cursorGlow = document.getElementById('cursorGlow');
window.addEventListener('pointermove', (e)=>{
  cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
});

/* ---------- Nav scroll state ---------- */
const nav = document.getElementById('siteNav');
const onScrollNav = ()=>{
  if(window.scrollY > 20) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
};
window.addEventListener('scroll', onScrollNav, { passive:true });
onScrollNav();

/* ---------- Mobile menu (burger + backdrop + scroll lock) ---------- */
const burger = document.getElementById('navBurger');
const mobileMenu = document.getElementById('mobileMenu');
const menuBackdrop = document.getElementById('menuBackdrop');

function openMenu(){
  mobileMenu.classList.add('open');
  menuBackdrop.classList.add('show');
  burger.classList.add('active');
  burger.setAttribute('aria-expanded', 'true');
  document.body.classList.add('no-scroll');
}
function closeMenu(){
  mobileMenu.classList.remove('open');
  menuBackdrop.classList.remove('show');
  burger.classList.remove('active');
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('no-scroll');
}
burger.addEventListener('click', ()=>{
  mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
});
menuBackdrop.addEventListener('click', closeMenu);
mobileMenu.querySelectorAll('a').forEach(a=>{
  a.addEventListener('click', closeMenu);
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
});
// close on resize back to desktop
window.addEventListener('resize', ()=>{
  if(window.innerWidth > 920 && mobileMenu.classList.contains('open')) closeMenu();
});

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll('[data-reveal]');
const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold:0.15, rootMargin:'0px 0px -60px 0px' });
revealEls.forEach(el=> revealObserver.observe(el));

/* ---------- Animated counters ---------- */
function animateCount(el){
  const target = parseFloat(el.dataset.count);
  const decimals = el.dataset.decimal ? parseInt(el.dataset.decimal) : 0;
  const suffix = el.dataset.suffix || '';
  const isPipDisplay = el.closest('.hstat') && target === 0 && el.dataset.decimal;
  const displayTarget = isPipDisplay ? parseFloat(el.dataset.decimal) : target;
  const dur = 1600;
  const start = performance.now();

  function tick(now){
    const p = Math.min((now-start)/dur, 1);
    const eased = 1 - Math.pow(1-p, 3);
    const val = displayTarget * eased;
    el.textContent = (decimals>0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
    if(p < 1) requestAnimationFrame(tick);
    else el.textContent = (decimals>0 ? displayTarget.toFixed(decimals) : Math.round(displayTarget).toLocaleString()) + suffix;
  }
  requestAnimationFrame(tick);
}
const countEls = document.querySelectorAll('[data-count]');
const countObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      animateCount(entry.target);
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold:0.5 });
countEls.forEach(el=> countObserver.observe(el));

/* ---------- Zigzag trading-chart "How it works" scroll animation ---------- */
(function chartRoad(){
  const wrap = document.getElementById('chartRoad');
  const pathFill = document.getElementById('chartPathFill');
  if(!wrap || !pathFill) return;

  const steps = Array.from(wrap.querySelectorAll('.chart-step'));
  const nodes = Array.from(wrap.querySelectorAll('.chart-node'));
  let len = 0;

  function setup(){
    len = pathFill.getTotalLength();
    pathFill.style.strokeDasharray = len;
  }
  setup();

  let ticking = false;
  function update(){
    ticking = false;
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height + vh * 0.55;
    let progress = (vh * 0.82 - rect.top) / total;
    progress = Math.max(0, Math.min(1, progress));
    wrap.style.setProperty('--p', progress.toFixed(3));

    pathFill.style.strokeDashoffset = String(len * (1 - progress));

    steps.forEach((step, i)=>{
      const frac = parseFloat(step.dataset.frac);
      const active = progress > frac - 0.015;
      step.classList.toggle('in-view', active);
      if(nodes[i]) nodes[i].classList.toggle('lit', active);
    });
  }
  function onScroll(){
    if(!ticking){ requestAnimationFrame(update); ticking = true; }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', ()=>{ setup(); update(); });
  update();
})();

/* ---------- Account protection chart (falls, then caught by floor) ---------- */
(function safetyChart(){
  const chart = document.getElementById('safetyChart');
  const line = document.getElementById('safetyPriceFill');
  const impact = document.getElementById('safetyImpact');
  if(!chart || !line || !impact) return;

  const len = line.getTotalLength();
  line.style.strokeDasharray = len;
  line.style.strokeDashoffset = len;

  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        line.style.strokeDashoffset = '0';
        setTimeout(()=>{
          impact.classList.add('hit');
          line.classList.add('protected');
        }, 1500);
        obs.unobserve(chart);
      }
    });
  }, { threshold:0.5 });
  obs.observe(chart);
})();

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.faq-item').forEach(item=>{
  const q = item.querySelector('.faq-q');
  q.addEventListener('click', ()=>{
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i=> i.classList.remove('open'));
    if(!wasOpen) item.classList.add('open');
  });
});

/* ---------- Tilt cards (skip on touch devices) ---------- */
if(window.matchMedia('(hover: hover)').matches){
  document.querySelectorAll('[data-tilt]').forEach(card=>{
    let raf = null;
    card.addEventListener('mousemove', (e)=>{
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=>{
        card.style.transform = `perspective(700px) rotateX(${(-y*6).toFixed(2)}deg) rotateY(${(x*6).toFixed(2)}deg) translateY(-4px)`;
      });
    });
    card.addEventListener('mouseleave', ()=>{
      card.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateY(0)';
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll('.magnetic').forEach(btn=>{
    btn.addEventListener('mousemove', (e)=>{
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width/2;
      const y = e.clientY - rect.top - rect.height/2;
      btn.style.transform = `translate(${x*0.18}px, ${y*0.35}px)`;
    });
    btn.addEventListener('mouseleave', ()=>{
      btn.style.transform = 'translate(0,0)';
    });
  });
}

/* ---------- Live ticker tape ---------- */
const TICK = ['EUR/USD','GBP/USD','US500','XAU/USD','BTC/USD','ETH/USD','US30','USD/JPY','WTI','NAS100'];
const tickerTrack = document.getElementById('tickerTrack');
async function loadTicker(){
  try{
    const { items } = await (await fetch(API_BASE + '/markets')).json();
    const by = Object.fromEntries(items.map(i=>[i.sym,i]));
    const list = TICK.filter(s=>by[s]);
    if(!tickerTrack.children.length){
      const one = list.map(s=>`<div class="ticker-item"><strong>${s}</strong><span data-p="${s}"></span><span data-c="${s}"></span></div>`).join('');
      tickerTrack.innerHTML = one + one;
    }
    list.forEach(s=>{
      const i = by[s], up = i.chg >= 0;
      tickerTrack.querySelectorAll(`[data-p="${s}"]`).forEach(e=> e.closest('.ticker-item').classList.toggle('closed', !!i.closed));
      tickerTrack.querySelectorAll(`[data-p="${s}"]`).forEach(e=> e.textContent = Number(i.price).toLocaleString(undefined,{maximumFractionDigits:4}));
      tickerTrack.querySelectorAll(`[data-c="${s}"]`).forEach(e=>{ e.className = up ? 'up' : 'down'; e.textContent = `${up?'▲':'▼'} ${Math.abs(i.chg).toFixed(2)}%`; });
    });
  }catch{}
}
loadTicker(); setInterval(loadTicker, 5000);

/* ============================================================
   THREE.JS — HERO CANDLESTICK SCENE
============================================================ */
(function heroScene(){
  const canvas = document.getElementById('heroCanvas');
  if(!canvas || typeof THREE === 'undefined') return;

  const wrap = canvas.parentElement;
  let W = wrap.clientWidth, H = wrap.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xEEF5FF, 0.022);

  const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 200);
  camera.position.set(0, 7, 22);
  camera.lookAt(0,2,0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  let visible = true;
  new IntersectionObserver(([e])=> visible = e.isIntersecting).observe(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.setSize(W, H);

  // Lighting
  scene.add(new THREE.AmbientLight(0xCFE1FF, 0.55));
  const key = new THREE.PointLight(0xFFFFFF, 1.5, 60);
  key.position.set(-8, 12, 10);
  scene.add(key);
  const rim = new THREE.PointLight(0x7DB4FF, 0.9, 60);
  rim.position.set(10, 6, -6);
  scene.add(rim);

  // Candlestick bar generation
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = 26;
  const SPACING = 1.35;
  const bars = [];

  function seededRandom(seed){
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  for(let i=0;i<COUNT;i++){
    const bull = seededRandom(i*3.1) > 0.42;
    const bodyH = 1.2 + seededRandom(i*7.7) * 4.2;
    const wickH = bodyH + 0.8 + seededRandom(i*5.3) * 2.4;
    const color = bull ? 0x2A74E8 : 0x8FBDF5;

    const bodyGeo = new THREE.BoxGeometry(0.62, bodyH, 0.62);
    const bodyMat = new THREE.MeshStandardMaterial({
      color, emissive:color, emissiveIntensity:0.05, roughness:0.55, metalness:0.05
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set((i - COUNT/2) * SPACING, bodyH/2, 0);
    group.add(body);
    bars.push(body);

    const wickGeo = new THREE.CylinderGeometry(0.045, 0.045, wickH, 6);
    const wickMat = new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:0.05, transparent:true, opacity:0.6 });
    const wick = new THREE.Mesh(wickGeo, wickMat);
    wick.position.set((i - COUNT/2) * SPACING, wickH/2, 0);
    group.add(wick);
  }

  // Base grid plane (subtle)
  const gridHelper = new THREE.GridHelper(60, 30, 0xA9C8F2, 0xD3E3F8);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Floating particles (ambient depth)
  const particleCount = 140;
  const particlesGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){
    positions[i*3] = (Math.random()-0.5) * 50;
    positions[i*3+1] = Math.random() * 20;
    positions[i*3+2] = (Math.random()-0.5) * 40 - 5;
  }
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particlesMat = new THREE.PointsMaterial({ color:0x4F9BFF, size:0.11, transparent:true, opacity:0.55 });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  // Mouse parallax
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e)=>{
    mouseX = (e.clientX / window.innerWidth - 0.5);
    mouseY = (e.clientY / window.innerHeight - 0.5);
  });

  let scrollFrac = 0;
  window.addEventListener('scroll', ()=>{
    scrollFrac = Math.min(window.scrollY / window.innerHeight, 1.4);
  }, { passive:true });

  function resize(){
    W = wrap.clientWidth; H = wrap.clientHeight;
    camera.aspect = W/H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    if(!visible) return;
    const t = clock.getElapsedTime();
    if (window.__tilt) { mouseX = __tilt.x; mouseY = __tilt.y; }

    group.rotation.y = Math.sin(t*0.08) * 0.12 + mouseX * 0.35;
    group.position.y = -1.5 + mouseY * -0.6;
    camera.position.y = 7 + scrollFrac * 3;
    camera.position.z = (W / H < 1 ? 31 : 22) - scrollFrac * 5;
    camera.lookAt(0, 2 - scrollFrac*1.5, 0);

    bars.forEach((b, i)=>{
      b.position.y = (b.geometry.parameters.height/2) + Math.sin(t*0.6 + i*0.4) * 0.06;
    });

    particles.rotation.y = t * 0.01;

    renderer.render(scene, camera);
  }
  animate();
})();

/* ---------- Section slide-up on scroll ---------- */
(function sectionReveal(){
  const els = document.querySelectorAll('main > section:not(.hero), .ticker-tape, .footer');
  if(!('IntersectionObserver' in window)){ return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold:0, rootMargin:'0px 0px -12% 0px' });
  els.forEach(el=>{ el.classList.add('sec-reveal'); io.observe(el); });
})();

/* ============================================================
   THREE.JS — FINAL CTA AMBIENT SCENE (lightweight)
============================================================ */
(function ctaScene(){
  const canvas = document.getElementById('ctaCanvas');
  if(!canvas || typeof THREE === 'undefined') return;
  const wrap = canvas.parentElement;
  let W = wrap.clientWidth, H = wrap.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W/H, 0.1, 100);
  camera.position.set(0,0,14);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  let visible = true;
  new IntersectionObserver(([e])=> visible = e.isIntersecting).observe(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);

  scene.add(new THREE.AmbientLight(0xFFFFFF, 1.2));
  const p1 = new THREE.PointLight(0x4F9BFF, 2, 40);
  p1.position.set(-6,4,6); scene.add(p1);
  const p2 = new THREE.PointLight(0xFFFFFF, 1.2, 40);
  p2.position.set(6,-2,4); scene.add(p2);

  const geo = new THREE.IcosahedronGeometry(3.4, 1);
  const mat = new THREE.MeshStandardMaterial({ color:0x2272E6, emissive:0x2272E6, emissiveIntensity:0.1, wireframe:true, transparent:true, opacity:0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  function resize(){
    W = wrap.clientWidth; H = wrap.clientHeight;
    camera.aspect = W/H; camera.updateProjectionMatrix();
    renderer.setSize(W,H);
  }
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    if(!visible) return;
    const t = clock.getElapsedTime();
    mesh.rotation.y = t*0.15;
    mesh.rotation.x = t*0.08;
    renderer.render(scene, camera);
  }
  animate();
})();

/* section 3: fade in/out both directions */
(function(){
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('fade-out', !e.isIntersecting)), { threshold:.2 });
  document.querySelectorAll('.chart-step').forEach(s => io.observe(s));
})();

/* section 5 mobile: auto-scrolling cards */
(function(){
  const el = document.querySelector('.tl-stack');
  if(!el || !matchMedia('(max-width:700px)').matches) return;
  const cards = [...el.children]; let i = 0, hold = false, vis = false, t;
  new IntersectionObserver(([e]) => vis = e.isIntersecting, { threshold:.4 }).observe(el);
  setInterval(()=>{
    if(hold || !vis) return;
    i = (i + 1) % cards.length;
    el.scrollTo({ left: cards[i].offsetLeft - (el.clientWidth - cards[i].offsetWidth) / 2, behavior:'smooth' });
  }, 3000);
  el.addEventListener('touchstart', ()=>{ hold = true; clearTimeout(t); }, { passive:true });
  el.addEventListener('touchend', ()=>{ i = Math.round(el.scrollLeft / (cards[0].offsetWidth + 12)); t = setTimeout(()=> hold = false, 4000); });
})();