'use strict';
(async () => {
  const { $, esc, get, post, act, modal, toast } = VMS;
  const me = await VMS.boot({ roles: ['documentation'], title: 'Documentation & Tagging', sub: 'Station 2 · Main Access Control building' });
  if (!me) return;

  const ON_SITE = ['checked_in', 'tagged', 'arrived', 'in_meeting', 'with_host'];
  let onsite = [];
  const seen = new Set();

  const dest = v => v.purpose === 'meeting' ? `Meeting: ${esc(v.meeting_title)} (${esc(v.meeting_room)})` : `Host: ${VMS.hostLine(v)}`;

  function queueCard(v) {
    const fresh = !seen.has(v.id); seen.add(v.id);
    return `<div class="vcard clickable ${fresh ? 'flash' : ''}" data-id="${v.id}" data-act="exchange">
      ${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}
      <div class="main"><div class="name">${esc(v.visitor_name)} ${VMS.typeBadge(v.visitor_type)}</div>
        <div class="meta">${esc(v.organization || '')}${v.organization ? ' · ' : ''}${dest(v)}</div></div>
      <div class="actions">${VMS.timer(v.checked_in_at, null, v.expected_end)}<button class="primary" type="button">Take ID &amp; give tag</button></div>
    </div>`;
  }
  function outCard(v) {
    return `<div class="vcard clickable" data-id="${v.id}" data-act="checkout">
      ${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}
      <div class="main"><div class="name">${esc(v.visitor_name)}</div><div class="meta">${esc(v.id_type || 'No ID held')} · ${VMS.STATUS_LABEL[v.status]}</div></div>
      <div class="actions">${VMS.timer(v.checked_in_at, null, v.expected_end)}<button type="button">Check out</button></div>
    </div>`;
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-act]');
    if (!c) return;
    const v = onsite.find(x => x.id === Number(c.dataset.id));
    if (!v) return;
    if (c.dataset.act === 'exchange') exchange(v); else checkout(v);
  });

  // ---- ID exchange ---------------------------------------------------------
  function exchange(v) {
    modal(`
      <h3>${esc(v.visitor_name)}</h3>
      <div class="bigtag ${VMS.isVipTag(v) ? 'vip' : ''}"><div class="label">Hand over tag</div><div class="num" id="tn">${esc(v.tag_number)}</div></div>
      <form id="xf" style="margin-top:1rem">
        <div class="form-grid">
          <div class="field"><label>Government ID received *</label><select name="id_type" required><option value="">Choose…</option>
            ${me.idTypes.filter(t => t !== 'Not required (VIP)' || v.visitor_type === 'vip').map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Last 4 characters of ID no. (optional)</label><input name="id_last4" maxlength="4" pattern="[A-Za-z0-9]{2,4}" autocomplete="off"></div>
        </div>
        <p class="small muted">Place the ID in tray slot <b>${esc(v.tag_number)}</b>. Only the last 4 characters are recorded — never the full ID number.</p>
        <div class="foot">
          <button type="button" id="swap">Tag missing? Assign another</button>
          <button type="button" data-close>Cancel</button>
          <button class="success big">ID received — tag handed over</button>
        </div>
      </form>`, {
      onOpen: (m, close) => {
        $('#swap', m).addEventListener('click', e => act(e.target, async () => {
          const nv = await post(`/visits/${v.id}/retag`, { mark_lost: true });
          v.tag_number = nv.tag_number; $('#tn', m).textContent = nv.tag_number;
          toast(`Tag ${nv.tag_number} assigned instead (old tag marked missing).`, 'ok');
        }));
        $('#xf', m).addEventListener('submit', e => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.target));
          act(e.submitter, async () => {
            await post(`/visits/${v.id}/id-exchange`, f);
            toast(`${v.visitor_name} tagged (${v.tag_number}). Direct them to the Main Building.`, 'ok');
            close(); refresh();
          });
        });
      },
    });
  }

  // ---- check-out -------------------------------------------------------------
  function checkout(v) {
    modal(`
      <h3>Check out ${esc(v.visitor_name)}</h3>
      <dl class="kv">
        <dt>Tag</dt><dd>${esc(v.tag_number)}</dd>
        <dt>ID held</dt><dd>${esc(v.id_type || 'None')}${v.id_last4 ? ` · ends <span class="mono">${esc(v.id_last4)}</span>` : ''}</dd>
        <dt>Time on site</dt><dd>${VMS.timer(v.checked_in_at)} (in at ${VMS.fmtTime(v.checked_in_at)})</dd>
      </dl>
      ${v.id_type && v.id_type !== 'Not required (VIP)' ? `<label class="check"><input type="checkbox" id="idback"> Tag <b>${esc(v.tag_number)}</b> collected and the visitor's <b>${esc(v.id_type)}</b> handed back.</label>` : ''}
      <label class="check" style="margin-top:.5rem"><input type="checkbox" id="lost"> Visitor did not return the tag (mark tag as lost)</label>
      <div class="foot"><button data-close type="button">Cancel</button><button id="go" class="primary big">Check out</button></div>`, {
      onOpen: (m, close) => {
        const needId = !!$('#idback', m);
        const sync = () => { $('#go', m).disabled = needId && !$('#idback', m).checked; };
        if (needId) $('#idback', m).addEventListener('change', sync); sync();
        $('#go', m).addEventListener('click', e => act(e.target, async () => {
          const nv = await post(`/visits/${v.id}/checkout`, { id_returned: needId ? $('#idback', m).checked : false, tag_lost: $('#lost', m).checked });
          toast(`${v.visitor_name} checked out after ${VMS.duration(new Date(nv.checked_out_at) - new Date(nv.checked_in_at))}.`, 'ok');
          close(); $('#q').value = ''; renderOut(); refresh();
        }));
      },
    });
  }

  function renderOut() {
    const q = $('#q').value.trim().toLowerCase();
    if (!q) { $('#outResults').innerHTML = ''; return; }
    const hits = onsite.filter(v => v.status !== 'checked_in' && ((v.tag_number || '').toLowerCase() === q || (v.tag_number || '').toLowerCase().replace(/^0+/, '') === q.replace(/^0+/, '') || v.visitor_name.toLowerCase().includes(q)));
    $('#outResults').innerHTML = hits.length ? hits.map(outCard).join('') : '<div class="empty">No visitor on site matches.</div>';
  }
  $('#q').addEventListener('input', renderOut);
  $('#q').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = $('#outResults [data-act]'); if (first) first.click(); }
  });

  async function refresh() {
    const rows = await get('/visits?scope=onsite').catch(() => null);
    if (!rows) return;
    onsite = rows.filter(v => ON_SITE.includes(v.status));
    const queue = onsite.filter(v => v.status === 'checked_in').sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at));
    const tray = onsite.filter(v => v.status !== 'checked_in').sort((a, b) => (a.tag_number || '').localeCompare(b.tag_number || ''));
    $('#nQueue').textContent = queue.length; $('#nTray').textContent = tray.length;
    $('#queue').innerHTML = queue.length ? queue.map(queueCard).join('') : '<div class="empty">No one waiting. New arrivals appear here automatically.</div>';
    $('#tray').innerHTML = tray.map(v => `<tr>
      <td><b>${esc(v.tag_number)}</b></td><td>${esc(v.visitor_name)}</td><td>${esc(v.id_type || '—')}</td>
      <td>${VMS.statusBadge(v.status)}</td><td>${VMS.timer(v.checked_in_at, null, v.expected_end)}</td>
      <td><button type="button" data-act="checkout" data-id="${v.id}">Check out</button></td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">No IDs held.</td></tr>';
    renderOut();
  }
  VMS.live(e => { if (e && e.action === 'granted') toast('New visitor on the way to your desk.'); refresh(); });
})();
