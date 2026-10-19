(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const usd = (c) => (Number(c) / 100).toLocaleString('en-US', { style:'currency', currency:'USD' });
  const view = $('#view');
  new MutationObserver(() => view.querySelectorAll('table').forEach((t) => {
    const h = [...t.querySelectorAll('th')].map((x) => x.textContent);
    t.querySelectorAll('tbody tr').forEach((r) => [...r.children].forEach((c, i) => { if (h[i] && !c.dataset.label) c.dataset.label = h[i]; }));
  })).observe(view, { childList: true, subtree: true });
  const msg = (t) => { const m = $('#msg'); m.textContent = t; m.style.display = 'block'; setTimeout(() => m.style.display = 'none', 4000); };
  const ERR = { STEP_UP_REQUIRED:'Wrong or missing 2FA code.', ADMIN_2FA_REQUIRED:'Enable 2FA in the Security tab first.', FORBIDDEN:'Not an admin.',
    NOT_PENDING:'Already reviewed.', HANDLE_TAKEN:'Handle taken.', MENTOR_EXISTS:'Already a mentor / handle used.', USER_NOT_FOUND:'No user with that email.',
    CANNOT_MODIFY_ADMIN:'Cannot change admins.', VALIDATION:'Invalid input.' };

  // totp=true prompts for a fresh 2FA code (needed for money/address actions)
  async function A(path, { totp, headers = {}, ...o } = {}) {
    if (totp) { const c = prompt('2FA code (6 digits). Leave blank if 2FA is not enabled yet.'); if (c === null) throw new Error('CANCEL'); if (c) headers['x-totp'] = c.trim(); }
    return api('/admin' + path, { ...o, headers });
  }
  const run = async (fn) => { try { await fn(); } catch (e) { if (e.message !== 'CANCEL') msg(ERR[e.data?.error] || e.data?.error || 'Failed'); if (e.data?.error === 'ADMIN_2FA_REQUIRED') show('security'); } };
  const table = (heads, rows) => `<div class="card"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" style="color:var(--text-tertiary)">Nothing here.</td></tr>`}</tbody></table></div>`;

  const TABS = {
    overview: async () => {
      const s = await A('/stats');
      view.innerHTML = `<div class="g">${[['Users', s.users], ['Pending KYC', s.pendingKyc], ['Pending deposits', s.pendingDeposits], ['Pending withdrawals', s.pendingWithdrawals], ['Total balances', usd(s.totalBalance)]]
        .map(([k, v]) => `<div class="card"><div style="color:var(--text-tertiary);font-size:12px">${k}</div><div style="font:600 1.5rem var(--font-mono)">${esc(v)}</div></div>`).join('')}</div>`;
    },

    users: async (q = '') => {
      const { items } = await A('/users?limit=100' + (q ? '&q=' + encodeURIComponent(q) : ''));
      view.innerHTML = `<div class="card"><input id="uq" placeholder="Search name or email, press Enter" value="${esc(q)}"></div>` +
        table(['Email', 'Name', 'Role', 'Status', 'KYC', 'Balance', 'Actions'], items.map(u => `<tr>
          <td>${esc(u.email)}</td><td>${esc(u.name)}</td><td>${u.role}</td><td>${u.status}</td><td>${u.kyc}</td><td>${usd(u.balance)}</td>
          <td>${u.role === 'ADMIN' ? '' : `${['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].filter(x => x !== u.status).map(x => `<button class="b ${x === 'ACTIVE' ? '' : 'r'}" data-st="${x}" data-id="${u.id}">${x[0] + x.slice(1).toLowerCase()}</button>`).join('')}`}
          <button class="b" data-adj="${u.id}">Adjust</button></td></tr>`));
      $('#uq').onkeydown = (e) => { if (e.key === 'Enter') run(() => TABS.users(e.target.value.trim())); };
      view.onclick = (e) => run(async () => {
        const st = e.target.closest('[data-st]'), adj = e.target.closest('[data-adj]');
        if (st) {
          const reason = prompt(`Reason for ${st.dataset.st}?`); if (!reason) return;
          await A(`/users/${st.dataset.id}/status`, { method:'POST', body:{ status: st.dataset.st, reason } }); msg('Updated'); TABS.users(q);
        } else if (adj) {
          const dir = (prompt('CREDIT or DEBIT?') || '').toUpperCase(); if (!['CREDIT', 'DEBIT'].includes(dir)) return;
          const amount = prompt('Amount in USD (e.g. 50.00)'); if (!amount) return;
          const reason = prompt('Reason?'); if (!reason) return;
          await A(`/users/${adj.dataset.adj}/adjust`, { method:'POST', totp:true, headers:{ 'Idempotency-Key': api.key() }, body:{ direction: dir, amount, reason } }); msg('Balance adjusted'); TABS.users(q);
        }
      });
    },

    kyc: async () => {
      const { items } = await A('/kyc?status=PENDING');
      view.innerHTML = table(['User', 'Photo', 'ID (front)', 'Submitted', 'Details', ''], items.map(k => `<tr><td>${esc(k.email)}<br><small>${esc(k.name)}</small></td>
        <td>${k.avatar ? `<a target="_blank" rel="noopener" href="${esc(k.avatar)}"><img src="${esc(k.avatar)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover"></a>` : '—'}</td>
        <td>${k.idUrl ? `<a target="_blank" rel="noopener" href="${esc(k.idUrl)}"><img src="${esc(k.idUrl)}" style="max-width:160px;border-radius:8px"></a>` : '—'}</td>
        <td>${new Date(k.submittedAt).toLocaleString()}</td>
        <td><details><summary>View</summary><pre>${esc(JSON.stringify(k.data, null, 2))}</pre></details></td>
        <td><button class="b" data-d="APPROVED" data-id="${k.userId}">Approve</button><button class="b r" data-d="REJECTED" data-id="${k.userId}">Reject</button></td></tr>`));
      view.onclick = (e) => run(async () => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        await A(`/kyc/${b.dataset.id}/review`, { method:'POST', body:{ decision: b.dataset.d } }); msg(b.dataset.d); TABS.kyc();
      });
    },

    deposits: async () => {
      const { items } = await A('/deposits?status=PENDING');
      view.innerHTML = table(['User', 'Method', 'Amount', 'Proof', 'Date', ''], items.map(d => `<tr><td>${esc(d.user.email)}</td><td>${esc(d.method)}</td><td>${usd(d.amount)}</td>
        <td>${d.proofUrl ? `<a class="link-muted" target="_blank" rel="noopener" href="${esc(d.proofUrl)}">Open</a>` : '—'}</td><td>${new Date(d.createdAt).toLocaleString()}</td>
        <td><button class="b" data-d="APPROVED" data-id="${d.id}">Approve</button><button class="b r" data-d="REJECTED" data-id="${d.id}">Reject</button></td></tr>`));
      view.onclick = (e) => run(async () => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        const note = b.dataset.d === 'REJECTED' ? prompt('Reason (shown to user)?') || undefined : undefined;
        await A(`/deposits/${b.dataset.id}/review`, { method:'POST', totp:true, body:{ decision: b.dataset.d, note } }); msg(b.dataset.d); TABS.deposits();
      });
    },

    withdrawals: async () => {
      const { items } = await A('/withdrawals?status=PENDING');
      view.innerHTML = table(['User', 'Network', 'Destination', 'Amount', 'Date', ''], items.map(w => `<tr><td>${esc(w.user.email)}</td><td>${esc(w.network)}</td><td style="font-family:var(--font-mono)">${esc(w.destination)}</td><td>${usd(w.amount)}</td><td>${new Date(w.createdAt).toLocaleString()}</td>
        <td><button class="b" data-d="APPROVED" data-id="${w.id}">Approve</button><button class="b r" data-d="REJECTED" data-id="${w.id}">Reject</button></td></tr>`));
      view.onclick = (e) => run(async () => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        const note = b.dataset.d === 'REJECTED' ? prompt('Reason?') || undefined : undefined;
        await A(`/withdrawals/${b.dataset.id}/review`, { method:'POST', totp:true, body:{ decision: b.dataset.d, note } }); msg(b.dataset.d); TABS.withdrawals();
      });
    },

    signals: async () => {
      const { items } = await api('/signals');
      view.innerHTML = `<form class="card"><h3>Post signal</h3><div class="g">
        <div><label>Symbol (e.g. EUR/USD)</label><input name="symbol" required></div>
        <div><label>Side</label><select name="side"><option>BUY</option><option>SELL</option></select></div>
        <div><label>Entry</label><input name="entry" required></div><div><label>Stop loss</label><input name="stopLoss" required></div>
        <div><label>Take profit</label><input name="takeProfit" required></div><div><label>Source / method</label><input name="source" required></div></div>
        <label>Rationale</label><textarea name="rationale" rows="2" required></textarea><button class="b" style="margin-top:12px">Publish</button></form>` +
        table(['Market', 'Side', 'Entry', 'SL', 'TP', 'Status', ''], items.map(x => `<tr><td>${esc(x.symbol)}</td><td>${x.side}</td><td>${esc(x.entry)}</td><td>${esc(x.stopLoss)}</td><td>${esc(x.takeProfit)}</td><td>${x.status}</td>
          <td>${x.status === 'OPEN' ? ['HIT_TP', 'HIT_SL', 'CLOSED'].map(k => `<button class="b" data-s="${k}" data-id="${x.id}">${k}</button>`).join('') : ''}</td></tr>`));
      view.onsubmit = (e) => { e.preventDefault(); run(async () => { await A('/signals', { method:'POST', body:Object.fromEntries(new FormData(e.target)) }); msg('Published'); TABS.signals(); }); };
      view.onclick = (e) => run(async () => { const b = e.target.closest('[data-s]'); if (!b) return; await A(`/signals/${b.dataset.id}/close`, { method:'POST', body:{ status:b.dataset.s } }); TABS.signals(); });
    },

    addresses: async () => {
      const { items } = await A('/deposit-addresses');
      const cur = Object.fromEntries(items.map(i => [i.method, i.details]));
      const F = { crypto:['btc', 'eth', 'usdtTrc20', 'sol', 'usdc'], wire:['holder', 'bank', 'accountNumber', 'routing', 'address'], sepa:['bank', 'iban', 'bic', 'address'] };
      view.innerHTML = Object.entries(F).map(([m, fs]) => `<form class="card" data-m="${m}"><h3>${m.toUpperCase()}</h3><div class="g">${fs.map(f => `<div><label>${f}</label><input name="${f}" value="${esc(cur[m]?.[f])}" required></div>`).join('')}</div><button class="b" style="margin-top:12px">Save ${m}</button></form>`).join('');
      view.onclick = null;
      view.onsubmit = (e) => { e.preventDefault(); run(async () => {
        await A(`/deposit-addresses/${e.target.dataset.m}`, { method:'PUT', totp:true, body:Object.fromEntries(new FormData(e.target)) }); msg('Saved (audit-logged)');
      }); };
    },

    mentors: async () => {
      const { items } = await A('/mentors');
      view.innerHTML = `<form class="card" id="mf"><h3 id="mt">Create mentor</h3><div class="g">
        <div id="memw"><label>Mentor email (account is created if it doesn’t exist)</label><input name="email" type="email"></div>
        <div><label>Handle (a-z 0-9 _)</label><input name="handle" required></div><div><label>Display name</label><input name="displayName" required></div><div><label>Tag</label><input name="tag"></div>
        <div><label>Risk (1-10)</label><input name="riskScore" type="number" min="1" max="10"></div><div><label>Monthly fee (USD)</label><input name="fee" placeholder="10"></div>
        <div><label>Gain %</label><input name="gain" type="number"></div><div><label>Win rate %</label><input name="winRate" type="number"></div><div><label>Trades</label><input name="trades" type="number"></div>
        <div><label>Capital $</label><input name="capital" type="number"></div><div><label>Copiers shown</label><input name="copiers" type="number"></div><div><label>Tier (1-5)</label><input name="tier" type="number" min="1" max="5"></div><div><label>Avg trade time</label><input name="avgTime"></div>
        <div><label>Verified (visible to users)</label><select name="verified"><option value="true">Yes</option><option value="false">No</option></select></div></div>
        <label>Bio</label><textarea name="bio" rows="2"></textarea><label>Profile photo</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><input type="hidden" name="id"><button class="b" style="margin-top:12px">Save</button> <button type="button" class="b" id="mreset">New</button></form>` +
        table(['Mentor', 'Handle', 'Risk', 'Fee', 'Verified', 'Copiers', ''], items.map((m, i) => `<tr><td>${esc(m.displayName)}<br><small>${esc(m.email)}</small></td><td>@${esc(m.handle)}</td><td>${m.risk}</td><td>${usd(m.fee)}</td><td>${m.verified}</td><td>${m.activeCopiers}</td><td><button class="b" data-e="${i}">Edit</button></td></tr>`));
      const f = $('#mf');
      $('#mreset').onclick = () => { f.reset(); f.elements.namedItem('id').value = ''; f.elements.namedItem('displayName').required = true; $('#mt').textContent = 'Create mentor'; $('#memw').style.display = ''; };
      view.onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; const m = items[b.dataset.e], s = m.stats || {};
        f.reset(); f.elements.namedItem('id').value = m.id; f.elements.namedItem('displayName').required = false; $('#mt').textContent = 'Edit @' + m.handle; $('#memw').style.display = 'none';
        Object.entries({ handle:m.handle, displayName:m.displayName, tag:m.tag, riskScore:m.risk, fee:(Number(m.fee) / 100).toFixed(2), verified:String(m.verified), bio:m.bio, ...s }).forEach(([k, v]) => { const field = f.elements.namedItem(k); if (field) field.value = v ?? ''; });
        scrollTo({ top:0, behavior:'smooth' }); };
      f.onsubmit = (e) => { e.preventDefault(); run(async () => {
        const d = Object.fromEntries(new FormData(f)), id = d.id, body = {};
        for (const k of ['handle', 'displayName', 'tag', 'bio', 'fee']) if (d[k]) body[k] = d[k];
        if (d.riskScore) body.riskScore = +d.riskScore;
        body.verified = d.verified === 'true';
        const st = {}; for (const k of ['gain', 'winRate', 'trades', 'capital', 'copiers', 'tier']) if (d[k] !== '') st[k] = +d[k];
        if (d.avgTime) st.avgTime = d.avgTime;
        if (Object.keys(st).length) body.stats = st;
        let mid = id;
        if (id) await A('/mentors/' + id, { method:'PATCH', body });
        else { body.email = d.email; mid = (await A('/mentors', { method:'POST', body })).id; }
        const file = f.elements.namedItem('photo').files[0];
        if (file) { const fd = new FormData(); fd.append('file', file); await A(`/mentors/${mid}/photo`, { method:'POST', form: fd }); }
        msg('Saved'); TABS.mentors();
      }); };
    },

    audit: async () => {
      const { items } = await A('/audit?limit=100');
      view.innerHTML = table(['Time', 'Actor', 'Action', 'IP', 'Meta'], items.map(a => `<tr><td>${new Date(a.createdAt).toLocaleString()}</td><td>${esc(a.actorId?.slice(-8))}</td><td>${esc(a.action)}</td><td>${esc(a.ip)}</td><td><pre>${esc(a.meta ? JSON.stringify(a.meta) : '')}</pre></td></tr>`));
      view.onclick = null;
    },

    security: async () => {
      view.innerHTML = `<div class="card"><h3>Two-factor authentication</h3><p style="color:var(--text-secondary);font-size:13px;margin:8px 0">Required for admin actions in production.</p>
        <button class="b" id="s1">1. Generate secret</button><pre id="sec" style="margin:12px 0"></pre>
        <label>6-digit code from your authenticator app</label><input id="sc" maxlength="6" style="max-width:200px"><button class="b" id="s2" style="margin-top:8px">2. Enable</button></div>`;
      view.onclick = null;
      $('#s1').onclick = () => run(async () => { const r = await api('/auth/2fa/setup', { method:'POST' });
        $('#sec').textContent = 'Add this key manually in Google Authenticator / Authy (type: time-based):\n' + r.secret + '\n\n' + r.otpauth; });
      $('#s2').onclick = () => run(async () => { await api('/auth/2fa/enable', { method:'POST', body:{ code: $('#sc').value.trim() } }); msg('2FA enabled'); });
    },
  };

  function show(t) {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    view.onclick = null; view.onsubmit = null;
    run(() => TABS[t]());
  }
  $('#tabs').innerHTML = Object.keys(TABS).map(t => `<button data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  $('#tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };

  const loginBox = $('#login'), appBox = $('.adm');
  const showLogin = (note) => { appBox.style.display = 'none'; loginBox.style.display = 'flex'; $('#rf').style.display = 'none'; $('#lf').style.display = ''; $('#lerr').textContent = note || ''; };
  const enter = (me) => { loginBox.style.display = 'none'; appBox.style.display = ''; $('#who').textContent = me.email; show('overview'); };
  const out = async () => { await api('/auth/logout', { method:'POST' }).catch(() => {}); api.setToken(null); };

  const lo = $('#lo'); if (lo) lo.onclick = async () => { await out(); showLogin(); };

  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      const totp = $('#lt').value.trim();
      const r = await api('/auth/login', { method:'POST', auth:false, body:{ email: $('#le').value.trim().toLowerCase(), password: $('#lp').value, ...(totp && { totp }) } });
      api.setToken(r.accessToken);
      if (r.user.role !== 'ADMIN') { await out(); return showLogin('This account is not an admin.'); }
      $('#lp').value = ''; $('#lt').value = '';
      enter(r.user);
    } catch (err) {
      const c = err.data?.error;
      if (c === 'TOTP_REQUIRED' || c === 'INVALID_TOTP') { $('#lt').style.display = 'block'; $('#lt').focus(); $('#lerr').textContent = c === 'INVALID_TOTP' ? 'Wrong 2FA code.' : 'Enter your 2FA code.'; }
      else if (c === 'ACCOUNT_SUSPENDED') $('#lerr').textContent = 'Account restricted.';
      else if (c === 'EMAIL_NOT_VERIFIED') $('#lerr').textContent = 'Email not verified.';
      else if (err.status === 429) $('#lerr').textContent = 'Too many attempts, wait a minute.';
      else $('#lerr').textContent = c === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : 'Server unreachable, try again.';
    } finally { btn.disabled = false; }
  };

  // ---- Reset 2FA (password + emailed code -> wipe -> set up a new authenticator) ----
  (() => {
    const rf = $('#rf'), err = (t) => { $('#rerr').textContent = t || ''; };
    let step = 1, me = null;
    const RERR = { INVALID_CREDENTIALS:'Incorrect email or password.', INVALID_CODE:'Wrong or expired code.', FORBIDDEN:'This account is not an admin.', ACCOUNT_SUSPENDED:'Account restricted.', INVALID_TOTP:'Wrong code, check your app and try again.' };
    const set = (n) => {
      step = n;
      ['rs1','rs2','rs3'].forEach((id, i) => { $('#' + id).style.display = i + 1 === n ? '' : 'none'; });
      $('#rp').textContent = ['', 'Enter your admin email and password. We will email you a code.', 'Enter the 6-digit code we emailed you.', 'Scan the QR code (or type the key) in Google Authenticator / Authy, then enter the code it shows.'][n];
      $('#rgo span').textContent = ['', 'Send code', 'Reset 2FA', 'Enable 2FA'][n]; err('');
    };
    const open = () => { $('#re').value = $('#le').value; $('#rpw').value = $('#lp').value; $('#lf').style.display = 'none'; rf.style.display = ''; $('#rc').value = ''; $('#rn').value = ''; set(1); };
    const close = () => { rf.style.display = 'none'; $('#lf').style.display = ''; $('#rpw').value = ''; };
    $('#r2fa').onclick = open; $('#rback').onclick = close;
    rf.onsubmit = async (e) => {
      e.preventDefault(); const btn = $('#rgo'); btn.disabled = true; err('');
      const creds = { email: $('#re').value.trim().toLowerCase(), password: $('#rpw').value };
      try {
        if (step === 1) { await api('/auth/2fa/reset-request', { method:'POST', auth:false, body:creds }); set(2); $('#rc').focus(); }
        else if (step === 2) {
          const r = await api('/auth/2fa/reset', { method:'POST', auth:false, body:{ ...creds, code: $('#rc').value.trim() } });
          api.setToken(r.accessToken); me = r.user;
          const s = await api('/auth/2fa/setup', { method:'POST' });
          $('#rsec').textContent = 'Key: ' + s.secret; $('#rqr').innerHTML = '';
          try { new QRCode($('#rqr'), { text: s.otpauth, width: 160, height: 160 }); } catch { $('#rqr').textContent = s.otpauth; }
          set(3); $('#rn').focus();
        } else {
          await api('/auth/2fa/enable', { method:'POST', body:{ code: $('#rn').value.trim() } });
          me.totpEnabled = true; $('#rpw').value = ''; rf.style.display = 'none'; enter(me); msg('2FA reset and re-enabled');
        }
      } catch (x) {
        err(x.status === 429 ? 'Too many attempts, wait a minute.' : RERR[x.data?.error] || 'Something went wrong, try again.');
      } finally { btn.disabled = false; }
    };
  })();

  (async () => {
    try {
      const me = await api('/auth/me', { noRedirect: true });
      if (me.role === 'ADMIN') enter(me); else { await out(); showLogin(); }
    } catch { showLogin(); }
  })();
})();
