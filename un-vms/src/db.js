'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  extension     TEXT,
  department    TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','manager','reception1','documentation','main_reception','vip','host')),
  password_hash TEXT NOT NULL,
  must_change   INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  room        TEXT NOT NULL,
  directions  TEXT,
  starts_at   TEXT NOT NULL,           -- local 'YYYY-MM-DDTHH:MM'
  ends_at     TEXT NOT NULL,
  host_id     INTEGER NOT NULL REFERENCES users(id),
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ref              TEXT NOT NULL UNIQUE,
  visitor_name     TEXT NOT NULL,
  organization     TEXT,
  phone            TEXT,
  email            TEXT,
  visitor_type     TEXT NOT NULL DEFAULT 'guest' CHECK (visitor_type IN ('guest','vip','contractor','vendor','walk_in')),
  purpose          TEXT NOT NULL DEFAULT 'one_on_one' CHECK (purpose IN ('one_on_one','meeting')),
  host_id          INTEGER REFERENCES users(id),
  meeting_id       INTEGER REFERENCES meetings(id),
  expected_at      TEXT NOT NULL,      -- local 'YYYY-MM-DDTHH:MM'
  expected_end     TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL CHECK (status IN ('pending','expected','rejected','cancelled','checked_in','tagged','arrived','in_meeting','with_host','checked_out')),
  created_by       INTEGER REFERENCES users(id),
  approved_by      INTEGER REFERENCES users(id),
  approved_at      TEXT,
  rejected_reason  TEXT,
  gate             TEXT,               -- 'reception1' | 'vip'
  checked_in_at    TEXT,
  checked_in_by    INTEGER REFERENCES users(id),
  tag_number       TEXT,
  id_type          TEXT,
  id_last4         TEXT,
  id_received_at   TEXT,
  id_received_by   INTEGER REFERENCES users(id),
  arrived_main_at  TEXT,
  host_called_at   TEXT,
  host_notified_at TEXT,
  directed_meeting_at TEXT,
  picked_up_at     TEXT,
  checked_out_at   TEXT,
  checked_out_by   INTEGER REFERENCES users(id),
  id_returned      INTEGER NOT NULL DEFAULT 0,
  anonymized       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_expected ON visits(expected_at);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_name ON visits(visitor_name);

CREATE TABLE IF NOT EXISTS tags (
  number    TEXT PRIMARY KEY,
  pool      TEXT NOT NULL DEFAULT 'standard' CHECK (pool IN ('standard','vip')),
  status    TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','lost','retired')),
  visit_id  INTEGER REFERENCES visits(id)
);

CREATE TABLE IF NOT EXISTS audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_id   INTEGER,
  username  TEXT,
  role      TEXT,
  action    TEXT NOT NULL,
  visit_id  INTEGER,
  detail    TEXT,
  ip        TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);

CREATE TABLE IF NOT EXISTS outbox (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  to_addr  TEXT NOT NULL,
  subject  TEXT NOT NULL,
  body     TEXT NOT NULL,
  status   TEXT NOT NULL,              -- 'sent' | 'logged' | 'failed'
  error    TEXT,
  visit_id INTEGER
);
`);

/** Make sure the physical tag pools exist (idempotent; grows if pool size is increased). */
function ensureTagPools() {
  const ins = db.prepare("INSERT OR IGNORE INTO tags(number, pool) VALUES (?, ?)");
  const width = String(config.tagPoolSize).length < 3 ? 3 : String(config.tagPoolSize).length;
  for (let i = 1; i <= config.tagPoolSize; i++) ins.run(config.tagPrefix + String(i).padStart(width, '0'), 'standard');
  const vw = String(config.vipTagPoolSize).length < 2 ? 2 : String(config.vipTagPoolSize).length;
  for (let i = 1; i <= config.vipTagPoolSize; i++) ins.run(config.vipTagPrefix + String(i).padStart(vw, '0'), 'vip');
}
ensureTagPools();

/** Run fn inside an IMMEDIATE transaction. */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { db, tx, ensureTagPools };
