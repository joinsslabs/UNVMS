'use strict';
(async () => {
  const { $, $$, esc, get, post, api, act, modal, toast } = VMS;
  const me = await VMS.boot({ roles: ['admin', 'manager', 'host'], title: 'Visitor Management', sub: 'Staff & Common Services' });
  if (!me) return;
  const isMgr = ['admin', 'manager'].includes(me.role);

  const TABS = [
    { id: 'dashboard', label: 'Live dashboard', show: isMgr, live: true },
    { id: 'approvals', label: 'Approvals', show: isMgr, live: true },
    { id: 'mine', label: 'My visitors', show: !isMgr, live: true },
    { id: 'visitors', label: 'All visits', show: true, live: true },
    { id: 'register', label: 'Register visitors', show: true },
    { id: 'meetings', label: 'Meetings', show: true },
    { id: 'tags', label: 'Tags', show: isMgr, live: true },
    { id: 'reports', label: 'Reports & audit', show: isMgr },
    { id: 'users', label: 'Users', show: me.role === 'admin' },
  ].filter(t => t.show);
  let current = (location.hash.slice(1) && TABS.find(t => t.id === location.hash.slice(1))) ? location.hash.slice(1) : TABS[0].id;
  let hosts = await get('/hosts');
  let registerPreset = {};

  $('#tabs').innerHTML = TABS.map(t => `<button type="button" data-tab="${t.id}">${t.label}<span class="count hidden" id="tc-${t.id}" style="margin-left:.4rem"></span></button>`).join('')
    + `<span style="flex:1"></span><button type="button" id="pw">Change password</button>`;
  $('#pw').addEventListener('click', () => VMS.changePassword(false));
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });

  function show(id) {
    current = id; location.hash = id;
    $$('#tabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    render();
  }
  async function render() {
    try { await VIEWS[current]($('#view')); } catch (e) { toast(e.message, 'err'); }
  }

  const hostOptions = sel => `<option value="">Choose…</option>` + hosts.map(h => `<option value="${h.id}" ${String(sel) === String(h.id) ? 'selected' : ''}>${esc(h.name)}${h.department ? ' — ' + esc(h.department) : ''}</option>`).join('');
  const typeOptions = sel => me.visitorTypes.filter(t => t !== 'walk_in').map(t => `<option value="${t}" ${t === sel ? 'selected' : ''}>${VMS.TYPE_LABEL[t]}</option>`).join('');
  const where = v => v.purpose === 'meeting' ? `${esc(v.meeting_title || '')} <span class="muted">(${esc(v.meeting_room || '')})</span>` : esc(v.host_name || '');

  function visitTable(rows, { actions = true } = {}) {
    if (!rows.length) return '<div class="empty">No visits.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Expected</th><th>Visitor</th><th>Type</th><th>Host / meeting</th><th>Status</th><th>Tag</th><th>On site</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(v => `<tr data-row="${v.id}" style="cursor:pointer">
        <td>${VMS.fmtLocal(v.expected_at)}<div class="small muted">${esc(v.expected_at.slice(0, 10))}</div></td>
        <td><b>${esc(v.visitor_name)}</b><div class="small muted">${esc(v.organization || '')}</div></td>
        <td>${VMS.typeBadge(v.visitor_type) || 'Guest'} ${VMS.purposeBadge(v)}</td>
        <td>${where(v)}</td><td>${VMS.statusBadge(v.status)}</td><td><b>${esc(v.tag_number || '')}</b></td>
        <td>${v.checked_in_at ? VMS.timer(v.checked_in_at, v.checked_out_at, v.expected_end) : ''}</td>
        ${actions ? `<td>${['pending', 'expected'].includes(v.status) && (isMgr || v.host_id === me.id || v.created_by === me.id) ? `<button class="danger" data-cancel="${v.id}">Cancel</button>` : ''}
          ${me.role === 'host' && ['tagged', 'arrived'].includes(v.status) ? `<button class="success" data-pickup="${v.id}">I've met my guest</button>` : ''}</td>` : ''}
      </tr>`).join('')}</tbody></table></div>`;
  }

  // Row actions shared by all tables
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-cancel]');
    if (c) { e.stopPropagation(); if (confirmBox('Cancel this visit?')) act(c, async () => { await post(`/visits/${c.dataset.cancel}/cancel`); toast('Visit cancelled.', 'ok'); render(); }); return; }
    const p = e.target.closest('[data-pickup]');
    if (p) { e.stopPropagation(); return act(p, async () => { await post(`/visits/${p.dataset.pickup}/picked-up`); toast('Marked as met.', 'ok'); render(); }); }
    const r = e.target.closest('[data-row]');
    if (r && !e.target.closest('button')) detail(Number(r.dataset.row));
  });
  // Native confirm() is avoided on kiosks; simple inline guard instead.
  const confirmBox = msg => window.confirm(msg);

  async function detail(id) {
    const v = await get('/visits/' + id);
    const trail = isMgr ? await get('/audit?visit_id=' + id) : [];
    const step = (label, iso) => iso ? `<dt>${label}</dt><dd>${VMS.fmtDateTime(iso)}</dd>` : '';
    modal(`<h3>${esc(v.visitor_name)} ${VMS.statusBadge(v.status)}</h3>
      <dl class="kv">
        <dt>Reference</dt><dd class="mono">${esc(v.ref)}</dd>
        <dt>Organization</dt><dd>${esc(v.organization || '—')}</dd>
        <dt>Contact</dt><dd>${esc([v.phone, v.email].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>Type</dt><dd>${VMS.TYPE_LABEL[v.visitor_type]} · ${v.purpose === 'meeting' ? 'Meeting' : 'One-on-one'}</dd>
        <dt>Host / meeting</dt><dd>${where(v)}</dd>
        <dt>Booked</dt><dd>${esc(v.expected_at.replace('T', ' '))} – ${VMS.fmtLocal(v.expected_end)}</dd>
        ${v.approved_by_name ? `<dt>${v.status === 'rejected' ? 'Rejected by' : 'Approved by'}</dt><dd>${esc(v.approved_by_name)}${v.rejected_reason ? ` — ${esc(v.rejected_reason)}` : ''}</dd>` : ''}
        ${v.tag_number ? `<dt>Tag</dt><dd>${esc(v.tag_number)} (${esc(v.gate === 'vip' ? 'VIP gate' : 'Access Control')})</dd>` : ''}
        ${v.id_type ? `<dt>ID held</dt><dd>${esc(v.id_type)}${v.id_last4 ? ' · ends ' + esc(v.id_last4) : ''}${v.status === 'checked_out' ? ' · returned' : ''}</dd>` : ''}
        ${step('Access granted', v.checked_in_at)}${step('ID ↔ tag', v.id_received_at)}${step('At main reception', v.arrived_main_at)}
        ${step('Host emailed', v.host_notified_at)}${step('Host called', v.host_called_at)}${step('Directed to meeting', v.directed_meeting_at)}
        ${step('Met host', v.picked_up_at)}${step('Checked out', v.checked_out_at)}
        ${v.checked_in_at ? `<dt>Time on site</dt><dd>${VMS.timer(v.checked_in_at, v.checked_out_at)}</dd>` : ''}
        ${v.notes ? `<dt>Notes</dt><dd>${esc(v.notes)}</dd>` : ''}
      </dl>
      ${trail.length ? `<h2>Audit trail</h2><table><tbody>${trail.map(a => `<tr><td class="small">${VMS.fmtDateTime(a.ts)}</td><td>${esc(a.username || 'system')}</td><td>${esc(a.action)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="foot"><button data-close class="primary">Close</button></div>`);
  }

  const tile = (k, v, alert) => `<div class="tile ${alert && v ? 'alert' : ''}"><div class="v">${v ?? '—'}</div><div class="k">${k}</div></div>`;
  const bars = rows => {
    const max = Math.max(1, ...rows.map(r => r.n));
    return rows.length ? `<div class="bars">${rows.map(r => `<div class="bar"><span>${esc(VMS.TYPE_LABEL[r.k] || (r.k === 'reception1' ? 'Access Control' : r.k === 'vip' ? 'VIP gate' : r.k))}</span><div class="track"><div class="fill" style="width:${(r.n / max) * 100}%"></div></div><b>${r.n}</b></div>`).join('')}</div>` : '<p class="muted small">No check-ins yet.</p>';
  };

  const VIEWS = {
    async dashboard(el) {
      const [s, onsite] = await Promise.all([get('/stats'), get('/visits?scope=onsite')]);
      const cnt = st => (s.today.find(x => x.status === st) || {}).n || 0;
      setCount('approvals', s.pending);
      el.innerHTML = `
        <div class="tiles">
          ${tile('On site now', s.onSiteTotal)}${tile('Still expected today', cnt('expected'))}
          ${tile('Waiting for host', s.waitingForHost.length, true)}${tile('Pending approvals', s.pending, true)}
          ${tile('Overstaying', s.overstays.length, true)}${tile('No-shows so far', s.noShows)}
          ${tile('Checked out today', cnt('checked_out'))}${tile('Avg minutes on site', s.avgMinutesOnSite)}
          ${tile('Avg host response (min)', s.avgMinutesToHost)}${tile('Live station screens', s.liveScreens)}
        </div>
        <div class="grid cols-2" style="margin-top:1.25rem">
          <div class="panel">
            <div class="panel-head"><h2>Who is on site — roll-call</h2><button type="button" id="print" class="no-print">Print roll-call</button></div>
            <p class="small muted">Generated ${new Date().toLocaleString('en-GB')} · ${s.onSiteTotal} visitor(s)</p>
            <div class="table-wrap"><table><thead><tr><th>Tag</th><th>Visitor</th><th>Organization</th><th>Where / with</th><th>Status</th><th>In since</th></tr></thead><tbody>
            ${onsite.map(v => `<tr data-row="${v.id}"><td><b>${esc(v.tag_number)}</b></td><td>${esc(v.visitor_name)}</td><td>${esc(v.organization || '')}</td><td>${where(v)}</td><td>${VMS.statusBadge(v.status)}</td><td>${VMS.fmtTime(v.checked_in_at)} · ${VMS.timer(v.checked_in_at, null, v.expected_end)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nobody on site.</td></tr>'}
            </tbody></table></div>
          </div>
          <div class="no-print">
            <div class="panel"><div class="panel-head"><h2>Needs attention</h2></div>
              ${s.waitingForHost.map(v => `<div class="vcard" data-row="${v.id}">${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}<div class="main"><div class="name">${esc(v.visitor_name)}</div><div class="meta">waiting for ${esc(v.host_name)}</div></div>${VMS.timer(v.arrived_main_at)}</div>`).join('')}
              ${s.overstays.map(v => `<div class="vcard" data-row="${v.id}">${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}<div class="main"><div class="name">${esc(v.visitor_name)}</div><div class="meta">booked until ${VMS.fmtLocal(v.expected_end)} · ${esc(v.host_name || '')}</div></div><span class="badge b-rejected">Overstay</span></div>`).join('')}
              ${!s.waitingForHost.length && !s.overstays.length ? '<div class="empty">All clear.</div>' : ''}
            </div>
            <div class="panel" style="margin-top:1.25rem"><h2>Today by department</h2>${bars(s.byDepartment)}</div>
            <div class="panel" style="margin-top:1.25rem"><h2>Today by visitor type</h2>${bars(s.byType)}<h2 style="margin-top:1rem">By gate</h2>${bars(s.byGate)}</div>
          </div>
        </div>`;
      $('#print').addEventListener('click', () => window.print());
    },

    async approvals(el) {
      const rows = await get('/visits?scope=pending');
      setCount('approvals', rows.length);
      el.innerHTML = `<div class="panel"><div class="panel-head"><h2>Waiting for approval</h2></div>
        <p class="small muted">Contractors and walk-ins need an independent approver. You cannot approve a visit you requested or are hosting.</p>
        <div class="list">${rows.map(v => `<div class="vcard">
          <div class="main"><div class="name">${esc(v.visitor_name)} ${VMS.typeBadge(v.visitor_type)}</div>
            <div class="meta">${esc(v.organization || '')} · for ${esc(v.host_name)} · ${esc(v.expected_at.replace('T', ' '))}–${VMS.fmtLocal(v.expected_end)} · requested by ${esc(v.created_by_name || '')}${v.notes ? ` · “${esc(v.notes)}”` : ''}</div></div>
          <div class="actions"><button class="danger" data-reject="${v.id}">Reject</button><button class="success" data-approve="${v.id}">Approve</button></div>
        </div>`).join('') || '<div class="empty">Nothing waiting.</div>'}</div></div>`;
      el.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => act(b, async () => { await post(`/visits/${b.dataset.approve}/approve`); toast('Approved.', 'ok'); render(); })));
      el.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => {
        const reason = prompt('Reason for rejection (shared with the host):', '');
        if (reason === null) return;
        act(b, async () => { await post(`/visits/${b.dataset.reject}/reject`, { reason }); toast('Rejected.', 'ok'); render(); });
      }));
    },

    async mine(el) {
      const rows = await get('/visits?scope=upcoming&date=' + VMS.today());
      const onsite = await get('/visits?scope=onsite');
      const all = [...onsite, ...rows.filter(r => !onsite.some(o => o.id === r.id))];
      el.innerHTML = `<div class="panel"><div class="panel-head"><h2>My visitors — today &amp; upcoming</h2>
        <button class="primary" type="button" id="newv">+ Register a visitor</button></div>${visitTable(all)}</div>`;
      $('#newv').addEventListener('click', () => show('register'));
    },

    async visitors(el) {
      const date = el.dataset.date || VMS.today();
      el.innerHTML = `<div class="panel">
        <div class="row no-print" style="margin-bottom:1rem">
          <div><label>Date</label><input type="date" id="vd" value="${date}"></div>
          <div class="grow"><label>Search</label><input id="vq" placeholder="Name, organization, reference or tag" value="${esc(el.dataset.q || '')}"></div>
          <div><label>Status</label><select id="vs"><option value="">All</option>${Object.entries(VMS.STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${el.dataset.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div><div id="vt"></div></div>`;
      const load = async () => {
        el.dataset.q = $('#vq').value; el.dataset.status = $('#vs').value;
        const q = new URLSearchParams({ scope: 'today', date: $('#vd').value });
        if ($('#vq').value.trim()) q.set('q', $('#vq').value.trim());
        if ($('#vs').value) q.set('status', $('#vs').value);
        $('#vt').innerHTML = visitTable(await get('/visits?' + q));
      };
      $('#vd').addEventListener('change', () => { el.dataset.date = $('#vd').value; load(); });
      let t; $('#vq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
      $('#vs').addEventListener('change', load);
      await load();
    },

    async register(el) {
      const meetings = await get('/meetings');
      const p = registerPreset; registerPreset = {};
      const start = p.expected_at || VMS.nowLocal();
      el.innerHTML = `<div class="grid cols-2">
        <div class="panel"><h2>Register a visitor</h2>
          <form id="rf">
            <div class="field"><label>Visitor's full name *</label><input name="visitor_name" required maxlength="120"></div>
            <div class="form-grid">
              <div class="field"><label>Organization</label><input name="organization"></div>
              <div class="field"><label>Visitor type</label><select name="visitor_type">${typeOptions('guest')}</select></div>
              <div class="field"><label>Phone</label><input name="phone" inputmode="tel"></div>
              <div class="field"><label>Email (sends invitation)</label><input name="email" type="email"></div>
            </div>
            <div class="field"><label>Purpose</label>
              <div class="row"><label class="check grow"><input type="radio" name="purpose" value="one_on_one" ${p.meeting_id ? '' : 'checked'}> One-on-one with a host</label>
              <label class="check grow"><input type="radio" name="purpose" value="meeting" ${p.meeting_id ? 'checked' : ''}> Attending a meeting</label></div></div>
            <div class="field" id="hostField" ${me.role === 'host' ? 'hidden' : ''}><label>Host *</label><select name="host_id">${hostOptions(me.role === 'host' ? me.id : '')}</select></div>
            <div class="field hidden" id="meetField"><label>Meeting *</label><select name="meeting_id"><option value="">Choose…</option>
              ${meetings.map(m => `<option value="${m.id}" ${String(p.meeting_id) === String(m.id) ? 'selected' : ''}>${esc(m.starts_at.replace('T', ' '))} — ${esc(m.title)} (${esc(m.room)})</option>`).join('')}</select></div>
            <div class="form-grid" id="timeFields">
              <div class="field"><label>Expected arrival *</label><input type="datetime-local" name="expected_at" value="${start}" required></div>
              <div class="field"><label>Expected departure</label><input type="datetime-local" name="expected_end"></div>
            </div>
            <div class="field"><label>Notes for reception</label><input name="notes" maxlength="500" placeholder="e.g. wheelchair access, delivery, equipment"></div>
            <p class="small muted">Contractors need approval from Common Services before they can be checked in.</p>
            <button class="primary big">Register visitor</button>
          </form>
        </div>
        <div class="panel"><h2>Bulk upload (CSV)</h2>
          <p class="small">Columns: <span class="mono">visitor_name, organization, phone, email, visitor_type, host_email, date, time, end_time, meeting_id</span>.
          Export a Word/Excel list as CSV first. Max 500 rows.</p>
          <p><a id="tpl" href="#" download="visitor_template.csv">Download template</a></p>
          <input type="file" id="csv" accept=".csv,text/csv">
          <div id="preview" style="margin-top:1rem"></div>
        </div></div>`;
      const f = $('#rf');
      const sync = () => {
        const meeting = f.purpose.value === 'meeting';
        $('#meetField').classList.toggle('hidden', !meeting);
        $('#timeFields').classList.toggle('hidden', meeting);
        $('#hostField').classList.toggle('hidden', meeting || me.role === 'host');
      };
      f.addEventListener('change', sync); sync();
      f.addEventListener('submit', e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f));
        if (d.purpose === 'meeting') { delete d.expected_at; delete d.expected_end; delete d.host_id; }
        for (const k of Object.keys(d)) if (d[k] === '') delete d[k];
        act(e.submitter, async () => {
          const v = await post('/visits', d);
          toast(`${v.visitor_name} registered (${v.ref})${v.status === 'pending' ? ' — sent for approval' : ''}.`, 'ok');
          f.visitor_name.value = ''; f.organization.value = ''; f.phone.value = ''; f.email.value = ''; f.notes.value = ''; f.visitor_name.focus();
        });
      });
      const tpl = 'visitor_name,organization,phone,email,visitor_type,host_email,date,time,end_time,meeting_id\r\nJane Doe,Acme Ltd,+2348000000000,jane@acme.com,guest,host@example.org,' + VMS.today() + ',10:00,11:30,\r\n';
      $('#tpl').href = URL.createObjectURL(new Blob([tpl], { type: 'text/csv' }));
      $('#csv').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const rows = parseCsv(await file.text());
        const head = rows.shift().map(h => h.trim().toLowerCase());
        const objs = rows.filter(r => r.some(c => c.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
          .map(o => ({ ...o, expected_end: o.date && o.end_time ? `${o.date}T${o.end_time.padStart(5, '0')}` : undefined, purpose: o.meeting_id ? 'meeting' : 'one_on_one' }));
        $('#preview').innerHTML = `<p><b>${objs.length}</b> row(s) ready.</p>
          <div class="table-wrap" style="max-height:240px"><table><thead><tr><th>Name</th><th>Host</th><th>Date</th><th>Time</th></tr></thead><tbody>
          ${objs.slice(0, 50).map(o => `<tr><td>${esc(o.visitor_name)}</td><td>${esc(o.host_email || (me.role === 'host' ? me.name : ''))}</td><td>${esc(o.date)}</td><td>${esc(o.time)}</td></tr>`).join('')}</tbody></table></div>
          <button class="primary" id="imp" style="margin-top:.75rem">Import ${objs.length} visitor(s)</button>`;
        $('#imp').addEventListener('click', ev => act(ev.target, async () => {
          const r = await post('/visits/bulk', { rows: objs });
          $('#preview').innerHTML = `<p><b>${r.created}</b> imported.</p>${r.errors.length ? `<ul>${r.errors.map(x => `<li>Row ${x.row}: ${esc(x.error)}</li>`).join('')}</ul>` : ''}`;
          toast(`${r.created} visitor(s) imported.`, 'ok');
        }));
      });
    },

    async meetings(el) {
      const date = el.dataset.date || VMS.today();
      const list = await get('/meetings?date=' + date);
      el.innerHTML = `<div class="grid cols-2">
        <div class="panel"><div class="panel-head"><h2>Meetings</h2><input type="date" id="md" value="${date}" style="width:auto"></div>
          <div class="list">${list.map(m => `<div class="meetingbox"><div class="row"><div class="grow">
            <div class="title">${esc(m.title)}</div><div><b>${esc(m.room)}</b>${m.directions ? ' — ' + esc(m.directions) : ''}</div>
            <div class="small muted">${VMS.fmtLocal(m.starts_at)}–${VMS.fmtLocal(m.ends_at)} · ${esc(m.host_name)} · ${m.arrived}/${m.invited} arrived</div></div>
            <button type="button" data-addto="${m.id}">+ Add attendees</button></div></div>`).join('') || '<div class="empty">No meetings on this date.</div>'}</div></div>
        <div class="panel"><h2>Schedule a meeting</h2>
          <form id="mf">
            <div class="field"><label>Title *</label><input name="title" required></div>
            <div class="form-grid">
              <div class="field"><label>Room *</label><input name="room" required placeholder="e.g. Conference Room B"></div>
              <div class="field"><label>Directions</label><input name="directions" placeholder="2nd floor, left from lifts"></div>
              <div class="field"><label>Starts *</label><input type="datetime-local" name="starts_at" required value="${date}T10:00"></div>
              <div class="field"><label>Ends *</label><input type="datetime-local" name="ends_at" required value="${date}T12:00"></div>
            </div>
            ${isMgr ? `<div class="field"><label>Organizer</label><select name="host_id">${hostOptions(me.id)}</select></div>` : ''}
            <button class="primary">Create meeting</button>
          </form></div></div>`;
      $('#md').addEventListener('change', e => { el.dataset.date = e.target.value; render(); });
      el.querySelectorAll('[data-addto]').forEach(b => b.addEventListener('click', () => { registerPreset = { meeting_id: b.dataset.addto }; show('register'); }));
      $('#mf').addEventListener('submit', e => {
        e.preventDefault();
        act(e.submitter, async () => { await post('/meetings', Object.fromEntries(new FormData(e.target))); toast('Meeting created.', 'ok'); render(); });
      });
    },

    async tags(el) {
      const t = await get('/tags');
      const sum = pool => ['available', 'in_use', 'lost'].map(s => `${s.replace('_', ' ')}: <b>${(t.summary.find(x => x.pool === pool && x.status === s) || {}).n || 0}</b>`).join(' · ');
      el.innerHTML = `<div class="grid cols-2">
        <div class="panel"><h2>Tag pools</h2><p>Standard tags — ${sum('standard')}</p><p>VIP tags — ${sum('vip')}</p>
          <h2 style="margin-top:1rem">Missing / lost tags</h2>
          ${t.lost.map(l => `<div class="row" style="margin-bottom:.4rem"><b class="grow">${esc(l.number)}</b><button data-restore="${esc(l.number)}">Found — return to pool</button></div>`).join('') || '<p class="muted">None.</p>'}</div>
        <div class="panel"><h2>Tags in use</h2><div class="table-wrap"><table><thead><tr><th>Tag</th><th>Visitor</th></tr></thead><tbody>
          ${t.inUse.map(x => `<tr data-row="${x.visit_id}"><td><b>${esc(x.number)}</b></td><td>${esc(x.visitor_name)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">None.</td></tr>'}</tbody></table></div></div></div>`;
      el.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => act(b, async () => { await post(`/tags/${encodeURIComponent(b.dataset.restore)}/restore`); render(); })));
    },

    async reports(el) {
      const [audit, outbox] = await Promise.all([get('/audit?limit=300'), get('/outbox')]);
      el.innerHTML = `<div class="panel"><h2>Export visits (CSV)</h2>
          <div class="row"><div><label>From</label><input type="date" id="rf1" value="${VMS.today()}"></div><div><label>To</label><input type="date" id="rf2" value="${VMS.today()}"></div>
          <div style="align-self:flex-end"><a class="btn primary" id="exp" href="#">Download CSV</a></div></div>
          <p class="small muted">Every export is recorded in the audit trail.</p></div>
        <div class="grid cols-2" style="margin-top:1.25rem">
          <div class="panel"><h2>Audit trail (latest 300)</h2><div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Visit</th><th>Detail</th></tr></thead><tbody>
            ${audit.map(a => `<tr><td class="small">${VMS.fmtDateTime(a.ts)}</td><td>${esc(a.username || 'system')}<div class="small muted">${esc(a.role || '')}</div></td><td>${esc(a.action)}</td><td>${a.visit_id ? `<a href="#" data-row="${a.visit_id}">#${a.visit_id}</a>` : ''}</td><td class="small mono">${esc(a.detail || '')}</td></tr>`).join('')}</tbody></table></div></div>
          <div class="panel"><h2>Email log</h2>${me.mailEnabled ? '' : '<p class="small" style="color:var(--warn)">SMTP is not configured — emails are recorded here but not sent. Set SMTP_* in .env.</p>'}
            <div class="table-wrap"><table><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>
            ${outbox.map(o => `<tr><td class="small">${VMS.fmtDateTime(o.ts)}</td><td>${esc(o.to_addr)}</td><td>${esc(o.subject)}</td><td><span class="badge ${o.status === 'sent' ? 'b-with_host' : o.status === 'failed' ? 'b-rejected' : 'b-pending'}" title="${esc(o.error || '')}">${esc(o.status)}</span></td></tr>`).join('')}</tbody></table></div></div></div>`;
      const upd = () => { $('#exp').href = `/api/export.csv?from=${$('#rf1').value}&to=${$('#rf2').value}`; };
      $('#rf1').addEventListener('change', upd); $('#rf2').addEventListener('change', upd); upd();
    },

    async users(el) {
      const users = await get('/users');
      const roles = { admin: 'Administrator', manager: 'Common Services Manager / Approver', reception1: 'Reception — Access Control', documentation: 'Documentation & Tagging', main_reception: 'Reception — Main Building', vip: 'VIP Gate', host: 'Staff host' };
      el.innerHTML = `<div class="grid cols-2">
        <div class="panel"><h2>Users</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Contact</th><th></th></tr></thead><tbody>
          ${users.map(u => `<tr style="${u.active ? '' : 'opacity:.5'}"><td><b>${esc(u.name)}</b><div class="small muted">${esc(u.department || '')}</div></td><td class="mono">${esc(u.username)}</td>
            <td>${esc(roles[u.role])}</td><td class="small">${esc(u.email || '')}<br>${esc(u.phone || '')}${u.extension ? ' · ext ' + esc(u.extension) : ''}</td>
            <td><button data-reset="${u.id}">Reset password</button> ${u.id !== me.id ? `<button data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Deactivate' : 'Activate'}</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="panel"><h2>Add user</h2>
          <form id="uf">
            <div class="form-grid">
              <div class="field"><label>Full name *</label><input name="name" required></div>
              <div class="field"><label>Username *</label><input name="username" required autocomplete="off"></div>
              <div class="field"><label>Role *</label><select name="role">${Object.entries(roles).map(([k, l]) => `<option value="${k}" ${k === 'host' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="field"><label>Department / agency</label><input name="department"></div>
              <div class="field"><label>Email (for arrival alerts)</label><input name="email" type="email"></div>
              <div class="field"><label>Mobile</label><input name="phone"></div>
              <div class="field"><label>Desk extension</label><input name="extension"></div>
              <div class="field"><label>Temporary password * (min 10)</label><input name="password" required minlength="10" autocomplete="new-password"></div>
            </div>
            <button class="primary">Create user</button>
          </form></div></div>`;
      $('#uf').addEventListener('submit', e => {
        e.preventDefault();
        act(e.submitter, async () => { await post('/users', Object.fromEntries(new FormData(e.target))); hosts = await get('/hosts'); toast('User created. They must change the password at first sign-in.', 'ok'); render(); });
      });
      el.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => act(b, async () => { await api('PATCH', `/users/${b.dataset.toggle}`, { active: b.dataset.active !== '1' }); hosts = await get('/hosts'); render(); })));
      el.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => {
        const pw = prompt('New temporary password (min 10 characters):'); if (!pw) return;
        act(b, async () => { await api('PATCH', `/users/${b.dataset.reset}`, { password: pw }); toast('Password reset. The user must change it at next sign-in.', 'ok'); });
      }));
    },
  };

  function setCount(tab, n) {
    const c = $('#tc-' + tab); if (!c) return;
    c.textContent = n; c.classList.toggle('hidden', !n);
  }
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    if (rows[0] && rows[0][0]) rows[0][0] = rows[0][0].replace(/^﻿/, '');
    return rows;
  }

  show(current);
  if (isMgr) get('/visits?scope=pending').then(r => setCount('approvals', r.length)).catch(() => {});
  VMS.live(() => {
    if (document.querySelector('.modal-back')) return;
    const tab = TABS.find(t => t.id === current);
    if (tab && tab.live) render();
    if (isMgr) get('/visits?scope=pending').then(r => setCount('approvals', r.length)).catch(() => {});
  });
})();
