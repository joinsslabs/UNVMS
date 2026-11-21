# Access & Visitor Management System — UN Common Services

Built by SKILL.SCH. A real-time web application that runs the visitor journey across four stations and keeps one live, audited record of everyone on site.

## The visitor journey

| # | Station | Device | What happens |
|---|---------|--------|--------------|
| 1 | **Reception — Access Control building** (`/reception.html`) | Computer | Receptionist searches the visitor's name, checks their photo ID, ticks *"I have confirmed this is the person"* and clicks **Grant access**. The clock starts and the system **randomly assigns a free tag number** (can be swapped with *Assign a different number*). Walk-ins can be registered and are sent for approval. |
| 2 | **Documentation & Tagging** (`/documentation.html`) | Computer | The visitor appears instantly in the queue with their tag number. Officer records the **Nigerian government ID** type (NIN slip/card, driver's licence, passport, voter's card…), optionally its last 4 characters, keeps the ID in the tray slot with the same number, and hands over the tag. On exit: search by tag or name → confirm ID returned → **Check out** (clock stops, tag freed). |
| 3 | **Reception — Main Building** (`/main-reception.html`) | Computer | Tagged visitors appear automatically. **One-on-one**: shows host, extension and phone — receptionist can **Call** the host, or click **Arrived — email host** (host gets an email instantly) and then **Host picked up**. **Meeting attendees**: shows the meeting title, room, directions and time → **Directed to meeting**. Today's meetings show *arrived / invited*. |
| 4 | **VIP Gate** (`/vip.html`) | Tablet | Touch-friendly. Tap an expected VIP → confirm identity → **Grant access**: assigns a **VIP tag (V01…)**, records ID (default *Not required*), and either emails the host to come to the VIP gate or logs the VIP straight into their meeting. Check-out from the same screen. |
| — | **Staff / Manager / Admin** (`/admin.html`) | Any | Hosts register visitors (single or CSV upload), schedule meetings and see their own guests. Managers get the live dashboard, emergency roll-call print, approvals, tags, reports, CSV export, audit trail and email log. Admins manage users. |

All screens update live (Server-Sent Events) — no refresh needed.

Visit status flow: `pending → expected → checked_in → tagged → arrived / in_meeting → with_host → checked_out` (plus `rejected`, `cancelled`).

## Quick start

Requires **Node.js 22.5+** (uses the built-in SQLite — no database server to install).

```bash
npm install
cp .env.example .env          # edit SMTP, PUBLIC_URL, tag pool size
npm run seed                  # creates station accounts with random passwords (printed once)
npm start                     # http://<server>:3000
```

For a demonstration with sample hosts, a meeting and visitors for today (all passwords `ChangeMe2026!`):

```bash
npm run seed:demo
```

Then on each device open the address and sign in:

| Device | Username | Opens |
|--------|----------|-------|
| PC 1 — Access Control reception | `reception1` | Reception |
| PC 2 — Documentation & tagging | `documentation` | Documentation |
| PC 3 — Main Building reception | `mainreception` | Main reception |
| Tablet — VIP gate | `vipgate` | VIP gate |
| Common Services Manager | `manager` | Dashboard |
| Administrator | `admin` | Dashboard + Users |

New accounts must change their password at first sign-in. Station devices stay signed in for `SESSION_HOURS` (default 12).

Run the automated end-to-end tests: `npm test`.

## Docker

```bash
docker build -t un-vms .
docker run -d --name un-vms -p 3000:3000 --env-file .env -v vms-data:/app/data un-vms
docker exec -it un-vms node --no-warnings src/seed.js
```

## Production checklist

- Put it behind HTTPS (nginx/IIS/Caddy) at e.g. `visitors.<your-domain>`, set `SECURE_COOKIES=true` and `PUBLIC_URL`.
- Configure SMTP (`SMTP_*`, `MAIL_FROM`) — e.g. Microsoft 365 SMTP relay. Until then, emails are recorded under *Reports & audit → Email log*.
- Back up `data/vms.sqlite` daily (e.g. `sqlite3 vms.sqlite ".backup backup.sqlite"`), keep 30 days.
- Set `TAG_POOL_SIZE` / `VIP_TAG_POOL_SIZE` to match the physical tags printed.
- Create a user (role *Staff host*) with email + extension for every staff member who receives visitors.
- Keep a printed manual check-in sheet at each desk for outages.

## Security & data protection

- Deny-by-default, role-checked on the server for every request; hosts only see their own visitors.
- Independent approval: nobody can approve a visit they requested or are hosting (refusals are audited).
- Passwords hashed with scrypt; HttpOnly, SameSite=Strict session cookies; login throttling; strict Content-Security-Policy; JSON-only, same-origin API writes.
- Full audit trail of logins, registrations, approvals, check-ins, ID exchange, notifications, check-outs and exports.
- Data minimisation: only the ID **type** and optionally the **last 4 characters** are stored — never full ID numbers or scans. Personal data is anonymised automatically after `RETENTION_DAYS` (aligned with the Nigeria Data Protection Act 2023).

## Project layout

```
src/
  server.js      HTTP server, security headers, housekeeping (sessions, retention)
  routes.js      REST API: visits workflow, tags, meetings, users, stats, audit, export
  db.js          SQLite schema + tag pools
  auth.js        passwords, sessions, role checks, login throttle
  mailer.js      SMTP email + outbox log, email templates
  events.js      live updates (Server-Sent Events)
  seed.js        station accounts / demo data
public/          station screens (plain HTML/CSS/JS, no build step)
test/            end-to-end API tests (node:test)
```

### Main API

| Method | Endpoint | Station |
|--------|----------|---------|
| GET | `/api/visits/search?q=` | Reception / VIP |
| POST | `/api/visits/:id/grant` `{identity_confirmed:true}` | Reception 1 |
| POST | `/api/visits/:id/retag` | Reception 1 / Documentation |
| POST | `/api/visits/:id/id-exchange` `{id_type, id_last4?}` | Documentation |
| POST | `/api/visits/:id/arrived` · `/host-called` · `/picked-up` · `/to-meeting` | Main reception |
| POST | `/api/visits/:id/vip-fast-track` | VIP gate |
| POST | `/api/visits/:id/checkout` `{id_returned:true}` | Documentation / VIP |
| POST | `/api/visits` · `/api/visits/bulk` | Hosts / Manager |
| POST | `/api/visits/:id/approve` · `/reject` | Manager |
| GET | `/api/stats` · `/api/audit` · `/api/outbox` · `/api/export.csv` | Manager |

A booking system can register visits automatically by calling `POST /api/visits/bulk` with a service account.
