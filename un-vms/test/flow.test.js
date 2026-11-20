'use strict';
// End-to-end API test: runs the whole visitor journey against a throwaway database.
//   npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vms-test-'));
const PORT = 3999;
const env = { ...process.env, DB_FILE: path.join(dir, 't.sqlite'), PORT: String(PORT), SMTP_HOST: '' };
const B = `http://localhost:${PORT}/api`;
let server;
const jars = {};

async function call(user, method, url, body) {
  const res = await fetch(B + url, {
    method, headers: { 'Content-Type': 'application/json', Cookie: jars[user] || '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get('set-cookie'); if (sc) jars[user] = sc.split(';')[0];
  return { status: res.status, body: await res.json() };
}
const login = u => call(u, 'POST', '/login', { username: u, password: 'ChangeMe2026!' });

before(async () => {
  const root = path.join(__dirname, '..');
  execFileSync(process.execPath, ['--no-warnings', 'src/seed.js', '--demo'], { cwd: root, env, stdio: 'ignore' });
  server = spawn(process.execPath, ['--no-warnings', 'src/server.js'], { cwd: root, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/me'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  for (const u of ['reception1', 'documentation', 'mainreception', 'vipgate', 'manager', 'jeze', 'aokafor']) assert.equal((await login(u)).status, 200);
});
after(() => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('one-on-one visitor: reception → documentation → main reception → checkout', async () => {
  const [v] = (await call('reception1', 'GET', '/visits/search?q=Amina')).body;
  assert.equal(v.status, 'expected');
  assert.equal((await call('reception1', 'POST', `/visits/${v.id}/grant`, {})).status, 400, 'identity confirmation required');
  const g = (await call('reception1', 'POST', `/visits/${v.id}/grant`, { identity_confirmed: true })).body;
  assert.equal(g.status, 'checked_in'); assert.ok(g.tag_number); assert.ok(g.checked_in_at);
  assert.equal((await call('reception1', 'POST', `/visits/${v.id}/grant`, { identity_confirmed: true })).status, 409, 'cannot grant twice');
  assert.equal((await call('mainreception', 'POST', `/visits/${v.id}/arrived`)).status, 409, 'must be tagged first');
  const t = (await call('documentation', 'POST', `/visits/${v.id}/id-exchange`, { id_type: 'NIN slip / card', id_last4: '1234' })).body;
  assert.equal(t.status, 'tagged');
  const a = (await call('mainreception', 'POST', `/visits/${v.id}/arrived`)).body;
  assert.equal(a.status, 'arrived'); assert.ok(a.host_notified_at, 'host emailed');
  const out = (await call('manager', 'GET', '/outbox')).body;
  assert.ok(out.some(o => o.subject.includes('Amina Bello') && o.to_addr === 'b.musa@example.org'));
  assert.equal((await call('mainreception', 'POST', `/visits/${v.id}/picked-up`)).body.status, 'with_host');
  assert.equal((await call('documentation', 'POST', `/visits/${v.id}/checkout`, {})).status, 400, 'must confirm ID returned');
  const c = (await call('documentation', 'POST', `/visits/${v.id}/checkout`, { id_returned: true })).body;
  assert.equal(c.status, 'checked_out');
  const tags = (await call('manager', 'GET', '/tags')).body;
  assert.ok(!tags.inUse.some(x => x.number === g.tag_number), 'tag released');
});

test('meeting attendee is directed to the meeting room', async () => {
  const [v] = (await call('reception1', 'GET', '/visits/search?q=Ngozi')).body;
  await call('reception1', 'POST', `/visits/${v.id}/grant`, { identity_confirmed: true });
  await call('documentation', 'POST', `/visits/${v.id}/id-exchange`, { id_type: 'International passport' });
  const m = (await call('mainreception', 'POST', `/visits/${v.id}/to-meeting`)).body;
  assert.equal(m.status, 'in_meeting'); assert.equal(m.meeting_room, 'Conference Room B');
});

test('VIP fast track uses the VIP tag pool and notifies the host', async () => {
  const [v] = (await call('vipgate', 'GET', '/visits/search?q=Grace')).body;
  const r = (await call('vipgate', 'POST', `/visits/${v.id}/vip-fast-track`, { identity_confirmed: true })).body;
  assert.equal(r.status, 'arrived'); assert.match(r.tag_number, /^V/); assert.ok(r.host_notified_at);
});

test('approvals are independent; walk-ins wait for approval', async () => {
  const [p] = (await call('manager', 'GET', '/visits?scope=pending')).body;
  assert.equal((await call('jeze', 'POST', `/visits/${p.id}/approve`)).status, 403);
  assert.equal((await call('manager', 'POST', `/visits/${p.id}/approve`)).body.status, 'expected');
  const w = (await call('reception1', 'POST', '/visits', { visitor_name: 'Walk In', host_id: p.host_id })).body;
  assert.equal(w.status, 'pending'); assert.equal(w.visitor_type, 'walk_in');
  assert.equal((await call('reception1', 'POST', `/visits/${w.id}/grant`, { identity_confirmed: true })).status, 409);
});

test('hosts only see their own visitors', async () => {
  const rows = (await call('aokafor', 'GET', '/visits?scope=today')).body;
  assert.ok(rows.length > 0);
  const me = (await call('aokafor', 'GET', '/me')).body;
  assert.ok(rows.every(r => r.host_id === me.id || r.created_by === me.id));
  assert.equal((await call('aokafor', 'GET', '/stats')).status, 403);
});
