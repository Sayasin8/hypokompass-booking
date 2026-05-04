require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'changeme', 10);

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || !bcrypt.compareSync(password, ADMIN_HASH)) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  const token = uuidv4();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)`).run(token, expires);
  res.json({ token });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' });
  const token = auth.slice(7);
  const session = db.prepare(`SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')`).get(token);
  if (!session) return res.status(401).json({ error: 'Session abgelaufen' });
  next();
}

// GET /api/admin/dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  const stats = {
    total: db.prepare(`SELECT COUNT(*) as c FROM bookings`).get().c,
    confirmed: db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'`).get().c,
    cancelled: db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'`).get().c,
    today: db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE DATE(start_time) = ? AND status = 'confirmed'`).get(today).c,
    thisWeek: db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE start_time >= ? AND status = 'confirmed'`).get(weekStart.toISOString()).c,
  };

  const bySource = db.prepare(`
    SELECT source, COUNT(*) as count FROM bookings GROUP BY source ORDER BY count DESC
  `).all();

  const byDay = db.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM bookings WHERE created_at >= date('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all();

  const upcoming = db.prepare(`
    SELECT id, customer_name, customer_email, customer_phone, start_time, end_time, source, reschedule_count
    FROM bookings WHERE status = 'confirmed' AND start_time >= datetime('now')
    ORDER BY start_time LIMIT 20
  `).all();

  const recent = db.prepare(`
    SELECT id, customer_name, customer_email, start_time, status, source, created_at
    FROM bookings ORDER BY created_at DESC LIMIT 50
  `).all();

  res.json({ stats, bySource, byDay, upcoming, recent });
});

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, (req, res) => {
  const { status, from, to } = req.query;
  let query = `SELECT * FROM bookings WHERE 1=1`;
  const params = [];
  if (status) { query += ` AND status = ?`; params.push(status); }
  if (from) { query += ` AND start_time >= ?`; params.push(from); }
  if (to) { query += ` AND start_time <= ?`; params.push(to); }
  query += ` ORDER BY start_time DESC`;
  const bookings = db.prepare(query).all(...params);
  res.json({ bookings });
});

// DELETE /api/admin/booking/:id
router.delete('/booking/:id', requireAdmin, async (req, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Nicht gefunden' });
  db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(booking.id);
  const { deleteCalendarEvent } = require('../caldav');
  await deleteCalendarEvent(booking.caldav_uid);
  res.json({ success: true });
});

module.exports = router;
