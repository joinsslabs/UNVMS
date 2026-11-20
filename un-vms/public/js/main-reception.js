'use strict';
(async () => {
  const { $, esc, get, post, act, toast } = VMS;
  const me = await VMS.boot({ roles: ['main_reception'], title: 'Reception — Main Building', sub: 'Station 3 · Host notification & meetings' });
  if (!me) return;

  let rows = [];
  const seen = new Set();

  function incomingCard(v) {
    const fresh = !seen.has(v.id); seen.add(v.id);
    const body = v.purpose === 'meeting'
      ? `<div class="meetingbox" style="margin-top:.5rem"><div class="title">${esc(v.meeting_title)}</div>
           <div><b>${esc(v.meeting_room)}</b>${v.meeting_directions ? ` — ${esc(v.meeting_directions)}` : ''}</div>
           <div class="small muted">${VMS.fmtLocal(v.meeting_starts_at)}–${VMS.fmtLocal(v.meeting_ends_at)} · Organizer: ${esc(v.host_name)}</div></div>`
      : `<div class="hostbox" style="margin-top:.5rem"><div><b>One-on-one with ${esc(v.host_name)}</b>${v.host_department ? ` · ${esc(v.host_department)}` : ''}</div>
           <div class="small">${v.host_extension ? `Ext. <b>${esc(v.host_extension)}</b> · ` : ''}${v.host_phone ? `Phone <b>${esc(v.host_phone)}</b>` : ''}${!v.host_email ? ' · <span style="color:var(--bad)">no email on file</span>' : ''}</div></div>`;
    const actions = v.purpose === 'meeting'
      ? `<button class="success" data-do="to-meeting" data-id="${v.id}">✓ Directed to meeting</button>`
      : `${VMS.telLink(v)}<button class="primary" data-do="arrived" data-id="${v.id}">✉ Arrived — email host</button>
         <button data-do="picked-up" data-id="${v.id}">Host is here</button>`;
    return `<div class="vcard ${fresh ? 'flash' : ''}" style="align-items:flex-start">
      ${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}
      <div class="main"><div class="name">${esc(v.visitor_name)} ${VMS.typeBadge(v.visitor_type)}</div>
        <div class="meta">${esc(v.organization || '')} · on site ${VMS.timer(v.checked_in_at, null, v.expected_end)}</div>
        ${body}
        <div class="actions" style="justify-content:flex-start;margin-top:.6rem">${actions}</div></div>
    </div>`;
  }
  function waitingCard(v) {
    return `<div class="vcard">
      ${VMS.tagChip(v.tag_number, VMS.isVipTag(v))}
      <div class="main"><div class="name">${esc(v.visitor_name)}</div>
        <div class="meta">for ${VMS.hostLine(v)} · ${v.host_notified_at ? `emailed ${VMS.fmtTime(v.host_notified_at)}` : 'not emailed'}${v.host_called_at ? ` · called ${VMS.fmtTime(v.host_called_at)}` : ''}</div></div>
      <div class="actions"><span class="small muted">waiting</span> ${VMS.timer(v.arrived_main_at)}
        ${VMS.telLink(v)}<button class="success" data-do="picked-up" data-id="${v.id}">Host picked up</button></div>
    </div>`;
  }

  document.addEventListener('click', e => {
    const call = e.target.closest('[data-call]');
    if (call) { post(`/visits/${call.dataset.call}/host-called`).then(refresh).catch(() => {}); return; } // let the tel: link proceed
    const b = e.target.closest('[data-do]');
    if (!b) return;
    const v = rows.find(x => x.id === Number(b.dataset.id));
    act(b, async () => {
      const nv = await post(`/visits/${b.dataset.id}/${b.dataset.do}`);
      if (b.dataset.do === 'arrived') toast(nv.host_email ? `Email sent to ${nv.host_name}.` : `${nv.host_name} has no email — please call.`, nv.host_email ? 'ok' : 'err');
      else if (b.dataset.do === 'to-meeting') toast(`${v.visitor_name} directed to ${v.meeting_room}.`, 'ok');
      else toast(`${v.visitor_name} is with their host.`, 'ok');
      refresh();
    });
  });

  async function refresh() {
    const [onsite, meetings] = await Promise.all([get('/visits?scope=onsite'), get('/meetings?date=' + VMS.today())]).catch(() => [null, null]);
    if (!onsite) return;
    rows = onsite;
    const incoming = rows.filter(v => v.status === 'tagged').sort((a, b) => (a.id_received_at || '').localeCompare(b.id_received_at || ''));
    const waiting = rows.filter(v => v.status === 'arrived').sort((a, b) => a.arrived_main_at.localeCompare(b.arrived_main_at));
    const inside = rows.filter(v => ['in_meeting', 'with_host'].includes(v.status));
    $('#nIncoming').textContent = incoming.length; $('#nWaiting').textContent = waiting.length; $('#nIn').textContent = inside.length;
    $('#incoming').innerHTML = incoming.length ? incoming.map(incomingCard).join('') : '<div class="empty">No one on the way. Tagged visitors appear here automatically.</div>';
    $('#waiting').innerHTML = waiting.length ? waiting.map(waitingCard).join('') : '<div class="empty">No one waiting.</div>';
    $('#inside').innerHTML = inside.map(v => `<tr><td><b>${esc(v.tag_number)}</b></td><td>${esc(v.visitor_name)}</td>
      <td>${v.status === 'in_meeting' ? `${esc(v.meeting_title)} · ${esc(v.meeting_room)}` : esc(v.host_name)}</td>
      <td>${VMS.fmtTime(v.picked_up_at || v.directed_meeting_at)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nobody yet.</td></tr>';
    $('#meetings').innerHTML = meetings.length ? meetings.map(m => `<div class="meetingbox">
      <div class="row"><div class="grow"><div class="title">${esc(m.title)}</div>
        <div><b>${esc(m.room)}</b>${m.directions ? ` — ${esc(m.directions)}` : ''}</div>
        <div class="small muted">${VMS.fmtLocal(m.starts_at)}–${VMS.fmtLocal(m.ends_at)} · Organizer ${esc(m.host_name)}</div></div>
        <div style="text-align:right"><div style="font-size:1.5rem;font-weight:800">${m.arrived}/${m.invited}</div><div class="small muted">arrived</div></div></div>
    </div>`).join('') : '<div class="empty">No meetings today.</div>';
  }
  VMS.live(e => { if (e && e.action === 'tagged') toast('A visitor is on the way to Main Building.'); refresh(); });
})();
