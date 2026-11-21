'use strict';
/**
 * Creates the station accounts (and optionally demo hosts, meetings and visits).
 *   npm run seed        -> station + admin accounts with random passwords (printed once)
 *   npm run seed:demo   -> same, plus demo hosts/meetings/visitors for today, password "ChangeMe2026!"
 */
const crypto = require('node:crypto');
const { db } = require('./db');
const { hashPassword } = require('./auth');
const { localDate, newRef } = require('./util');

const demo = process.argv.includes('--demo');
const pw = () => demo ? 'ChangeMe2026!' : crypto.randomBytes(9).toString('base64url');

const accounts = [
  { username: 'admin', name: 'System Administrator', role: 'admin', email: 'admin@example.org' },
  { username: 'manager', name: 'Common Services Manager', role: 'manager', email: 'cs.manager@example.org', department: 'Common Services' },
  { username: 'reception1', name: 'Reception — Access Control Building', role: 'reception1' },
  { username: 'documentation', name: 'Documentation & Tagging Desk', role: 'documentation' },
  { username: 'mainreception', name: 'Reception — Main Building', role: 'main_reception' },
  { username: 'vipgate', name: 'VIP Gate (tablet)', role: 'vip' },
];
const demoHosts = [
  { username: 'aokafor', name: 'Adaeze Okafor', role: 'host', email: 'a.okafor@example.org', phone: '+2348030000001', extension: '2101', department: 'UNDP' },
  { username: 'bmusa', name: 'Bello Musa', role: 'host', email: 'b.musa@example.org', phone: '+2348030000002', extension: '2214', department: 'UNICEF' },
  { username: 'fadeyemi', name: 'Funmi Adeyemi', role: 'host', email: 'f.adeyemi@example.org', phone: '+2348030000003', extension: '2330', department: 'WHO' },
  { username: 'jeze', name: 'John Eze', role: 'host', email: 'j.eze@example.org', phone: '+2348030000004', extension: '2402', department: 'UNHCR' },
];

const ins = db.prepare(`INSERT OR IGNORE INTO users(username, name, email, phone, extension, department, role, password_hash, must_change)
  VALUES (?,?,?,?,?,?,?,?,?)`);
console.log('\nAccounts (passwords are shown once — store them safely):\n');
for (const a of demo ? [...accounts, ...demoHosts] : accounts) {
  const p = pw();
  const r = ins.run(a.username, a.name, a.email || null, a.phone || null, a.extension || null, a.department || null, a.role, hashPassword(p), demo ? 0 : 1);
  console.log(r.changes ? `  ${a.username.padEnd(15)} ${a.role.padEnd(15)} ${p}` : `  ${a.username.padEnd(15)} (already exists, unchanged)`);
}

if (demo) {
  const today = localDate();
  const uid = u => db.prepare('SELECT id FROM users WHERE username = ?').get(u).id;
  const mgr = uid('manager');
  const mtg = db.prepare('INSERT INTO meetings(title, room, directions, starts_at, ends_at, host_id, created_by) VALUES (?,?,?,?,?,?,?)')
    .run('UNSDCF Partners Coordination Meeting', 'Conference Room B', '2nd floor, turn left from the lifts', `${today}T10:00`, `${today}T12:30`, uid('aokafor'), mgr);
  const meetingId = Number(mtg.lastInsertRowid);
  const v = db.prepare(`INSERT INTO visits(ref, visitor_name, organization, phone, email, visitor_type, purpose, host_id, meeting_id,
      expected_at, expected_end, status, created_by, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  const rows = [
    ['Chinedu Obi', 'Federal Ministry of Health', 'guest', 'one_on_one', 'fadeyemi', null, '09:30', '11:00', 'expected'],
    ['Amina Bello', 'Save the Children', 'guest', 'one_on_one', 'bmusa', null, '10:00', '11:30', 'expected'],
    ['Tunde Bakare', 'Lagos State Govt.', 'guest', 'meeting', 'aokafor', meetingId, '10:00', '12:30', 'expected'],
    ['Ngozi Umeh', 'EU Delegation', 'guest', 'meeting', 'aokafor', meetingId, '10:00', '12:30', 'expected'],
    ['Ibrahim Sani', 'World Bank', 'guest', 'meeting', 'aokafor', meetingId, '10:00', '12:30', 'expected'],
    ['Emeka Nwosu', 'BrightFix Electrical Ltd', 'contractor', 'one_on_one', 'jeze', null, '08:30', '16:00', 'pending'],
    ['H.E. Grace Danjuma', 'Embassy of Canada', 'vip', 'one_on_one', 'jeze', null, '11:00', '12:00', 'expected'],
    ['Dr. Kemi Ade', 'Africa CDC', 'vip', 'meeting', 'aokafor', meetingId, '10:00', '12:30', 'expected'],
  ];
  for (const [name, org, type, purpose, host, mid, s, e, status] of rows) {
    v.run(newRef(), name, org, null, null, type, purpose, uid(host), mid, `${today}T${s}`, `${today}T${e}`, status, uid(host),
      status === 'expected' ? mgr : null, status === 'expected' ? now : null);
  }
  console.log(`\nDemo data created for ${today}: 4 hosts, 1 meeting, ${rows.length} visitors.`);
}
console.log('');
