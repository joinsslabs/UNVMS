'use strict';
const crypto = require('node:crypto');
const config = require('./config');
const { db } = require('./db');
const { HttpError } = require('./util');

const COOKIE = 'vms_sid';

// ---- passwords (scrypt, no native dependency) ------------------------------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(400, 'Password must be at least 10 characters.');
}

// ---- sessions -----------------------------------------------------------------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const exp = new Date(now.getTime() + config.sessionHours * 3600e3);
  db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(sha256(token), userId, now.toISOString(), exp.toISOString());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.sessionHours * 3600}${config.secureCookies ? '; Secure' : ''}`);
}
function destroySession(req, res) {
  const t = readCookie(req);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(t));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
function readCookie(req) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

const getSessionUser = db.prepare(`
  SELECT u.id, u.username, u.name, u.email, u.phone, u.extension, u.department, u.role, u.must_change
  FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`);

/** Attaches req.user when a valid session cookie is present. */
function loadUser(req, _res, next) {
  const t = readCookie(req);
  if (t) req.user = getSessionUser.get(sha256(t), new Date().toISOString()) || null;
  next();
}

/** requireRole() = any signed-in user; requireRole('a','b') = only those roles (admin always allowed). */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in.'));
    if (roles.length && req.user.role !== 'admin' && !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Your role is not allowed to do this.'));
    }
    next();
  };
}

// ---- simple login throttle (per IP + username) -------------------------------
const attempts = new Map();
function throttle(key) {
  const now = Date.now();
  const a = attempts.get(key) || { n: 0, until: 0, first: now };
  if (a.until > now) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  return a;
}
function recordFailure(key, a) {
  a.n += 1;
  if (a.n >= 5) { a.until = Date.now() + 5 * 60e3; a.n = 0; }
  attempts.set(key, a);
}

function login(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const key = `${req.ip}|${username.toLowerCase()}`;
  const a = throttle(key);
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordFailure(key, a);
    throw new HttpError(401, 'Incorrect username or password.');
  }
  attempts.delete(key);
  createSession(res, user.id);
  return { id: user.id, username: user.username, name: user.name, role: user.role, must_change: user.must_change };
}

function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

module.exports = { hashPassword, verifyPassword, validatePassword, loadUser, requireRole, login, destroySession, purgeExpiredSessions };
