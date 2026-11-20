/* Shared front-end helpers for every station screen. No framework, no build step. */
'use strict';
const VMS = (() => {
  const STATION_HOME = {
    admin: '/admin.html', manager: '/admin.html', host: '/admin.html',
    reception1: '/reception.html', documentation: '/documentation.html',
    main_reception: '/main-reception.html', vip: '/vip.html',
  };
  const STATUS_LABEL = {
    pending: 'Awaiting approval', expected: 'Expected', rejected: 'Rejected', cancelled: 'Cancelled',
    checked_in: 'Access granted', tagged: 'Tagged — to main bldg', arrived: 'Waiting for host',
    in_meeting: 'In meeting', with_host: 'With host', checked_out: 'Checked out',
  };
  const TYPE_LABEL = { guest: 'Guest', vip: 'VIP', contractor: 'Contractor', vendor: 'Vendor', walk_in: 'Walk-in' };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  async function api(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + url, opts);
    if (res.status === 401 && !url.startsWith('/login')) { location.href = '/'; throw new Error('Signed out'); }
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }
  const get = url => api('GET', url);
  const post = (url, body = {}) => api('POST', url, body);

  function toast(msg, kind = '') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3500);
  }
  /** Run an async action from a button, with error toast and disabled state. */
  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { toast(e.message, 'err'); } finally { if (btn) btn.disabled = false; }
  }

  // ---- time --------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtLocal = l => l ? l.slice(11, 16) : '—';            // 'YYYY-MM-DDTHH:MM' -> 'HH:MM'
  const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  function duration(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowLocal = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /** <span data-since="iso" data-until="iso?" data-end-local="expected_end?"> live timers. */
  function tickTimers() {
    const now = Date.now(), nl = nowLocal();
    for (const el of $$('[data-since]')) {
      const end = el.dataset.until ? new Date(el.dataset.until).getTime() : now;
      el.textContent = duration(end - new Date(el.dataset.since).getTime());
      if (el.dataset.endLocal) el.classList.toggle('over', !el.dataset.until && el.dataset.endLocal < nl);
    }
    const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString('en-GB');
  }
  setInterval(tickTimers, 1000);
  const timer = (since, until, endLocal) => since
    ? `<span class="timer" data-since="${esc(since)}"${until ? ` data-until="${esc(until)}"` : ''}${endLocal ? ` data-end-local="${esc(endLocal)}"` : ''}></span>` : '';

  // ---- badges ----------------------------------------------------------------
  const statusBadge = s => `<span class="badge b-${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;
  const typeBadge = t => t && t !== 'guest' ? `<span class="badge b-${esc(t)}">${esc(TYPE_LABEL[t] || t)}</span>` : '';
  const purposeBadge = v => v.purpose === 'meeting' ? `<span class="badge b-meeting">Meeting</span>` : '';
  const tagChip = (n, vip) => n ? `<div class="tagchip${vip ? ' vip' : ''}"><small>TAG</small>${esc(n)}</div>` : '';
  const isVipTag = v => v.gate === 'vip';

  // ---- modal -----------------------------------------------------------------
  function modal(html, { onOpen, locked } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !locked) close(); };
    back.addEventListener('click', e => { if ((e.target === back && !locked) || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    const m = back.querySelector('.modal');
    const first = m.querySelector('input:not([type=checkbox]), select, textarea'); if (first) first.focus();
    if (onOpen) onOpen(m, close);
    return { el: m, close };
  }

  // ---- header + session ------------------------------------------------------
  let me = null;
  async function boot({ roles, title, sub }) {
    try { me = await get('/me'); } catch { return null; }
    if (roles && me.role !== 'admin' && !roles.includes(me.role)) { location.href = STATION_HOME[me.role] || '/'; return null; }
    const bar = document.createElement('header');
    bar.className = 'topbar';
    bar.innerHTML = `
      <div class="brand"><div class="dot">UN</div><div><div class="station">${esc(title)}</div><div class="sub">${esc(me.orgName)} · ${esc(sub || 'Visitor Management')}</div></div></div>
      <div class="spacer"></div>
      <span id="live" class="live off">Connecting…</span>
      <span id="clock" class="clock"></span>
      <span class="small">${esc(me.name)}</span>
      <button id="logout" type="button">Sign out</button>`;
    document.body.prepend(bar);
    $('#logout').addEventListener('click', async () => { await post('/logout').catch(() => {}); location.href = '/'; });
    tickTimers();
    if (me.must_change) changePassword(true);
    return me;
  }

  function changePassword(forced) {
    modal(`
      <h3>${forced ? 'Set a new password' : 'Change password'}</h3>
      ${forced ? '<p class="muted">Please replace the temporary password before using this station.</p>' : ''}
      <form id="pwform">
        <div class="field"><label>Current password</label><input type="password" name="current" required autocomplete="current-password"></div>
        <div class="field"><label>New password (min. 10 characters)</label><input type="password" name="next" required minlength="10" autocomplete="new-password"></div>
        <div class="foot">${forced ? '' : '<button type="button" data-close>Cancel</button>'}<button class="primary">Save password</button></div>
      </form>`, {
      locked: forced,
      onOpen: (m, close) => {
        $('#pwform', m).addEventListener('submit', async e => {
          e.preventDefault();
          const f = new FormData(e.target);
          await act(e.submitter, async () => {
            await post('/me/password', { current: f.get('current'), next: f.get('next') });
            toast('Password updated.', 'ok');
            close();
          });
        });
      },
    });
  }

  /** Live updates via Server-Sent Events, with a polling fallback. */
  function live(onChange) {
    let debounce;
    const fire = (e) => { clearTimeout(debounce); debounce = setTimeout(() => onChange(e), 150); };
    const connect = () => {
      const es = new EventSource('/api/stream');
      es.onopen = () => { const l = $('#live'); if (l) { l.className = 'live on'; l.textContent = 'Live'; } fire(null); };
      es.onerror = () => { const l = $('#live'); if (l) { l.className = 'live off'; l.textContent = 'Reconnecting…'; } };
      es.addEventListener('visit', ev => fire(JSON.parse(ev.data)));
      es.addEventListener('meeting', ev => fire(JSON.parse(ev.data)));
    };
    connect();
    setInterval(() => onChange(null), 60000); // safety net
  }

  function hostLine(v) {
    if (!v.host_name) return '';
    return `${esc(v.host_name)}${v.host_department ? ` · ${esc(v.host_department)}` : ''}`;
  }
  function telLink(v) {
    const num = v.host_phone || v.host_extension;
    return num ? `<a class="btn" href="tel:${esc(num)}" data-call="${v.id}">📞 Call ${esc(v.host_extension ? 'ext. ' + v.host_extension : v.host_phone)}</a>` : '';
  }

  return {
    esc, $, $$, api, get, post, toast, act, modal, boot, live, changePassword,
    fmtTime, fmtLocal, fmtDateTime, duration, today, nowLocal, timer,
    statusBadge, typeBadge, purposeBadge, tagChip, isVipTag, hostLine, telLink,
    STATUS_LABEL, TYPE_LABEL, STATION_HOME, me: () => me,
  };
})();
