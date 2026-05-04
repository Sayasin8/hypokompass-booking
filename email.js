require('dotenv').config();
const https = require('https');

function brevoSend({ to, subject, html }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sender: { name: 'Yasin Uca – HypoKompass', email: 'info@hypokompass.de' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ E-Mail gesendet an:', to);
          resolve();
        } else {
          reject(new Error(`Brevo API Fehler ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Brevo API Timeout')); });
    req.write(body);
    req.end();
  });
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

async function sendConfirmation(booking) {
  const { date, time } = formatDateTime(booking.start_time);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const cancelUrl = `${baseUrl}/stornieren?token=${booking.cancel_token}`;
  const isDigital = (booking.consultation_type || 'digital') === 'digital';

  const typeLabel = isDigital
    ? '💻 Digital per Video-Call über Microsoft Teams'
    : '🤝 Vor Ort in meinem Büro in der Vahrer Straße 228, 28329 Bremen';
  const typeBadgeColor = isDigital ? '#1a5276' : '#145a32';
  const typeBadgeBg = isDigital ? '#d6eaf8' : '#d5f5e3';

  const firstName = booking.customer_name.split(' ')[0];

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f4fb; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(26,58,107,0.12); }
    .header { background: #032744; padding: 36px 30px 28px; text-align: center; }
    .header-brand { color: #e8b84b; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
    .header-sub { color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 6px; }
    .body { padding: 32px 30px; }
    .greeting { font-size: 17px; font-weight: 600; color: #032744; margin-bottom: 16px; }
    .intro { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 24px; }
    .type-badge { display: inline-block; background: ${typeBadgeBg}; color: ${typeBadgeColor}; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
    .highlight { background: #f0f4ff; border-left: 4px solid #032744; padding: 18px 20px; margin: 20px 0; border-radius: 8px; }
    .highlight .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .highlight .value { font-size: 20px; font-weight: 700; color: #032744; line-height: 1.4; }
    .info-text { font-size: 14px; line-height: 1.7; color: #555; margin: 20px 0; }
    .btn { display: inline-block; background: #032744; color: #fff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin-top: 8px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 28px 0; }
    .signature { font-size: 14px; line-height: 1.8; color: #444; }
    .signature strong { color: #032744; }
    .signature .title { color: #e8b84b; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .footer { background: #f8f9fb; padding: 16px 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; }
    .footer a { color: #032744; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-brand">HypoKompass</div>
      <h1>Ihr Beratungstermin ist bestätigt</h1>
      <div class="header-sub">Baufinanzierung auf Augenhöhe</div>
    </div>
    <div class="body">
      <p class="greeting">Hallo ${firstName},</p>
      <p class="intro">vielen Dank für Ihr Vertrauen. Ich freue mich auf unser Gespräch und habe Ihren Termin fest für Sie vorgemerkt.</p>

      <div class="type-badge">${typeLabel}</div>

      <div class="highlight">
        <div class="label">Ihr Termin</div>
        <div class="value">${date}</div>
        <div class="value">um ${time} Uhr</div>
      </div>

      <p class="info-text">Ich werde mich zeitnah telefonisch bei Ihnen melden, um unseren gemeinsamen Termin vorzubereiten.</p>

      <p class="info-text">Möchten Sie den Termin verschieben oder stornieren? Kein Problem — nutzen Sie einfach folgenden Link:</p>
      <a href="${cancelUrl}" class="btn">Termin verwalten</a>

      <hr class="divider">

      <div class="signature">
        <p>Mit freundlichen Grüßen</p>
        <p>
          <strong>Yasin Uca</strong><br>
          <span class="title">Baufinanzierungsexperte</span><br>
          <strong>HypoKompass</strong><br>
          <a href="mailto:info@hypokompass.de" style="color:#032744;">info@hypokompass.de</a><br>
          <a href="https://www.hypokompass.de" style="color:#032744;">www.hypokompass.de</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <a href="https://www.hypokompass.de">www.hypokompass.de</a> &nbsp;|&nbsp;
      Diese E-Mail wurde automatisch durch das Buchungssystem von HypoKompass versendet.
    </div>
  </div>
</body>
</html>`;

  await brevoSend({ to: booking.customer_email, subject: `Terminbestätigung – ${date} um ${time} Uhr | HypoKompass`, html });
}

async function sendCancellation(booking) {
  const { date, time } = formatDateTime(booking.start_time);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a3a6b; padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .body { padding: 30px; }
    .btn { display: inline-block; background: #1a3a6b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Terminstornierung – HypoKompass</h1></div>
    <div class="body">
      <p>Sehr geehrte Damen und Herren,</p>
      <p>Ihr Termin am <strong>${date} um ${time} Uhr</strong> wurde erfolgreich storniert.</p>
      <p>Sie können jederzeit einen neuen Termin buchen:</p>
      <a href="${baseUrl}" class="btn">Neuen Termin buchen</a>
      <div class="signature">
        <p>Mit besten Grüßen<br><strong>Yasin Uca</strong><br>HypoKompass</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await brevoSend({ to: booking.customer_email, subject: `Stornierung Ihres Termins am ${date} | HypoKompass`, html });
}

async function sendRescheduled(booking) {
  const { date, time } = formatDateTime(booking.start_time);

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a3a6b; padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .body { padding: 30px; }
    .highlight { background: #f0f4ff; border-left: 4px solid #1a3a6b; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .highlight .value { font-size: 18px; font-weight: bold; color: #1a3a6b; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Terminänderung – HypoKompass</h1></div>
    <div class="body">
      <p>Sehr geehrte Damen und Herren,</p>
      <p>Ihr Termin wurde erfolgreich auf folgenden Zeitpunkt verschoben:</p>
      <div class="highlight">
        <div class="value">${date}</div>
        <div class="value">um ${time} Uhr</div>
      </div>
      <p>Ich werde mich zeitnah telefonisch bei Ihnen melden.</p>
      <div class="signature">
        <p>Mit besten Grüßen<br><strong>Yasin Uca</strong><br>HypoKompass</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await brevoSend({ to: booking.customer_email, subject: `Terminänderung – Neuer Termin: ${date} um ${time} Uhr | HypoKompass`, html });
}

module.exports = { sendConfirmation, sendCancellation, sendRescheduled };
