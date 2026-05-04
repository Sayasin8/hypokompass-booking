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

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a3a6b; padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .body { padding: 30px; }
    .highlight { background: #f0f4ff; border-left: 4px solid #1a3a6b; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .highlight .label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
    .highlight .value { font-size: 18px; font-weight: bold; color: #1a3a6b; }
    .btn { display: inline-block; background: #e8f0fe; color: #1a3a6b; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; margin-top: 20px; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; }
    .footer { background: #f9f9f9; padding: 15px 30px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>HypoKompass – Terminbestätigung</h1></div>
    <div class="body">
      <p>Sehr geehrte Damen und Herren,</p>
      <p>vielen Dank für Ihr Interesse an einer kostenlosen Beratung zu Ihrem Finanzierungsprojekt.</p>
      <p>Ich werde mich zeitnah telefonisch bei Ihnen melden, um unseren gemeinsamen Termin vorzubereiten.</p>
      <div class="highlight">
        <div class="label">Ihr Termin</div>
        <div class="value">${date}</div>
        <div class="value">um ${time} Uhr</div>
      </div>
      <p>Falls Sie den Termin stornieren oder verschieben möchten, klicken Sie bitte auf folgenden Link:</p>
      <a href="${cancelUrl}" class="btn">Termin verwalten</a>
      <div class="signature">
        <p>Mit besten Grüßen</p>
        <p>
          <strong>Yasin Uca</strong><br>
          Baufinanzierungsberater<br>
          <strong>HypoKompass</strong><br>
          <a href="mailto:yasin.uca@hypokompass.de">yasin.uca@hypokompass.de</a><br>
          <a href="https://www.hypokompass.de">www.hypokompass.de</a>
        </p>
      </div>
    </div>
    <div class="footer">Diese E-Mail wurde automatisch durch das Buchungssystem von HypoKompass versendet.</div>
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
