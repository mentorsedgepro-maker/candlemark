(() => {
  const L = { en:'English', es:'Español', fr:'Français', de:'Deutsch', pt:'Português', ar:'العربية', 'zh-CN':'中文', hi:'हिन्दी', ru:'Русский', tr:'Türkçe', yo:'Yorùbá', ig:'Igbo', ha:'Hausa' };
  const cur = (document.cookie.match(/googtrans=\/en\/([\w-]+)/) || [])[1] || 'en';
  document.head.insertAdjacentHTML('beforeend', '<style>.lang-sel{background:#fff;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font:600 13px var(--font-body);color:var(--text-primary)}.goog-te-banner-frame,.skiptranslate iframe{display:none!important}body{top:0!important}#gt{display:none}</style>');
  const sel = document.createElement('select');
  sel.className = 'lang-sel notranslate'; sel.setAttribute('aria-label', 'Language');
  sel.innerHTML = Object.entries(L).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('');
  sel.onchange = () => {
    const h = location.hostname, p = h.split('.');
    const doms = ['', `;domain=${h}`, `;domain=.${h}`, `;domain=.${p.slice(-2).join('.')}`];
    doms.forEach((d) => {
      document.cookie = `googtrans=;path=/;max-age=0${d}`;
      if (sel.value !== 'en') document.cookie = `googtrans=/en/${sel.value};path=/${d}`;
    });
    location.reload();
  };
  const host = document.querySelector('.nav-actions,.topbar-right');
  if (host) host.prepend(sel); else { sel.style.cssText = 'position:fixed;top:14px;right:14px;z-index:600'; document.body.append(sel); }
  if (cur !== 'en') {
    document.body.insertAdjacentHTML('beforeend', '<div id="gt"></div>');
    window.gtInit = () => new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'gt');
    document.head.append(Object.assign(document.createElement('script'), { src: 'https://translate.google.com/translate_a/element.js?cb=gtInit' }));
  }
})();
