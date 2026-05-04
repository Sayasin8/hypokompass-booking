// HypoKompass Buchungssystem – Frontend
const API = '';
let currentStep = 1;
let selectedType = null;
let selectedDate = null;
let selectedSlot = null;
let currentMonth = new Date();
let availableDays = [];

// ── Utility ────────────────────────────────────────────────
function toast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Datum-String (YYYY-MM-DD) immer als lokale Zeit interpretieren – verhindert UTC-Versatz
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  const date = iso.length === 10 ? parseLocalDate(iso) : new Date(iso);
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Step Navigation ─────────────────────────────────────────
function goToStep(step) {
  document.querySelectorAll('[id^="step-"]').forEach(el => el.classList.add('hidden'));
  document.getElementById(`step-${step}`).classList.remove('hidden');
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    else if (i + 1 === step) el.classList.add('active');
  });
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Typ-Auswahl ─────────────────────────────────────────────
function selectType(type, btn) {
  selectedType = type;
  document.querySelectorAll('.type-card').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  setTimeout(() => goToStep(2), 280);
}

// ── Calendar ────────────────────────────────────────────────
async function loadAvailableDays() {
  const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  try {
    const r = await fetch(`${API}/api/available-days?month=${month}`);
    const data = await r.json();
    availableDays = data.availableDays || [];
  } catch {
    availableDays = [];
  }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar');
  const label = document.getElementById('month-label');
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  label.textContent = currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  let html = weekdays.map(d => `<div class="cal-weekday">${d}</div>`).join('');

  const y = currentMonth.getFullYear();
  const mo = currentMonth.getMonth();
  const first = new Date(y, mo, 1);
  const daysInMonth = new Date(y, mo + 1, 0).getDate();

  // Wochentag des 1. (Mo=0 … So=6)
  let startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = 0; i < startDow; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    // ISO-String direkt bauen – kein UTC-Versatz!
    const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isAvail = availableDays.includes(iso);
    const isToday = iso === todayISO;
    const isSelected = selectedDate === iso;

    let cls = 'cal-day';
    cls += isAvail ? ' available' : ' unavailable';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';

    html += `<div class="${cls}" ${isAvail ? `onclick="selectDate('${iso}')"` : ''}>${d}</div>`;
  }
  grid.innerHTML = html;

  const prevBtn = document.getElementById('prev-month');
  const thisMonthISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const curISO = `${y}-${String(mo+1).padStart(2,'0')}`;
  prevBtn.disabled = curISO <= thisMonthISO;
}

function selectDate(iso) {
  selectedDate = iso;
  renderCalendar();
  loadSlots(iso);
  goToStep(3);
}

document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  loadAvailableDays();
});
document.getElementById('next-month').addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  loadAvailableDays();
});

// ── Slots ───────────────────────────────────────────────────
async function loadSlots(date) {
  const container = document.getElementById('slots');
  const loader = document.getElementById('slots-loader');
  document.getElementById('selected-date-label').textContent = formatDate(date);
  container.innerHTML = '';
  loader.classList.remove('hidden');

  try {
    const r = await fetch(`${API}/api/slots?date=${date}`);
    const data = await r.json();
    loader.classList.add('hidden');

    if (!data.slots || data.slots.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1">Keine Termine verfügbar</p>';
      return;
    }

    container.innerHTML = data.slots.map(slot => {
      const time = formatTime(slot.start);
      if (slot.available) {
        return `<button class="slot-btn available" onclick="selectSlot('${slot.start}','${slot.end}',this)">${time}</button>`;
      } else {
        return `<button class="slot-btn busy" disabled>${time}</button>`;
      }
    }).join('');
  } catch {
    loader.classList.add('hidden');
    container.innerHTML = '<p style="color:var(--red);text-align:center;grid-column:1/-1">Fehler beim Laden</p>';
  }
}

function selectSlot(start, end, btn) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedSlot = { start, end };
  setTimeout(() => showStep4(), 300);
}

// ── Step 4 ──────────────────────────────────────────────────
function showStep4() {
  if (!selectedSlot) return;
  const typeLabel = selectedType === 'digital' ? '💻 Digital' : '🤝 Vor Ort';
  document.getElementById('booking-summary').innerHTML =
    `${typeLabel}<br>📅 <strong>${formatDate(selectedSlot.start)}</strong><br>🕐 ${formatTime(selectedSlot.start)} – ${formatTime(selectedSlot.end)} Uhr`;
  goToStep(4);
}

// ── Form Submit ─────────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Wird gebucht…';

  const source = new URLSearchParams(window.location.search).get('source') || 'website';

  try {
    const r = await fetch(`${API}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim() || null,
        start_time: selectedSlot.start,
        consultation_type: selectedType,
        source,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Unbekannter Fehler');

    sessionStorage.setItem('cancelToken', data.cancelToken);

    const typeLabel = selectedType === 'digital' ? '💻 Digital' : '🤝 Vor Ort';
    document.getElementById('success-text').textContent =
      `Ihr Termin am ${formatDate(selectedSlot.start)} um ${formatTime(selectedSlot.start)} Uhr ist bestätigt.`;
    document.getElementById('confirmation-box').innerHTML =
      `${typeLabel}<br>📅 ${formatDate(selectedSlot.start)}<br>🕐 ${formatTime(selectedSlot.start)} Uhr`;

    goToStep(5);
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Termin verbindlich buchen';
  }
});

function shareBooking() {
  const text = `Mein Beratungstermin mit HypoKompass: ${formatDate(selectedSlot?.start)} um ${formatTime(selectedSlot?.start)} Uhr`;
  if (navigator.share) {
    navigator.share({ title: 'Mein HypoKompass Termin', text });
  } else {
    navigator.clipboard.writeText(text).then(() => toast('In Zwischenablage kopiert', 'success'));
  }
}

// ── Init ────────────────────────────────────────────────────
(function init() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('source');
  if (source) fetch(`/track?source=${encodeURIComponent(source)}`).catch(() => {});
  loadAvailableDays();
  goToStep(1);
  // Stepper hat jetzt 5 Schritte — done-Logik passt automatisch
})();
