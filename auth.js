/* ============================================================
  MENTORSEDGEPRO — AUTH PAGE INTERACTIONS
============================================================ */

/* ---------- Ambient Three.js scene (left panel) ---------- */
(function authScene(){
  const canvas = document.getElementById('authCanvas');
  if(!canvas || typeof THREE === 'undefined' || innerWidth <= 980) return;
  const wrap = canvas.parentElement;
  let W = wrap.clientWidth, H = wrap.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xDCEBFF, 0.022);
  const camera = new THREE.PerspectiveCamera(50, W/H, 0.1, 100);
  camera.position.set(0, 2, 16);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);

  scene.add(new THREE.AmbientLight(0xCFE1FF, 0.6));
  const key = new THREE.PointLight(0xFFFFFF, 1.4, 40);
  key.position.set(-6, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(0x7DB4FF, 0.8, 40);
  rim.position.set(8, -2, 4); scene.add(rim);

  // Sparse candlestick silhouette drifting in background
  const group = new THREE.Group();
  scene.add(group);
  const COUNT = 14;
  for(let i=0;i<COUNT;i++){
    const seed = i*2.7;
    const bull = Math.sin(seed) > -0.15;
    const h = 1 + Math.abs(Math.sin(seed*1.7)) * 3.4;
    const color = bull ? 0x2A74E8 : 0x8FBDF5;
    const geo = new THREE.BoxGeometry(0.5, h, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:0.05, transparent:true, opacity:0.75 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((i - COUNT/2) * 1.1, h/2 - 3, -4 - (i%3)*1.5);
    group.add(mesh);
  }

  // floating particles
  const pCount = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(pCount*3);
  for(let i=0;i<pCount;i++){
    pos[i*3] = (Math.random()-0.5) * 24;
    pos[i*3+1] = (Math.random()-0.5) * 16;
    pos[i*3+2] = (Math.random()-0.5) * 20 - 4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pMat = new THREE.PointsMaterial({ color:0x4F9BFF, size:0.1, transparent:true, opacity:0.55 });
  const points = new THREE.Points(geo, pMat);
  scene.add(points);

  function resize(){
    W = wrap.clientWidth; H = wrap.clientHeight;
    camera.aspect = W/H; camera.updateProjectionMatrix();
    renderer.setSize(W,H);
  }
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  function animate(){
    const t = clock.getElapsedTime();
    group.rotation.y = Math.sin(t*0.06) * 0.15;
    group.position.y = Math.sin(t*0.2) * 0.15;
    points.rotation.y = t * 0.008;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ---------- Floating label fix for selects ---------- */
document.querySelectorAll('.field select').forEach(sel=>{
  const sync = ()=>{
    sel.closest('.field').classList.toggle('has-value', !!sel.value);
  };
  sel.addEventListener('change', sync);
  sync();
});

/* ---------- Password visibility toggle ---------- */
document.querySelectorAll('[data-toggle-pw]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const input = document.getElementById(btn.dataset.togglePw);
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    btn.innerHTML = isPw ? eyeOffIcon() : eyeIcon();
  });
});
function eyeIcon(){
  return `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9s2.8-5.5 8-5.5S17 9 17 9s-2.8 5.5-8 5.5S1 9 1 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2.3" stroke="currentColor" stroke-width="1.4"/></svg>`;
}
function eyeOffIcon(){
  return `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14M7.4 7.6a2.3 2.3 0 0 0 3.1 3.1M5.2 5.1C3 6.4 1.6 9 1.6 9S4.4 14.5 9.6 14.5c1.4 0 2.6-.4 3.6-1M14.6 12.3C15.9 11 16.4 9 16.4 9S13.6 3.5 8.4 3.5c-.6 0-1.2.07-1.7.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}
document.querySelectorAll('[data-toggle-pw]').forEach(btn=> btn.innerHTML = eyeIcon());

/* ---------- Password strength meter ---------- */
const pwInput = document.getElementById('regPassword');
if(pwInput){
  const bars = document.querySelectorAll('.pw-strength i');
  const label = document.querySelector('.pw-strength-label');
  const colors = ['#D92D43','#D92D43','#E0A030','#0A8A5F','#0A8A5F'];
  const labels = ['Very weak','Weak','Fair','Strong','Very strong'];

  pwInput.addEventListener('input', ()=>{
    const v = pwInput.value;
    let score = 0;
    if(v.length >= 8) score++;
    if(v.length >= 12) score++;
    if(/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if(/[0-9]/.test(v)) score++;
    if(/[^A-Za-z0-9]/.test(v)) score++;
    score = Math.min(score, 5);
    const filled = v.length === 0 ? 0 : Math.max(score,1);

    bars.forEach((bar,i)=>{
      bar.style.background = i < filled ? colors[Math.min(filled-1,4)] : 'var(--line)';
    });
    label.textContent = v.length === 0 ? 'Use 8+ characters with a mix of letters, numbers &amp; symbols' : labels[Math.min(filled-1,4)];
  });
}

/* ---------- Custom checkbox ---------- */
document.querySelectorAll('.checkbox').forEach(box=>{
  const input = box.querySelector('input');
  const sync = ()=> box.classList.toggle('checked', input.checked);
  input.addEventListener('change', sync);
  sync();
});

/* ---------- Field validation helpers ---------- */
function setInvalid(field, msg){
  field.classList.add('invalid');
  const err = field.querySelector('.field-error span');
  if(err && msg) err.textContent = msg;
}
function clearInvalid(field){
  field.classList.remove('invalid');
}
document.querySelectorAll('.field input').forEach(inp=>{
  inp.addEventListener('input', ()=> clearInvalid(inp.closest('.field')));
});

function openOtp(email, next){
  const box = document.getElementById('otpBox'), code = document.getElementById('otpCode');
  const err = document.getElementById('otpErr'), go = document.getElementById('otpGo');
  document.getElementById('otpEmail').textContent = email;
  code.value = ''; err.textContent = ''; box.classList.add('show'); code.focus();
  go.onclick = async ()=>{
    if(!/^\d{6}$/.test(code.value)){ err.textContent = 'Enter the 6-digit code'; return; }
    go.disabled = true;
    try{
      const r = await api('/auth/verify-email', { method:'POST', auth:false, body:{ email, code:code.value } });
      api.setToken(r.accessToken);
      location.href = next;
    }catch(e){
      err.textContent = e.data?.error === 'INVALID_CODE' ? 'Invalid or expired code' : 'Something went wrong, try again';
      go.disabled = false;
    }
  };
  document.getElementById('otpResend').onclick = async ()=>{
    await api('/auth/resend-otp', { method:'POST', auth:false, body:{ email } }).catch(()=>{});
    err.textContent = 'If the email is valid, a new code was sent (60s cooldown).';
  };
}

/* ---------- Login form ---------- */
const loginForm = document.getElementById('loginForm');
async function doLogin(email, password, totp){
  const btn = loginForm.querySelector('.btn-submit');
  const pwField = document.getElementById('loginPassword').closest('.field');
  btn.classList.add('loading'); btn.disabled = true;
  try{
    const r = await api('/auth/login', { method:'POST', auth:false, body:{ email, password, remember: document.getElementById('loginRemember').checked, ...(totp && { totp }) } });
    api.setToken(r.accessToken);
    document.getElementById('loginSuccess').classList.add('show');
    redirectTo('dashboard.html', 500);
  }catch(err){
    const c = err.data?.error;
    if(c === 'EMAIL_NOT_VERIFIED') openOtp(err.data.email, 'dashboard.html');
    else if(c === 'TOTP_REQUIRED' || c === 'INVALID_TOTP'){
      const t = prompt('Enter your 6-digit 2FA code');
      if(t){ btn.classList.remove('loading'); btn.disabled = false; return doLogin(email, password, t.trim()); }
    }
    else if(c === 'ACCOUNT_SUSPENDED') setInvalid(pwField, 'Account restricted. Contact support.');
    else if(c === 'INVALID_CREDENTIALS') setInvalid(pwField, 'Incorrect email or password');
    else if(err.status === 429) setInvalid(pwField, 'Too many attempts, wait a minute');
    else setInvalid(pwField, 'Server unreachable, try again');
  }finally{
    btn.classList.remove('loading'); btn.disabled = false;
  }
}
if(loginForm){
  loginForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    let valid = true;
    const email = document.getElementById('loginEmail');
    const pw = document.getElementById('loginPassword');
    if(!email.value.includes('@')){ setInvalid(email.closest('.field'), 'Enter a valid email address'); valid = false; }
    if(pw.value.length < 6){ setInvalid(pw.closest('.field'), 'Password must be at least 6 characters'); valid = false; }
    if(!valid) return;
    doLogin(email.value.trim().toLowerCase(), pw.value);
  });
}

/* ---------- Register form ---------- */
const registerForm = document.getElementById('registerForm');
if(registerForm){
  registerForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    let valid = true;
    const name = document.getElementById('regName');
    const email = document.getElementById('regEmail');
    const pw = document.getElementById('regPassword');
    const confirm = document.getElementById('regConfirm');
    const terms = document.getElementById('regTerms');

    if(name.value.trim().length < 2){ setInvalid(name.closest('.field'), 'Enter your full name'); valid = false; }
    if(!email.value.includes('@')){ setInvalid(email.closest('.field'), 'Enter a valid email address'); valid = false; }
    if(pw.value.length < 8){ setInvalid(pw.closest('.field'), 'Use at least 8 characters'); valid = false; }
    if(confirm.value !== pw.value || confirm.value === ''){ setInvalid(confirm.closest('.field'), 'Passwords do not match'); valid = false; }
    document.getElementById('termsError').style.display = terms.checked ? 'none' : 'block';
    if(!terms.checked) valid = false;
    if(!valid) return;

    const btn = registerForm.querySelector('.btn-submit');
    btn.classList.add('loading'); btn.disabled = true;
    const addr = email.value.trim().toLowerCase();
    try{
      await api('/auth/register', { method:'POST', auth:false, body:{
        name: name.value.trim(), email: addr, password: pw.value,
        country: document.getElementById('regCountry').value || undefined,
      }});
      openOtp(addr, 'kyc.html');
    }catch(err){
      const c = err.data?.error;
      if(c === 'EMAIL_TAKEN') setInvalid(email.closest('.field'), 'Email already registered. Log in instead.');
      else if(c === 'VALIDATION') setInvalid(pw.closest('.field'), 'Please check your details');
      else if(err.status === 429) setInvalid(email.closest('.field'), 'Too many attempts, wait a minute');
      else setInvalid(email.closest('.field'), 'Server unreachable, try again');
    }finally{
      btn.classList.remove('loading'); btn.disabled = false;
    }
  });
}

function redirectTo(url, delay = 1500){
  setTimeout(() => { window.location.href = url; }, delay);
}

/* ---------- Forgot password ---------- */
(function forgot(){
  const link = document.getElementById('forgotLink');
  if(!link) return;
  const box = document.getElementById('fpBox'), s1 = document.getElementById('fpStep1'), s2 = document.getElementById('fpStep2');
  const err = document.getElementById('fpErr'), go = document.getElementById('fpGo'), label = go.querySelector('span');
  let step = 1, email = '';
  const reset = ()=>{ step = 1; s1.style.display = ''; s2.style.display = 'none'; label.textContent = 'Send code'; err.textContent = ''; err.style.color = 'var(--bear)'; };
  link.addEventListener('click', (e)=>{ e.preventDefault(); reset(); document.getElementById('fpEmail').value = document.getElementById('loginEmail').value; box.classList.add('show'); });
  if(location.hash === '#forgot') link.click();
  document.getElementById('fpClose').onclick = ()=> box.classList.remove('show');
  go.onclick = async ()=>{
    err.style.color = 'var(--bear)'; err.textContent = ''; go.disabled = true;
    try{
      if(step === 1){
        email = document.getElementById('fpEmail').value.trim().toLowerCase();
        if(!email.includes('@')){ err.textContent = 'Enter a valid email'; return; }
        await api('/auth/forgot-password', { method:'POST', auth:false, body:{ email } });
        step = 2; s1.style.display = 'none'; s2.style.display = 'flex'; label.textContent = 'Reset password';
        err.style.color = 'var(--text-secondary)'; err.textContent = 'If the account exists, a code was sent.';
      } else {
        const code = document.getElementById('fpCode').value, password = document.getElementById('fpPw').value;
        if(!/^\d{6}$/.test(code)){ err.textContent = 'Enter the 6-digit code'; return; }
        if(password.length < 8){ err.textContent = 'Password must be at least 8 characters'; return; }
        await api('/auth/reset-password', { method:'POST', auth:false, body:{ email, code, password } });
        box.classList.remove('show');
        document.getElementById('loginPassword').value = '';
        const ok = document.getElementById('loginSuccess');
        ok.querySelector('span').textContent = 'Password updated. Log in with your new password.'; ok.classList.add('show');
      }
    }catch(e){
      err.textContent = e.data?.error === 'INVALID_CODE' ? 'Invalid or expired code' : e.status === 429 ? 'Too many attempts, wait a minute' : 'Something went wrong, try again';
    }finally{ go.disabled = false; }
  };
})();