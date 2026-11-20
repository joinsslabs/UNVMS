'use strict';
const path = require('node:path');
const express = require('express');
const config = require('./config');
const { db } = require('./db');
const auth = require('./auth');
const { router } = require('./routes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

// Security headers (no external scripts or styles are used by the front end).
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(auth.loadUser);

// CSRF defence in depth: state-changing API calls must be JSON from our own origin.
app.use('/api', (req, _res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    if (!req.is('application/json')) return next(Object.assign(new Error('JSON body required.'), { status: 415 }));
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return next(Object.assign(new Error('Cross-origin request refused.'), { status: 403 }));
  }
  next();
});

app.use('/api', router);
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
});

// ---- housekeeping: expired sessions + data-retention anonymisation ---------
function housekeeping() {
  auth.purgeExpiredSessions();
  const cutoff = new Date(Date.now() - config.retentionDays * 86400e3).toISOString().slice(0, 10);
  const r = db.prepare(`UPDATE visits SET visitor_name = '[anonymised]', organization = NULL, phone = NULL, email = NULL,
      id_last4 = NULL, notes = NULL, anonymized = 1
    WHERE anonymized = 0 AND substr(expected_at,1,10) < ? AND status IN ('checked_out','cancelled','rejected','expected','pending')`).run(cutoff);
  if (r.changes) {
    db.prepare("INSERT INTO audit(action, detail) VALUES ('retention.anonymise', ?)").run(JSON.stringify({ cutoff, visits: r.changes }));
    console.log(`[retention] anonymised ${r.changes} visit(s) older than ${cutoff}`);
  }
  db.prepare("DELETE FROM outbox WHERE ts < ?").run(new Date(Date.now() - config.retentionDays * 86400e3).toISOString());
}
housekeeping();
setInterval(housekeeping, 6 * 3600e3).unref();

const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
app.listen(config.port, config.host, () => {
  console.log(`${config.orgName} — Visitor Management running on ${config.publicUrl} (TZ ${config.timezone})`);
  if (!userCount) console.log('No users yet. Run `npm run seed` to create the station accounts.');
});
