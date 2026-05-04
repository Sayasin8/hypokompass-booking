require('dotenv').config();
const { DAVClient } = require('tsdav');

let client = null;
let calendarUrl = null;

async function getClient() {
  if (client) return client;
  try {
    client = new DAVClient({
      serverUrl: process.env.CALDAV_URL,
      credentials: {
        username: process.env.CALDAV_USERNAME,
        password: process.env.CALDAV_PASSWORD,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
    await client.login();
    console.log('✅ iCloud CalDAV verbunden');
  } catch (err) {
    client = null;
    console.error('❌ CalDAV Login Fehler:', err.message);
    throw err;
  }
  return client;
}

async function getCalendarUrl() {
  if (calendarUrl) return calendarUrl;
  const c = await getClient();
  const calendars = await c.fetchCalendars();

  if (!calendars || calendars.length === 0) {
    throw new Error('Keine Kalender gefunden');
  }

  console.log('📅 Verfügbare Kalender:', calendars.map(x => x.displayName).join(', '));

  const name = process.env.CALDAV_CALENDAR_NAME || '';
  const cal = name
    ? (calendars.find(x => x.displayName === name) || calendars[0])
    : calendars[0];

  console.log('✅ Verwende Kalender:', cal.displayName);
  calendarUrl = cal.url;
  return calendarUrl;
}

// Client-Cache zurücksetzen bei Verbindungsfehlern
function resetClient() {
  client = null;
  calendarUrl = null;
}

async function getBusySlots(startDate, endDate) {
  try {
    const c = await getClient();
    const url = await getCalendarUrl();
    const objects = await c.fetchCalendarObjects({
      calendar: { url },
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });

    const busy = [];
    for (const obj of objects) {
      const data = obj.data;
      if (!data) continue;

      // Wiederholende Termine (RRULE) vereinfacht behandeln
      const dtstart = extractDate(data, 'DTSTART');
      const dtend = extractDate(data, 'DTEND') || extractDate(data, 'DUE');

      // Ganztägige Termine (VALUE=DATE) blockieren ganzen Tag
      const allDay = /DTSTART;VALUE=DATE:(\d{8})/.exec(data);
      if (allDay) {
        const d = allDay[1];
        const dayStart = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00`);
        const dayEnd = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T23:59:59`);
        busy.push({ start: dayStart, end: dayEnd });
        continue;
      }

      if (dtstart && dtend) {
        busy.push({ start: dtstart, end: dtend });
      }
    }

    console.log(`📅 CalDAV: ${busy.length} belegte Slots gefunden (${startDate.toLocaleDateString('de-DE')} – ${endDate.toLocaleDateString('de-DE')})`);
    return busy;
  } catch (err) {
    console.error('❌ CalDAV getBusySlots Fehler:', err.message);
    resetClient();
    return [];
  }
}

function extractDate(icalData, field) {
  const lines = icalData.split(/\r?\n/);
  for (const line of lines) {
    // Matcht DTSTART, DTSTART;TZID=..., DTEND etc.
    if (!line.startsWith(field)) continue;

    // Wert nach dem letzten ':'
    const colonIdx = line.lastIndexOf(':');
    if (colonIdx === -1) continue;
    const val = line.slice(colonIdx + 1).trim();
    if (!val || !val.includes('T')) continue;

    const y  = val.slice(0, 4);
    const mo = val.slice(4, 6);
    const d  = val.slice(6, 8);
    const h  = val.slice(9, 11);
    const m  = val.slice(11, 13);
    const s  = val.slice(13, 15) || '00';
    const isUtc = val.endsWith('Z');

    return isUtc
      ? new Date(`${y}-${mo}-${d}T${h}:${m}:${s}Z`)
      : new Date(`${y}-${mo}-${d}T${h}:${m}:${s}`);
  }
  return null;
}

async function createCalendarEvent(booking) {
  try {
    const c = await getClient();
    const url = await getCalendarUrl();
    const uid = booking.caldav_uid || booking.id;
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);

    const ical = buildIcal({
      uid,
      summary: `Beratungstermin: ${booking.customer_name}`,
      description: `Baufinanzierungsberatung\nName: ${booking.customer_name}\nTel: ${booking.customer_phone || '-'}\nEmail: ${booking.customer_email}`,
      start,
      end,
    });

    await c.createCalendarObject({
      calendar: { url },
      filename: `${uid}.ics`,
      iCalString: ical,
    });
    console.log('✅ Kalendereintrag erstellt:', uid);
    return uid;
  } catch (err) {
    console.error('❌ CalDAV createEvent Fehler:', err.message);
    resetClient();
    return null;
  }
}

async function deleteCalendarEvent(uid) {
  try {
    const c = await getClient();
    const url = await getCalendarUrl();
    await c.deleteCalendarObject({
      calendarObject: {
        url: `${url}${uid}.ics`,
        etag: '',
      },
    });
    console.log('✅ Kalendereintrag gelöscht:', uid);
  } catch (err) {
    console.error('❌ CalDAV deleteEvent Fehler:', err.message);
    resetClient();
  }
}

function buildIcal({ uid, summary, description, start, end }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HypoKompass//Buchungssystem//DE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

module.exports = { getBusySlots, createCalendarEvent, deleteCalendarEvent };
