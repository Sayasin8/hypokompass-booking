require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use('/api/book', bookingLimiter);
app.use('/api/admin', adminLimiter);

app.use('/api', require('./routes/booking'));
app.use('/api/admin', require('./routes/admin'));

// Analytics tracking
app.get('/track', (req, res) => {
  const db = require('./database');
  const { source } = req.query;
  if (source) {
    db.prepare(`INSERT INTO analytics (event_type, source) VALUES ('page_view', ?)`).run(source);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stornieren', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`✅ HypoKompass Buchungssystem läuft auf Port ${PORT}`);
  console.log(`📅 Buchungsseite: http://localhost:${PORT}`);
  console.log(`⚙️  Admin-Dashboard: http://localhost:${PORT}/admin`);
});
