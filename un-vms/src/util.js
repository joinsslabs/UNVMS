'use strict';
const crypto = require('node:crypto');
const { db } = require('./db');

const pad = n => String(n).padStart(2, '0');

/** Local date 'YYYY-MM-DD' (process TZ is set from config). */
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local datetime 'YYYY-MM-DDTHH:MM'. */
function localDateTime(d = new Date()) {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addMinutesLocal(local, minutes) {
  const d = new Date(local);
  d.setMinutes(d.getMinutes() + minutes);
  return localDateTime(d);
}
const nowIso = () => new Date().toISOString();

/** Visit reference, e.g. UNV-7K3QX9 (no ambiguous characters). */
function newRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return 'UNV-' + s;
}

const insAudit = db.prepare('INSERT INTO audit(user_id, username, role, action, visit_id, detail, ip) VALUES (?,?,?,?,?,?,?)');
function audit(req, action, visitId = null, detail = null) {
  const u = req && req.user;
  insAudit.run(u ? u.id : null, u ? u.username : null, u ? u.role : null, action, visitId,
    detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
    req ? (req.ip || null) : null);
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function str(v, max = 200) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

module.exports = { localDate, localDateTime, addMinutesLocal, nowIso, newRef, audit, HttpError, str, LOCAL_DT };
