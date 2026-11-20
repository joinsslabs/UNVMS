'use strict';
(async () => {
  const { $, esc, get, post, act, modal, toast } = VMS;
  const me = await VMS.boot({ roles: ['reception1'], title: 'Reception — Access Control Building', sub: 'Station 1 · Identity check & access' });
  if (!me) return;

  let hosts = [];
  get('/hosts').then(h => { hosts = h; });

  const visitLine = v => v.purpose === 'meeting'
    ? `Meeting: ${esc(v.meeting_title)} · ${esc(v.meeting_room)}`
    : `Host: ${VMS.hostLine(v)}`;

  function card(v, { click = false } = {}) {
    const actionable = v.status === 'expected';
    return `<div class="vcard ${click ? 'clickable' : ''}" data-id="${v.id}">
      ${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}
      <div class="main">
        <div class="name">${esc(v.visitor_name)} ${VMS.typeBadge(v.visitor_type)} ${VMS.purposeBadge(v)}</div>
        <div class="meta">${esc(v.organization || '')}${v.organization ? ' · ' : ''}${visitLine(v)} · Expected ${VMS.fmtLocal(v.expected_at)}</div>
      </div>
      <div class="actions">
        ${v.checked_in_at && v.status !== 'checked_out' ? VMS.timer(v.checked_in_at, null, v.expected_end) : ''}
        ${VMS.statusBadge(v.status)}
        ${click && actionable ? '<button class="primary" type="button">Verify &amp; grant</button>' : ''}
      </div>
    </div>`;
  }
  const empty = msg => `<div class="empty">${msg}</div>`;

  // ---- search ------------------------------------------------------------
  let searchSeq = 0;
  async function search() {
    const q = $('#q').value.trim();
    const seq = ++searchSeq;
    if (q.length < 2) { $('#results').innerHTML = ''; return; }
    const rows = await get('/visits/search?q=' + encodeURIComponent(q)).catch(e => { toast(e.message, 'err'); return []; });
    if (seq !== searchSeq) return;
    $('#results').innerHTML = rows.length ? rows.map(v => card(v, { click: true })).join('')
      : empty(`No booking today for “${esc(q)}”. Check the spelling, or register a walk-in.`);
  }
  let t; $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 200); });

  document.addEventListener('click', e => {
    const c = e.target.closest('.vcard.clickable');
    if (c) openVisit(Number(c.dataset.id));
  });

  // ---- verify & grant ------------------------------------------------------
  async function openVisit(id) {
    const v = await get('/visits/' + id);
    if (v.status !== 'expected') {
      const why = v.status === 'pending' ? 'This visit is still waiting for approval. Ask the visitor to wait; this screen updates automatically when it is approved.'
        : v.status === 'rejected' ? 'This visit was rejected' + (v.rejected_reason ? `: ${v.rejected_reason}` : '.')
        : `This visitor is already ${VMS.STATUS_LABEL[v.status].toLowerCase()}${v.tag_number ? ` (tag ${v.tag_number})` : ''}.`;
      return modal(`<h3>${esc(v.visitor_name)}</h3><p>${esc(why)}</p><div class="foot"><button data-close class="primary">OK</button></div>`);
    }
    modal(`
      <h3>Verify identity</h3>
      <dl class="kv">
        <dt>Visitor</dt><dd>${esc(v.visitor_name)} ${VMS.typeBadge(v.visitor_type)}</dd>
        <dt>Organization</dt><dd>${esc(v.organization || '—')}</dd>
        <dt>${v.purpose === 'meeting' ? 'Meeting' : 'Host'}</dt><dd>${v.purpose === 'meeting' ? `${esc(v.meeting_title)}<br><span class="muted">${esc(v.meeting_room)} · ${VMS.fmtLocal(v.meeting_starts_at)}–${VMS.fmtLocal(v.meeting_ends_at)}</span>` : VMS.hostLine(v)}</dd>
        <dt>Expected</dt><dd>${VMS.fmtLocal(v.expected_at)} – ${VMS.fmtLocal(v.expected_end)}</dd>
        <dt>Reference</dt><dd class="mono">${esc(v.ref)}</dd>
        ${v.notes ? `<dt>Notes</dt><dd>${esc(v.notes)}</dd>` : ''}
      </dl>
      <label class="check"><input type="checkbox" id="idok"> I have seen the visitor's photo ID and confirmed they are <b>${esc(v.visitor_name)}</b>.</label>
      <div class="foot"><button data-close type="button">Cancel</button><button id="grant" class="success big" disabled>Grant access &amp; assign tag</button></div>`, {
      onOpen: (m, close) => {
        $('#idok', m).addEventListener('change', e => { $('#grant', m).disabled = !e.target.checked; });
        $('#grant', m).addEventListener('click', e => act(e.target, async () => {
          const nv = await post(`/visits/${v.id}/grant`, { identity_confirmed: true });
          close(); showTag(nv); $('#q').value = ''; $('#results').innerHTML = '';
          refresh();
        }));
      },
    });
  }

  function showTag(v) {
    modal(`
      <h3>Access granted — ${esc(v.visitor_name)}</h3>
      <div class="bigtag"><div class="label">Visitor tag number</div><div class="num" id="tagnum">${esc(v.tag_number)}</div>
        <div class="small">Clock started ${VMS.fmtTime(v.checked_in_at)} · ${VMS.timer(v.checked_in_at)}</div></div>
      <p>Direct the visitor to the <b>Documentation &amp; Tagging desk</b>. They will hand over their government ID and receive tag <b id="tagnum2">${esc(v.tag_number)}</b>.</p>
      <div class="foot"><button id="retag" type="button">Assign a different number</button><button data-close class="primary big">Done</button></div>`, {
      onOpen: m => {
        $('#retag', m).addEventListener('click', e => act(e.target, async () => {
          const nv = await post(`/visits/${v.id}/retag`, {});
          $('#tagnum', m).textContent = nv.tag_number; $('#tagnum2', m).textContent = nv.tag_number;
          toast(`New tag: ${nv.tag_number}`, 'ok');
        }));
      },
    });
  }

  // ---- walk-in -------------------------------------------------------------
  $('#walkin').addEventListener('click', () => {
    modal(`
      <h3>Register a walk-in visitor</h3>
      <p class="small muted">Walk-ins need approval from Common Services before access is granted. The approver is alerted immediately.</p>
      <form id="wf">
        <div class="field"><label>Full name *</label><input name="visitor_name" required value="${esc($('#q').value)}"></div>
        <div class="form-grid">
          <div class="field"><label>Organization</label><input name="organization"></div>
          <div class="field"><label>Phone</label><input name="phone" inputmode="tel"></div>
        </div>
        <div class="field"><label>Person they are visiting *</label><select name="host_id" required><option value="">Choose…</option>
          ${hosts.map(h => `<option value="${h.id}">${esc(h.name)}${h.department ? ' — ' + esc(h.department) : ''}</option>`).join('')}</select></div>
        <div class="field"><label>Purpose / notes</label><input name="notes"></div>
        <div class="foot"><button type="button" data-close>Cancel</button><button class="primary">Send for approval</button></div>
      </form>`, {
      onOpen: (m, close) => $('#wf', m).addEventListener('submit', e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        act(e.submitter, async () => { await post('/visits', f); toast('Walk-in sent for approval.', 'ok'); close(); refresh(); });
      }),
    });
  });

  // ---- live lists ------------------------------------------------------------
  async function refresh() {
    const rows = await get('/visits?scope=today').catch(() => null);
    if (!rows) return;
    const expected = rows.filter(v => v.status === 'expected' && v.visitor_type !== 'vip');
    const sent = rows.filter(v => v.status === 'checked_in' && v.gate === 'reception1');
    const pending = rows.filter(v => v.status === 'pending');
    $('#nExpected').textContent = expected.length; $('#nSent').textContent = sent.length; $('#nPending').textContent = pending.length;
    $('#expected').innerHTML = expected.length ? expected.map(v => card(v, { click: true })).join('') : empty('Everyone expected has arrived.');
    $('#sent').innerHTML = sent.length ? sent.map(v => card(v)).join('') : empty('Nobody waiting at Documentation.');
    $('#pending').innerHTML = pending.length ? pending.map(v => card(v, { click: true })).join('') : empty('No walk-ins waiting.');
    if ($('#q').value.trim().length >= 2) search();
  }
  VMS.live(e => { if (e && e.action === 'approved') toast('A walk-in was approved.', 'ok'); refresh(); });
  $('#q').focus();
})();
