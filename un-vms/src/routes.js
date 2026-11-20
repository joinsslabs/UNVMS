'use strict';
const crypto = require('node:crypto');
const express = require('express');
const config = require('./config');
const { db, tx } = require('./db');
const { localDate, localDateTime, addMinutesLocal, nowIso, newRef, audit, HttpError, str, LOCAL_DT } = require('./util');
const auth = require('./auth');
const events = require('./events');
const mailer = require('./mailer');

const r = express.Router();
const { requireRole } = auth;
const wrap = fn => (req, res, next) => { try { const out = fn(req, res); if (out !== undefined) res.json(out); } catch (e) { next(e); } };

const ON_SITE = ['checked_in', 'tagged', 'arrived', 'in_meeting', 'with_host'];
const VISITOR_TYPES = ['guest', 'vip', 'contractor', 'vendor', 'walk_in'];
const ID_TYPES = ['NIN slip / card', "Driver's licence", 'International passport', "Permanent voter's card", 'Other government ID', 'Not required (VIP)'];

// ----------------------------------------------------------------------------
// Visit read model
// ----------------------------------------------------------------------------
const VISIT_SELECT = `
  SELECT v.*,
         h.name AS host_name, h.email AS host_email, h.phone AS host_phone, h.extension AS host_extension, h.department AS host_department,
         m.title AS meeting_title, m.room AS meeting_room, m.directions AS meeting_directions, m.starts_at AS meeting_starts_at, m.ends_at AS meeting_ends_at,
         a.name AS approved_by_name, c.name AS created_by_name
  FROM visits v
  LEFT JOIN users h ON h.id = v.host_id
  LEFT JOIN meetings m ON m.id = v.meeting_id
  LEFT JOIN users a ON a.id = v.approved_by
  LEFT JOIN users c ON c.id = v.created_by`;

const getVisitStmt = db.prepare(`${VISIT_SELECT} WHERE v.id = ?`);
function getVisit(id) {
  const v = getVisitStmt.get(Number(id));
  if (!v) throw new HttpError(404, 'Visit not found.');
  return v;
}
/** Hosts only see their own visitors; everyone else sees all. */
function assertCanSee(req, v) {
  if (req.user.role === 'host' && v.host_id !== req.user.id && v.created_by !== req.user.id) throw new HttpError(404, 'Visit not found.');
}
function changed(v, action) {
  events.publish('visit', { id: v.id, action, status: v.status, hostId: v.host_id });
}
function setStatus(id, fields) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE visits SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .run(...keys.map(k => fields[k]), nowIso(), id);
}
function requireStatus(v, allowed, verb) {
  if (!allowed.includes(v.status)) throw new HttpError(409, `Cannot ${verb}: visit is currently "${v.status.replace('_', ' ')}".`);
}

// ----------------------------------------------------------------------------
// Tags — random allocation from the free pool
// ----------------------------------------------------------------------------
function allocateTag(visitId, pool) {
  const free = db.prepare("SELECT number FROM tags WHERE pool = ? AND status = 'available'").all(pool);
  if (!free.length) throw new HttpError(409, `No ${pool === 'vip' ? 'VIP ' : ''}visitor tags are free. Check tags back in or add more tags.`);
  const pick = free[crypto.randomInt(free.length)].number;
  db.prepare("UPDATE tags SET status = 'in_use', visit_id = ? WHERE number = ?").run(visitId, pick);
  return pick;
}
function releaseTag(number) {
  if (number) db.prepare("UPDATE tags SET status = 'available', visit_id = NULL WHERE number = ? AND status = 'in_use'").run(number);
}

// ----------------------------------------------------------------------------
// Session
// ----------------------------------------------------------------------------
r.post('/login', wrap((req, res) => { const u = auth.login(req, res); req.user = u; audit(req, 'login'); return u; }));
r.post('/logout', wrap((req, res) => { if (req.user) audit(req, 'logout'); auth.destroySession(req, res); return { ok: true }; }));
r.get('/me', requireRole(), wrap(req => ({ ...req.user, idTypes: ID_TYPES, visitorTypes: VISITOR_TYPES, orgName: config.orgName, mailEnabled: mailer.enabled() })));
r.post('/me/password', requireRole(), wrap(req => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!auth.verifyPassword(String(req.body.current || ''), row.password_hash)) throw new HttpError(400, 'Current password is incorrect.');
  auth.validatePassword(req.body.next);
  db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(auth.hashPassword(req.body.next), req.user.id);
  audit(req, 'password.change');
  return { ok: true };
}));

r.get('/stream', requireRole(), (req, res) => events.subscribe(req, res));

// ----------------------------------------------------------------------------
// Visits — listing & search
// ----------------------------------------------------------------------------
r.get('/visits', requireRole(), wrap(req => {
  const scope = String(req.query.scope || 'today');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : localDate();
  const where = [];
  const args = [];
  if (scope === 'today') { where.push('v.expected_at LIKE ?'); args.push(date + '%'); }
  else if (scope === 'onsite') { where.push(`v.status IN (${ON_SITE.map(() => '?').join(',')})`); args.push(...ON_SITE); }
  else if (scope === 'pending') { where.push("v.status = 'pending'"); }
  else if (scope === 'upcoming') { where.push('v.expected_at >= ?'); args.push(date); }
  else if (scope === 'checkedout') { where.push("v.status = 'checked_out' AND v.checked_out_at >= ?"); args.push(new Date(new Date(date + 'T00:00').getTime()).toISOString()); }
  if (req.query.status) {
    const st = String(req.query.status).split(',');
    where.push(`v.status IN (${st.map(() => '?').join(',')})`); args.push(...st);
  }
  if (req.query.q) {
    const q = `%${String(req.query.q).trim()}%`;
    where.push('(v.visitor_name LIKE ? OR v.organization LIKE ? OR v.ref LIKE ? OR v.tag_number = ?)');
    args.push(q, q, q, String(req.query.q).trim().toUpperCase());
  }
  if (req.user.role === 'host') { where.push('(v.host_id = ? OR v.created_by = ?)'); args.push(req.user.id, req.user.id); }
  const sql = `${VISIT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.expected_at ASC, v.visitor_name ASC LIMIT 1000`;
  return db.prepare(sql).all(...args);
}));

/** Name search used at Reception 1 and the VIP gate: today's bookings only. */
r.get('/visits/search', requireRole('reception1', 'vip', 'documentation', 'main_reception', 'manager'), wrap(req => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  return db.prepare(`${VISIT_SELECT}
    WHERE v.expected_at LIKE ? AND (v.visitor_name LIKE ? OR v.ref LIKE ? OR v.organization LIKE ? OR v.tag_number = ?)
    ORDER BY CASE v.status WHEN 'expected' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, v.expected_at LIMIT 25`)
    .all(localDate() + '%', like, like, like, q.toUpperCase());
}));

r.get('/visits/:id', requireRole(), wrap(req => { const v = getVisit(req.params.id); assertCanSee(req, v); return v; }));

// ----------------------------------------------------------------------------
// Visits — registration
// ----------------------------------------------------------------------------
function normaliseVisitInput(req, b) {
  const visitor_name = str(b.visitor_name, 120);
  if (!visitor_name) throw new HttpError(400, 'Visitor name is required.');
  const visitor_type = VISITOR_TYPES.includes(b.visitor_type) ? b.visitor_type : 'guest';
  const purpose = b.purpose === 'meeting' ? 'meeting' : 'one_on_one';
  let meeting = null;
  if (purpose === 'meeting') {
    if (!b.meeting_id) throw new HttpError(400, 'Choose the meeting this visitor is attending.');
    meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(Number(b.meeting_id));
    if (!meeting) throw new HttpError(400, 'Meeting not found.');
  }
  let host_id = Number(b.host_id) || (meeting ? meeting.host_id : null);
  if (req.user.role === 'host') host_id = req.user.id;
  if (!host_id) throw new HttpError(400, 'Choose the staff member hosting this visitor.');
  const host = db.prepare("SELECT id, name, email FROM users WHERE id = ? AND active = 1").get(host_id);
  if (!host) throw new HttpError(400, 'Host not found.');

  let expected_at = b.expected_at || (meeting ? meeting.starts_at : localDateTime());
  if (!LOCAL_DT.test(expected_at)) throw new HttpError(400, 'Expected time must be YYYY-MM-DDTHH:MM.');
  let expected_end = b.expected_end || (meeting ? meeting.ends_at : addMinutesLocal(expected_at, config.defaultVisitMinutes));
  if (!LOCAL_DT.test(expected_end) || expected_end <= expected_at) throw new HttpError(400, 'End time must be after the start time.');
  const email = str(b.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, `Invalid email for ${visitor_name}.`);

  return {
    visitor_name, visitor_type, purpose, host, meeting, expected_at, expected_end, email,
    organization: str(b.organization, 120), phone: str(b.phone, 40), notes: str(b.notes, 500),
    meeting_id: meeting ? meeting.id : null, host_id,
  };
}

function needsApproval(req, input) {
  // Walk-ins registered at a desk and contractors go to an independent approver.
  if (['admin', 'manager'].includes(req.user.role)) return false;
  return config.approvalTypes.includes(input.visitor_type);
}

function createVisit(req, b) {
  const input = normaliseVisitInput(req, b);
  const status = needsApproval(req, input) ? 'pending' : 'expected';
  let ref;
  do { ref = newRef(); } while (db.prepare('SELECT 1 FROM visits WHERE ref = ?').get(ref));
  const auto = ['admin', 'manager'].includes(req.user.role) && status === 'expected';
  const info = db.prepare(`INSERT INTO visits(ref, visitor_name, organization, phone, email, visitor_type, purpose, host_id, meeting_id,
      expected_at, expected_end, notes, status, created_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ref, input.visitor_name, input.organization, input.phone, input.email, input.visitor_type, input.purpose, input.host_id,
      input.meeting_id, input.expected_at, input.expected_end, input.notes, status, req.user.id, auto ? req.user.id : null, auto ? nowIso() : null);
  const v = getVisit(info.lastInsertRowid);
  audit(req, 'visit.create', v.id, { ref: v.ref, status: v.status, type: v.visitor_type });
  return { v, input };
}

function afterCreate(v, input, sendInvite) {
  if (v.status === 'expected' && sendInvite && v.email) mailer.sendMail(mailer.visitorInvitationEmail(v, input.host, input.meeting));
  if (v.status === 'pending') {
    for (const ap of db.prepare("SELECT name, email FROM users WHERE role IN ('manager') AND active = 1 AND email IS NOT NULL AND id <> ?").all(v.created_by)) {
      mailer.sendMail(mailer.approvalNeededEmail(v, ap));
    }
  }
  changed(v, 'created');
}

r.post('/visits', requireRole('host', 'manager', 'reception1', 'vip'), wrap(req => {
  const b = { ...req.body };
  // Desk staff registering someone who just turned up => walk-in (needs approval), unless VIP gate.
  if (req.user.role === 'reception1' && b.visitor_type !== 'vip') b.visitor_type = 'walk_in';
  if (req.user.role === 'vip') b.visitor_type = 'vip';
  const { v, input } = createVisit(req, b);
  afterCreate(v, input, b.send_invite !== false);
  return v;
}));

r.post('/visits/bulk', requireRole('host', 'manager'), wrap(req => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 500) : [];
  if (!rows.length) throw new HttpError(400, 'No rows to import.');
  const created = []; const errors = [];
  rows.forEach((row, i) => {
    try {
      const b = { ...row };
      if (!b.host_id && (b.host_email || b.host_username)) {
        const h = db.prepare('SELECT id FROM users WHERE (lower(email) = lower(?) OR lower(username) = lower(?)) AND active = 1')
          .get(String(b.host_email || ''), String(b.host_username || b.host_email || ''));
        if (h) b.host_id = h.id;
      }
      if (b.date && b.time && !b.expected_at) b.expected_at = `${b.date}T${String(b.time).padStart(5, '0')}`;
      const { v, input } = createVisit(req, b);
      afterCreate(v, input, req.body.send_invite !== false);
      created.push(v.id);
    } catch (e) { errors.push({ row: i + 1, error: e.message }); }
  });
  return { created: created.length, errors };
}));

// ----------------------------------------------------------------------------
// Approval workflow — nobody approves their own request
// ----------------------------------------------------------------------------
function assertIndependent(req, v) {
  if (req.user.role !== 'admin' && (v.created_by === req.user.id || v.host_id === req.user.id)) {
    audit(req, 'approval.refused.self', v.id);
    throw new HttpError(403, 'You cannot approve a visit you requested or are hosting.');
  }
}
r.post('/visits/:id/approve', requireRole('manager'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['pending'], 'approve');
  assertIndependent(req, v);
  setStatus(v.id, { status: 'expected', approved_by: req.user.id, approved_at: nowIso() });
  audit(req, 'visit.approve', v.id);
  const nv = getVisit(v.id);
  if (nv.email) mailer.sendMail(mailer.visitorInvitationEmail(nv, { name: nv.host_name }, nv.meeting_id ? { title: nv.meeting_title, room: nv.meeting_room } : null));
  changed(nv, 'approved');
  return nv;
}));
r.post('/visits/:id/reject', requireRole('manager'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['pending', 'expected'], 'reject');
  assertIndependent(req, v);
  setStatus(v.id, { status: 'rejected', approved_by: req.user.id, approved_at: nowIso(), rejected_reason: str(req.body.reason, 300) });
  audit(req, 'visit.reject', v.id, { reason: req.body.reason });
  const nv = getVisit(v.id); changed(nv, 'rejected'); return nv;
}));
r.post('/visits/:id/cancel', requireRole('host', 'manager'), wrap(req => {
  const v = getVisit(req.params.id);
  assertCanSee(req, v);
  requireStatus(v, ['pending', 'expected'], 'cancel');
  setStatus(v.id, { status: 'cancelled' });
  audit(req, 'visit.cancel', v.id);
  const nv = getVisit(v.id); changed(nv, 'cancelled'); return nv;
}));

// ----------------------------------------------------------------------------
// Station 1 — Reception, Access Control building: confirm identity, grant access
// ----------------------------------------------------------------------------
function grant(req, v, pool, gate) {
  requireStatus(v, ['expected'], 'grant access');
  if (!v.expected_at.startsWith(localDate())) throw new HttpError(409, `This visit is booked for ${v.expected_at.slice(0, 10)}, not today.`);
  if (req.body.identity_confirmed !== true) throw new HttpError(400, 'Confirm that you have checked the visitor\'s identity.');
  const tag = allocateTag(v.id, pool);
  setStatus(v.id, { status: 'checked_in', gate, checked_in_at: nowIso(), checked_in_by: req.user.id, tag_number: tag });
  audit(req, 'visit.grant', v.id, { tag, gate });
  return tag;
}
r.post('/visits/:id/grant', requireRole('reception1'), wrap(req => {
  const v = getVisit(req.params.id);
  tx(() => grant(req, v, 'standard', 'reception1'));
  const nv = getVisit(v.id); changed(nv, 'granted'); return nv;
}));

/** Swap the randomly assigned tag (e.g. that physical tag is missing or damaged). */
r.post('/visits/:id/retag', requireRole('reception1', 'documentation', 'vip'), wrap(req => {
  const v = getVisit(req.params.id);
  const allowed = req.user.role === 'documentation' || req.user.role === 'admin' ? ['checked_in', 'tagged'] : ['checked_in'];
  requireStatus(v, allowed, 'change the tag');
  tx(() => {
    const pool = v.tag_number && v.tag_number.startsWith(config.vipTagPrefix) && v.gate === 'vip' ? 'vip' : 'standard';
    if (req.body.mark_lost) db.prepare("UPDATE tags SET status = 'lost', visit_id = NULL WHERE number = ?").run(v.tag_number);
    else releaseTag(v.tag_number);
    const tag = allocateTag(v.id, pool);
    setStatus(v.id, { tag_number: tag });
    audit(req, 'visit.retag', v.id, { from: v.tag_number, to: tag, lost: !!req.body.mark_lost });
  });
  const nv = getVisit(v.id); changed(nv, 'retagged'); return nv;
}));

// ----------------------------------------------------------------------------
// Station 2 — Documentation & Tagging: hold government ID, hand over tag
// ----------------------------------------------------------------------------
function recordId(req, v, idType, last4) {
  if (!ID_TYPES.includes(idType)) throw new HttpError(400, 'Choose the type of ID collected.');
  if (last4 && !/^[A-Za-z0-9]{2,4}$/.test(last4)) throw new HttpError(400, 'Enter at most the last 4 characters of the ID number.');
  setStatus(v.id, { status: 'tagged', id_type: idType, id_last4: last4 || null, id_received_at: nowIso(), id_received_by: req.user.id });
  audit(req, 'visit.id_exchange', v.id, { idType, tag: v.tag_number });
}
r.post('/visits/:id/id-exchange', requireRole('documentation'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['checked_in'], 'record the ID exchange');
  recordId(req, v, req.body.id_type, str(req.body.id_last4, 4));
  const nv = getVisit(v.id); changed(nv, 'tagged'); return nv;
}));

// ----------------------------------------------------------------------------
// Station 3 — Main Building reception: notify host or direct to meeting
// ----------------------------------------------------------------------------
function notifyHostArrived(req, v) {
  const at = nowIso();
  setStatus(v.id, { status: 'arrived', arrived_main_at: at, host_notified_at: v.host_email ? at : null });
  const nv = getVisit(v.id);
  if (nv.host_email) mailer.sendMail(mailer.hostArrivalEmail(nv, { name: nv.host_name, email: nv.host_email }));
  audit(req, 'visit.arrived', v.id, { hostEmailed: !!nv.host_email });
  return nv;
}
r.post('/visits/:id/arrived', requireRole('main_reception'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['tagged'], 'mark as arrived');
  const nv = notifyHostArrived(req, v); changed(nv, 'arrived'); return nv;
}));
r.post('/visits/:id/host-called', requireRole('main_reception', 'vip'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['tagged', 'arrived'], 'log a call');
  const fields = { host_called_at: nowIso() };
  if (v.status === 'tagged') { fields.status = 'arrived'; fields.arrived_main_at = nowIso(); }
  setStatus(v.id, fields);
  audit(req, 'visit.host_called', v.id);
  const nv = getVisit(v.id); changed(nv, 'host_called'); return nv;
}));
r.post('/visits/:id/picked-up', requireRole('main_reception', 'host', 'vip'), wrap(req => {
  const v = getVisit(req.params.id);
  assertCanSee(req, v);
  requireStatus(v, ['tagged', 'arrived'], 'mark as picked up');
  setStatus(v.id, { status: 'with_host', picked_up_at: nowIso(), arrived_main_at: v.arrived_main_at || nowIso() });
  audit(req, 'visit.picked_up', v.id);
  const nv = getVisit(v.id); changed(nv, 'picked_up'); return nv;
}));
r.post('/visits/:id/to-meeting', requireRole('main_reception', 'vip'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ['tagged', 'arrived'], 'direct to the meeting');
  if (v.purpose !== 'meeting') throw new HttpError(409, 'This visitor is not booked for a meeting.');
  setStatus(v.id, { status: 'in_meeting', directed_meeting_at: nowIso(), arrived_main_at: v.arrived_main_at || nowIso() });
  audit(req, 'visit.to_meeting', v.id, { meeting: v.meeting_id });
  const nv = getVisit(v.id); changed(nv, 'in_meeting'); return nv;
}));

// ----------------------------------------------------------------------------
// Station 4 — VIP gate (tablet): one-step fast track
// ----------------------------------------------------------------------------
r.post('/visits/:id/vip-fast-track', requireRole('vip'), wrap(req => {
  const v = getVisit(req.params.id);
  tx(() => {
    grant(req, v, 'vip', 'vip');
    recordId(req, getVisit(v.id), req.body.id_type || 'Not required (VIP)', str(req.body.id_last4, 4));
    if (v.purpose === 'meeting') {
      setStatus(v.id, { status: 'in_meeting', directed_meeting_at: nowIso(), arrived_main_at: nowIso() });
      audit(req, 'visit.to_meeting', v.id, { meeting: v.meeting_id });
    }
  });
  // One-on-one VIPs: host is emailed immediately so they can come to the VIP gate.
  let nv = getVisit(v.id);
  if (nv.purpose !== 'meeting') nv = notifyHostArrived(req, nv);
  changed(nv, 'vip_fast_track');
  return nv;
}));

// ----------------------------------------------------------------------------
// Check-out — tag returned, government ID handed back, timer stops
// ----------------------------------------------------------------------------
r.post('/visits/:id/checkout', requireRole('documentation', 'vip', 'manager'), wrap(req => {
  const v = getVisit(req.params.id);
  requireStatus(v, ON_SITE, 'check out');
  if (v.id_type && v.id_type !== 'Not required (VIP)' && req.body.id_returned !== true) {
    throw new HttpError(400, 'Confirm the visitor\'s government ID has been returned.');
  }
  tx(() => {
    if (req.body.tag_lost) db.prepare("UPDATE tags SET status = 'lost', visit_id = NULL WHERE number = ?").run(v.tag_number);
    else releaseTag(v.tag_number);
    setStatus(v.id, { status: 'checked_out', checked_out_at: nowIso(), checked_out_by: req.user.id, id_returned: v.id_type ? 1 : 0 });
  });
  audit(req, 'visit.checkout', v.id, { tag: v.tag_number, tagLost: !!req.body.tag_lost });
  const nv = getVisit(v.id); changed(nv, 'checked_out'); return nv;
}));

// ----------------------------------------------------------------------------
// Staff directory, meetings, tags
// ----------------------------------------------------------------------------
r.get('/hosts', requireRole(), wrap(() =>
  db.prepare("SELECT id, name, department, extension, phone FROM users WHERE active = 1 AND role IN ('host','manager','admin') ORDER BY name").all()));

r.get('/users', requireRole('admin'), wrap(() =>
  db.prepare('SELECT id, username, name, email, phone, extension, department, role, active, must_change, created_at FROM users ORDER BY role, name').all()));
r.post('/users', requireRole('admin'), wrap(req => {
  const b = req.body;
  const username = str(b.username, 60); const name = str(b.name, 120);
  if (!username || !name) throw new HttpError(400, 'Username and name are required.');
  const roles = ['admin', 'manager', 'reception1', 'documentation', 'main_reception', 'vip', 'host'];
  if (!roles.includes(b.role)) throw new HttpError(400, 'Invalid role.');
  auth.validatePassword(b.password);
  try {
    const info = db.prepare('INSERT INTO users(username, name, email, phone, extension, department, role, password_hash) VALUES (?,?,?,?,?,?,?,?)')
      .run(username, name, str(b.email, 160), str(b.phone, 40), str(b.extension, 20), str(b.department, 80), b.role, auth.hashPassword(b.password));
    audit(req, 'user.create', null, { username, role: b.role });
    return { id: Number(info.lastInsertRowid) };
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'That username is taken.');
    throw e;
  }
}));
r.patch('/users/:id', requireRole('admin'), wrap(req => {
  const id = Number(req.params.id); const b = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) throw new HttpError(404, 'User not found.');
  const f = {};
  for (const k of ['name', 'email', 'phone', 'extension', 'department']) if (k in b) f[k] = str(b[k], 160);
  if ('active' in b) { if (id === req.user.id && !b.active) throw new HttpError(400, 'You cannot deactivate yourself.'); f.active = b.active ? 1 : 0; }
  if (b.role) f.role = b.role;
  if (b.password) { auth.validatePassword(b.password); f.password_hash = auth.hashPassword(b.password); f.must_change = 1; }
  const keys = Object.keys(f);
  if (keys.length) db.prepare(`UPDATE users SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map(k => f[k]), id);
  if (f.active === 0 || f.password_hash) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  audit(req, 'user.update', null, { id, fields: keys.filter(k => k !== 'password_hash').concat(f.password_hash ? ['password'] : []) });
  return { ok: true };
}));

r.get('/meetings', requireRole(), wrap(req => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;
  const where = date ? 'WHERE m.starts_at LIKE ?' : 'WHERE m.ends_at >= ?';
  return db.prepare(`SELECT m.*, h.name AS host_name,
      (SELECT COUNT(*) FROM visits v WHERE v.meeting_id = m.id AND v.status NOT IN ('cancelled','rejected')) AS invited,
      (SELECT COUNT(*) FROM visits v WHERE v.meeting_id = m.id AND v.status IN ('checked_in','tagged','arrived','in_meeting','with_host','checked_out')) AS arrived
    FROM meetings m JOIN users h ON h.id = m.host_id ${where} ORDER BY m.starts_at LIMIT 300`).all(date ? date + '%' : localDate());
}));
r.post('/meetings', requireRole('host', 'manager'), wrap(req => {
  const b = req.body;
  const title = str(b.title, 160); const room = str(b.room, 80);
  if (!title || !room) throw new HttpError(400, 'Meeting title and room are required.');
  if (!LOCAL_DT.test(b.starts_at || '') || !LOCAL_DT.test(b.ends_at || '') || b.ends_at <= b.starts_at) throw new HttpError(400, 'Enter a valid start and end time.');
  const host_id = req.user.role === 'host' ? req.user.id : Number(b.host_id) || req.user.id;
  const info = db.prepare('INSERT INTO meetings(title, room, directions, starts_at, ends_at, host_id, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(title, room, str(b.directions, 300), b.starts_at, b.ends_at, host_id, req.user.id);
  audit(req, 'meeting.create', null, { id: Number(info.lastInsertRowid), title });
  events.publish('meeting', { id: Number(info.lastInsertRowid) });
  return { id: Number(info.lastInsertRowid) };
}));

r.get('/tags', requireRole('manager', 'documentation', 'reception1', 'vip'), wrap(() => ({
  summary: db.prepare('SELECT pool, status, COUNT(*) AS n FROM tags GROUP BY pool, status').all(),
  inUse: db.prepare("SELECT t.number, t.pool, v.visitor_name, v.id AS visit_id FROM tags t JOIN visits v ON v.id = t.visit_id WHERE t.status = 'in_use' ORDER BY t.number").all(),
  lost: db.prepare("SELECT number, pool FROM tags WHERE status = 'lost' ORDER BY number").all(),
})));
r.post('/tags/:number/restore', requireRole('manager'), wrap(req => {
  db.prepare("UPDATE tags SET status = 'available', visit_id = NULL WHERE number = ? AND status IN ('lost','retired')").run(req.params.number);
  audit(req, 'tag.restore', null, { tag: req.params.number });
  return { ok: true };
}));

// ----------------------------------------------------------------------------
// Dashboard, reports, audit, export
// ----------------------------------------------------------------------------
r.get('/stats', requireRole('manager'), wrap(req => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : localDate();
  const like = date + '%';
  const nowLocal = localDateTime();
  const onSite = db.prepare(`SELECT status, COUNT(*) AS n FROM visits WHERE status IN (${ON_SITE.map(() => '?').join(',')}) GROUP BY status`).all(...ON_SITE);
  return {
    date,
    onSiteTotal: onSite.reduce((a, b) => a + b.n, 0),
    onSite,
    today: db.prepare('SELECT status, COUNT(*) AS n FROM visits WHERE expected_at LIKE ? GROUP BY status').all(like),
    byType: db.prepare("SELECT visitor_type AS k, COUNT(*) AS n FROM visits WHERE expected_at LIKE ? AND checked_in_at IS NOT NULL GROUP BY visitor_type").all(like),
    byDepartment: db.prepare("SELECT COALESCE(h.department,'—') AS k, COUNT(*) AS n FROM visits v LEFT JOIN users h ON h.id = v.host_id WHERE v.expected_at LIKE ? AND v.checked_in_at IS NOT NULL GROUP BY k ORDER BY n DESC").all(like),
    byGate: db.prepare("SELECT COALESCE(gate,'—') AS k, COUNT(*) AS n FROM visits WHERE expected_at LIKE ? AND checked_in_at IS NOT NULL GROUP BY gate").all(like),
    avgMinutesOnSite: db.prepare("SELECT ROUND(AVG((julianday(checked_out_at) - julianday(checked_in_at)) * 1440)) AS m FROM visits WHERE expected_at LIKE ? AND checked_out_at IS NOT NULL").get(like).m,
    avgMinutesToHost: db.prepare("SELECT ROUND(AVG((julianday(picked_up_at) - julianday(arrived_main_at)) * 1440), 1) AS m FROM visits WHERE expected_at LIKE ? AND picked_up_at IS NOT NULL AND arrived_main_at IS NOT NULL").get(like).m,
    overstays: db.prepare(`${VISIT_SELECT} WHERE v.status IN (${ON_SITE.map(() => '?').join(',')}) AND v.expected_end < ? ORDER BY v.expected_end`).all(...ON_SITE, nowLocal),
    waitingForHost: db.prepare(`${VISIT_SELECT} WHERE v.status = 'arrived' ORDER BY v.arrived_main_at`).all(),
    pending: db.prepare("SELECT COUNT(*) AS n FROM visits WHERE status = 'pending'").get().n,
    noShows: db.prepare("SELECT COUNT(*) AS n FROM visits WHERE status = 'expected' AND expected_end < ? AND expected_at LIKE ?").get(nowLocal, like).n,
    tags: db.prepare('SELECT pool, status, COUNT(*) AS n FROM tags GROUP BY pool, status').all(),
    mailFailures: db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed' AND ts >= ?").get(new Date(date + 'T00:00').toISOString()).n,
    liveScreens: events.count(),
  };
}));

r.get('/audit', requireRole('manager'), wrap(req => {
  const limit = Math.min(Number(req.query.limit) || 200, 2000);
  if (req.query.visit_id) return db.prepare('SELECT * FROM audit WHERE visit_id = ? ORDER BY id DESC').all(Number(req.query.visit_id));
  return db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(limit);
}));
r.get('/outbox', requireRole('manager'), wrap(() => db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 200').all()));

r.get('/export.csv', requireRole('manager'), (req, res, next) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : localDate();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : from;
    const rows = db.prepare(`${VISIT_SELECT} WHERE substr(v.expected_at,1,10) BETWEEN ? AND ? ORDER BY v.expected_at`).all(from, to);
    const cols = ['ref', 'visitor_name', 'organization', 'visitor_type', 'purpose', 'host_name', 'host_department', 'meeting_title', 'expected_at', 'expected_end',
      'status', 'gate', 'tag_number', 'id_type', 'checked_in_at', 'id_received_at', 'arrived_main_at', 'host_notified_at', 'picked_up_at', 'directed_meeting_at', 'checked_out_at', 'approved_by_name'];
    const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
    audit(req, 'report.export', null, { from, to, rows: rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="visits_${from}_to_${to}.csv"`);
    res.send('﻿' + csv);
  } catch (e) { next(e); }
});

module.exports = { router: r, ON_SITE };
