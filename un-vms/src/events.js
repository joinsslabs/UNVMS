'use strict';
// Server-Sent Events hub: every station screen keeps one stream open and
// refreshes its lists when something changes. No extra dependency needed.

const clients = new Set();

function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const client = { res, user: req.user };
  clients.add(client);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
}

/**
 * Broadcast an event. `payload` is kept small (ids + type) — clients refetch
 * through the normal, permission-checked API.
 */
function publish(type, payload = {}) {
  const data = `event: ${type}\ndata: ${JSON.stringify({ ...payload, at: new Date().toISOString() })}\n\n`;
  for (const c of clients) {
    // Hosts only receive events about their own visitors.
    if (c.user.role === 'host' && payload.hostId && payload.hostId !== c.user.id) continue;
    c.res.write(data);
  }
}

module.exports = { subscribe, publish, count: () => clients.size };
