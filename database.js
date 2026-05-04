const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'bookings.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    caldav_uid TEXT,
    reschedule_count INTEGER DEFAULT 0,
    cancel_token TEXT NOT NULL,
    source TEXT DEFAULT 'website',
    consultation_type TEXT DEFAULT 'digital',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    source TEXT,
    booking_id TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

// Migration: consultation_type Spalte nachrüsten falls nicht vorhanden
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN consultation_type TEXT DEFAULT 'digital'`);
} catch (_) {}

module.exports = db;
