require('dotenv').config();
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { getBusySlots, createCalendarEvent, deleteCalendarEvent } = require('../caldav');
const { sendConfirmation, sendCancellation, sendRescheduled } = require('../email');

const SLOT_DURATION = parseInt(process.env.SLOT_DURATION_MINUTES || '60');
const START_HOUR = parseInt(process.env.BOOKING_START_HOUR || '9');
const END_HOUR = parseInt(process.env.BOOKING_END_HOUR || '19');
const BOOKING_DAYS = (process.env.BOOKING_DAYS || '1,2,3,4,5').split(',').map(Number);
const ADVANCE_DAYS = parseInt(process.env.ADVANCE_BOOKING_DAYS || '60');
const MAX_RESCHEDULE = parseInt(process.env.MAX_RESCHEDULE_COUNT || '3');
const TZ = 'Europe/Berlin';

// Gibt UTC-Date zurück, die genau hour:00 Uhr in Europe/Berlin entspricht
function berlinTime(dateStr, hour) {
  const ref = new Date(`${dateStr}T12:00:00Z`);
  const berlinHour = parseInt(
    new Intl.DateTimeFormat('de', { hour: 'numeric', hour12: false, timeZone: TZ }).format(ref)
  );
  const offsetHours = berlinHour - 12;
  const utcHour = hour - offsetHours;
  return new Date(`${dateStr}T${String(utcHour).padStart(2, '0')}:00:00Z`);
}

// Wochentag (0=So … 6=Sa) in Europe/Berlin
function berlinDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(short);
}

function logAnalytics(event_type, source, booking_id, metadata) {
  db.prepare(`INSERT INTO analytics (event_type, source, booking_id, metadata) VALUES (?, ?, ?, ?)`)
    .run(event_type, source || null, booking_id || null, JSON.stringify(metadata || {}));
}

// GET /api/slots?date=2024-03-15
router.get('/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Datum fehlt' });

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const busyCalendar = await getBusySlots(dayStart, dayEnd);
    const busyDB = db.prepare(
      `SELECT start_time, end_time FROM bookings WHERE DATE(start_time) = ? AND status = 'confirmed'`
    ).all(date);

    const allBusy = [
      ...busyCalendar,
      ...busyDB.map(b => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
    ];

    const slots = [];
    const dayOfWeek = berlinDayOfWeek(date);
    if (!BOOKING_DAYS.includes(dayOfWeek)) {
      return res.json({ slots: [] });
    }

    const now = new Date();
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const slotStart = berlinTime(date, h);
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000);

      if (slotStart <= now) continue;

      const isBusy = allBusy.some(
        b => slotStart < b.end && slotEnd > b.start
      );

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: !isBusy,
      });
    }

    res.json({ slots });
  } catch (err) {
    console.error('Slots Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Termine' });
  }
});

// GET /api/available-days?month=2024-03
router.get('/available-days', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'Monat fehlt' });

    const [year, mon] = month.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0);
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + ADVANCE_DAYS);

    const busyCalendar = await getBusySlots(start, end);
    const busyDB = db.prepare(
      `SELECT start_time, end_time FROM bookings WHERE start_time >= ? AND end_time <= ? AND status = 'confirmed'`
    ).all(start.toISOString(), end.toISOString());
    const allBusy = [
      ...busyCalendar,
      ...busyDB.map(b => ({ start: new Date(b.start_time), end: new Date(b.end_time) })),
    ];

    const days = [];
    const cur = new Date(start);
    while (cur <= end) {
      const isoDate = cur.toISOString().split('T')[0];
      const dow = berlinDayOfWeek(isoDate);
      const curMidnightBerlin = berlinTime(isoDate, 0);
      if (BOOKING_DAYS.includes(dow) && curMidnightBerlin > today && curMidnightBerlin <= maxDate) {
        let hasSlot = false;
        for (let h = START_HOUR; h < END_HOUR; h++) {
          const s = berlinTime(isoDate, h);
          const e = new Date(s.getTime() + SLOT_DURATION * 60000);
          const busy = allBusy.some(b => s < b.end && e > b.start);
          if (!busy) { hasSlot = true; break; }
        }
        if (hasSlot) days.push(isoDate);
      }
      cur.setDate(cur.getDate() + 1);
    }
    res.json({ availableDays: days });
  } catch (err) {
    console.error('Available days Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// POST /api/book
router.post('/book', async (req, res) => {
  try {
    const { name, email, phone, start_time, source } = req.body;
    if (!name || !email || !start_time) {
      return res.status(400).json({ error: 'Name, E-Mail und Startzeit sind erforderlich' });
    }

    const start = new Date(start_time);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + SLOT_DURATION);

    const conflictDB = db.prepare(
      `SELECT id FROM bookings WHERE status = 'confirmed' AND start_time < ? AND end_time > ?`
    ).get(end.toISOString(), start.toISOString());
    if (conflictDB) {
      return res.status(409).json({ error: 'Dieser Termin ist bereits vergeben' });
    }

    const id = uuidv4();
    const cancelToken = uuidv4();
    const caldavUid = await createCalendarEvent({
      id, caldav_uid: id, customer_name: name, customer_email: email,
      customer_phone: phone, start_time: start.toISOString(), end_time: end.toISOString(),
    });

    db.prepare(`
      INSERT INTO bookings (id, customer_name, customer_email, customer_phone, start_time, end_time, caldav_uid, cancel_token, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, phone || null, start.toISOString(), end.toISOString(), caldavUid || id, cancelToken, source || 'website');

    logAnalytics('booking_created', source, id, { name, email });

    await sendConfirmation({ id, customer_name: name, customer_email: email, customer_phone: phone, start_time: start.toISOString(), cancel_token: cancelToken });

    res.json({ success: true, bookingId: id, cancelToken });
  } catch (err) {
    console.error('Buchung Fehler:', err);
    res.status(500).json({ error: 'Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.' });
  }
});

// GET /api/booking/:token
router.get('/booking/:token', (req, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE cancel_token = ?`).get(req.params.token);
  if (!booking) return res.status(404).json({ error: 'Buchung nicht gefunden' });
  res.json({
    id: booking.id,
    customer_name: booking.customer_name,
    start_time: booking.start_time,
    end_time: booking.end_time,
    status: booking.status,
    reschedule_count: booking.reschedule_count,
    can_reschedule: booking.reschedule_count < MAX_RESCHEDULE,
  });
});

// POST /api/cancel/:token
router.post('/cancel/:token', async (req, res) => {
  try {
    const booking = db.prepare(`SELECT * FROM bookings WHERE cancel_token = ?`).get(req.params.token);
    if (!booking) return res.status(404).json({ error: 'Buchung nicht gefunden' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Buchung ist nicht aktiv' });

    db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(booking.id);
    await deleteCalendarEvent(booking.caldav_uid);
    logAnalytics('booking_cancelled', booking.source, booking.id, {});
    await sendCancellation(booking);

    res.json({ success: true });
  } catch (err) {
    console.error('Storno Fehler:', err);
    res.status(500).json({ error: 'Stornierung fehlgeschlagen' });
  }
});

// POST /api/reschedule/:token
router.post('/reschedule/:token', async (req, res) => {
  try {
    const { new_start_time } = req.body;
    const booking = db.prepare(`SELECT * FROM bookings WHERE cancel_token = ?`).get(req.params.token);
    if (!booking) return res.status(404).json({ error: 'Buchung nicht gefunden' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Buchung ist nicht aktiv' });
    if (booking.reschedule_count >= MAX_RESCHEDULE) {
      return res.status(400).json({ error: `Maximale Anzahl an Verschiebungen (${MAX_RESCHEDULE}x) erreicht` });
    }

    const newStart = new Date(new_start_time);
    const newEnd = new Date(newStart);
    newEnd.setMinutes(newEnd.getMinutes() + SLOT_DURATION);

    const conflict = db.prepare(
      `SELECT id FROM bookings WHERE status = 'confirmed' AND id != ? AND start_time < ? AND end_time > ?`
    ).get(booking.id, newEnd.toISOString(), newStart.toISOString());
    if (conflict) return res.status(409).json({ error: 'Dieser Termin ist bereits vergeben' });

    await deleteCalendarEvent(booking.caldav_uid);
    const newUid = await createCalendarEvent({
      id: booking.id, caldav_uid: booking.id,
      customer_name: booking.customer_name, customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      start_time: newStart.toISOString(), end_time: newEnd.toISOString(),
    });

    db.prepare(`
      UPDATE bookings SET start_time = ?, end_time = ?, caldav_uid = ?,
      reschedule_count = reschedule_count + 1, updated_at = datetime('now') WHERE id = ?
    `).run(newStart.toISOString(), newEnd.toISOString(), newUid || booking.id, booking.id);

    const updated = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(booking.id);
    logAnalytics('booking_rescheduled', booking.source, booking.id, {});
    await sendRescheduled(updated);

    res.json({ success: true, reschedule_count: updated.reschedule_count, remaining: MAX_RESCHEDULE - updated.reschedule_count });
  } catch (err) {
    console.error('Verschiebung Fehler:', err);
    res.status(500).json({ error: 'Verschiebung fehlgeschlagen' });
  }
});

module.exports = router;
