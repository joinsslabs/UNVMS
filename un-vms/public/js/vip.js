'use strict';
(async () => {
  const { $, esc, get, post, act, modal, toast } = VMS;
  const me = await VMS.boot({ roles: ['vip'], title: 'VIP Gate', sub: 'Station 4 · Tablet' });
  if (!me) return;

  let rows = [];
  let hosts = [];
  get('/hosts').then(h => { hosts = h; });

  const dest = v => v.purpose === 'meeting' ? `${esc(v.meeting_title)} · ${esc(v.meeting_room)}` : `Host: ${VMS.hostLine(v)}`;
  const card = v => `<div class="vcard ${v.status === 'expected' ? 'clickable' : ''}" data-id="${v.id}">
    ${VMS.tagChip(v.tag_number, true)}
    <div class="main"><div class="name">${esc(v.visitor_name)}</div><div class="meta">${esc(v.organization || '')} · ${dest(v)} · ${VMS.fmtLocal(v.expected_at)}</div></div>
    <div class="actions">${v.status === 'expected' ? '<button class="vipbtn" type="button">Welcome</button>' : VMS.statusBadge(v.status)}
      ${v.checked_in_at && v.status !== 'checked_out' ? VMS.timer(v.checked_in_at, null, v.expected_end) : ''}</div>
  </div>`;
  const onsiteCard = v => `<div class="vcard" data-id="${v.id}">
    ${VMS.tagChip(v.tag_number, true)}
    <div class="main"><div class="name">${esc(v.visitor_name)}</div><div class="meta">${dest(v)}</div></div>
    <div class="actions">${VMS.statusBadge(v.status)} ${VMS.timer(v.checked_in_at, null, v.expected_end)}
      ${v.status === 'arrived' ? `<button data-pick="${v.id}" class="success">Host here</button>` : ''}
      <button data-out="${v.id}">Check out</button></div>
  </div>`;

  async function search() {
    const q = $('#q').value.trim();
    if (q.length < 2) { $('#results').innerHTML = ''; return; }
    const hits = await get('/visits/search?q=' + encodeURIComponent(q)).catch(() => []);
    $('#results').innerHTML = hits.length ? hits.map(card).join('') : '<div class="empty">No booking found today. Use “Unscheduled VIP”.</div>';
  }
  let t; $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 200); });

  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) return act(pick, async () => { await post(`/visits/${pick.dataset.pick}/picked-up`); toast('Marked as with host.', 'ok'); refresh(); });
    const out = e.target.closest('[data-out]');
    if (out) return checkout(Number(out.dataset.out));
    const c = e.target.closest('.vcard.clickable');
    if (c) welcome(Number(c.dataset.id));
  });

  async function welcome(id) {
    const v = await get('/visits/' + id);
    modal(`
      <h3>Welcome ${esc(v.visitor_name)}</h3>
      <dl class="kv"><dt>Organization</dt><dd>${esc(v.organization || '—')}</dd>
        <dt>${v.purpose === 'meeting' ? 'Meeting' : 'Host'}</dt><dd>${dest(v)}</dd>
        <dt>Expected</dt><dd>${VMS.fmtLocal(v.expected_at)}</dd></dl>
      <label class="check"><input type="checkbox" id="idok"> I have confirmed this is <b>${esc(v.visitor_name)}</b>.</label>
      <div class="form-grid" style="margin-top:.75rem">
        <div class="field"><label>ID collected</label><select id="idt">${me.idTypes.map(t => `<option ${t === 'Not required (VIP)' ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="field"><label>Last 4 of ID (optional)</label><input id="l4" maxlength="4"></div>
      </div>
      <p class="small muted">${v.purpose === 'meeting' ? 'The VIP is logged straight into the meeting.' : `${esc(v.host_name)} is emailed immediately to come to the VIP gate.`}</p>
      <div class="foot"><button data-close type="button">Cancel</button><button id="go" class="vipbtn big" disabled>Grant access</button></div>`, {
      onOpen: (m, close) => {
        $('#idok', m).addEventListener('change', e => { $('#go', m).disabled = !e.target.checked; });
        $('#go', m).addEventListener('click', e => act(e.target, async () => {
          const nv = await post(`/visits/${v.id}/vip-fast-track`, { identity_confirmed: true, id_type: $('#idt', m).value, id_last4: $('#l4', m).value || undefined });
          close(); $('#q').value = ''; $('#results').innerHTML = '';
          modal(`<div class="bigtag vip"><div class="label">VIP tag</div><div class="num">${esc(nv.tag_number)}</div></div>
            <p style="text-align:center">${nv.purpose === 'meeting' ? `Escort to <b>${esc(nv.meeting_room)}</b>.` : nv.host_notified_at ? `${esc(nv.host_name)} has been emailed.` : `Please call ${esc(nv.host_name)}.`}</p>
            <div class="foot">${nv.purpose !== 'meeting' ? VMS.telLink(nv) : ''}<button data-close class="primary big">Done</button></div>`);
          refresh();
        }));
      },
    });
  }

  function checkout(id) {
    const v = rows.find(x => x.id === id);
    const needId = v.id_type && v.id_type !== 'Not required (VIP)';
    modal(`<h3>Check out ${esc(v.visitor_name)}</h3>
      <p>Tag <b>${esc(v.tag_number)}</b> · on site ${VMS.timer(v.checked_in_at)}</p>
      ${needId ? `<label class="check"><input type="checkbox" id="idb"> ${esc(v.id_type)} returned to the visitor.</label>` : ''}
      <div class="foot"><button data-close type="button">Cancel</button><button id="go" class="primary big" ${needId ? 'disabled' : ''}>Check out</button></div>`, {
      onOpen: (m, close) => {
        if (needId) $('#idb', m).addEventListener('change', e => { $('#go', m).disabled = !e.target.checked; });
        $('#go', m).addEventListener('click', e => act(e.target, async () => {
          await post(`/visits/${id}/checkout`, { id_returned: needId ? true : false }); close(); toast('Checked out.', 'ok'); refresh();
        }));
      },
    });
  }

  $('#addvip').addEventListener('click', () => {
    modal(`<h3>Unscheduled VIP</h3>
      <form id="vf">
        <div class="field"><label>Full name and title *</label><input name="visitor_name" required></div>
        <div class="field"><label>Organization</label><input name="organization"></div>
        <div class="field"><label>Visiting *</label><select name="host_id" required><option value="">Choose…</option>
          ${hosts.map(h => `<option value="${h.id}">${esc(h.name)}${h.department ? ' — ' + esc(h.department) : ''}</option>`).join('')}</select></div>
        <div class="foot"><button type="button" data-close>Cancel</button><button class="vipbtn">Add &amp; continue</button></div>
      </form>`, {
      onOpen: (m, close) => $('#vf', m).addEventListener('submit', e => {
        e.preventDefault();
        act(e.submitter, async () => { const v = await post('/visits', Object.fromEntries(new FormData(e.target))); close(); await refresh(); welcome(v.id); });
      }),
    });
  });

  async function refresh() {
    const today = await get('/visits?scope=today').catch(() => null);
    if (!today) return;
    const onsite = await get('/visits?scope=onsite').catch(() => []);
    rows = [...today, ...onsite.filter(o => !today.some(t => t.id === o.id))];
    const exp = today.filter(v => v.visitor_type === 'vip' && v.status === 'expected');
    const on = onsite.filter(v => v.gate === 'vip');
    $('#nExp').textContent = exp.length; $('#nOn').textContent = on.length;
    $('#expected').innerHTML = exp.length ? exp.map(card).join('') : '<div class="empty">No VIPs expected.</div>';
    $('#onsite').innerHTML = on.length ? on.map(onsiteCard).join('') : '<div class="empty">No VIPs on site.</div>';
  }
  VMS.live(refresh);
})();
