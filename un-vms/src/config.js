'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Minimal .env loader (no dependency). Real environment variables win.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const env = process.env;
const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  publicUrl: env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`,
  timezone: env.TZ || 'Africa/Lagos',
  dbFile: env.DB_FILE || path.join(__dirname, '..', 'data', 'vms.sqlite'),
  secureCookies: env.SECURE_COOKIES === 'true',
  sessionHours: Number(env.SESSION_HOURS || 12),

  // Visitor tag pool, e.g. TAG_POOL_SIZE=300 => tags 001..300
  tagPoolSize: Number(env.TAG_POOL_SIZE || 300),
  tagPrefix: env.TAG_PREFIX || '',
  vipTagPoolSize: Number(env.VIP_TAG_POOL_SIZE || 30),
  vipTagPrefix: env.VIP_TAG_PREFIX || 'V',

  // Visitor types that need an independent approver before arrival
  approvalTypes: (env.APPROVAL_TYPES || 'contractor,walk_in').split(',').map(s => s.trim()).filter(Boolean),
  defaultVisitMinutes: Number(env.DEFAULT_VISIT_MINUTES || 120),
  retentionDays: Number(env.RETENTION_DAYS || 180),

  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'UN Common Services Visitor Desk <no-reply@example.org>',
  },
  orgName: env.ORG_NAME || 'UN Common Services',
};

process.env.TZ = config.timezone;
module.exports = config;
