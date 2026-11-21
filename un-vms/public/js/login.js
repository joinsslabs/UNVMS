'use strict';
(async () => {
  // Already signed in? Go straight to the station.
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (r.ok) { const me = await r.json(); location.href = VMS.STATION_HOME[me.role] || '/admin.html'; return; }
  } catch { /* offline */ }
  VMS.$('#login').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    VMS.$('#err').textContent = '';
    try {
      const u = await VMS.post('/login', { username: f.get('username'), password: f.get('password') });
      location.href = VMS.STATION_HOME[u.role] || '/admin.html';
    } catch (err) { VMS.$('#err').textContent = err.message; }
  });
})();
