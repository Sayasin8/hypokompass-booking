require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

function toBase64(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${data.toString('base64')}`;
  } catch { return ''; }
}

const LOGO_B64 = toBase64(path.join(__dirname, 'public', 'logo.png'));
const PROFILE_B64 = toBase64(path.join(__dirname, 'public', 'profile.png'));

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
  const tz = 'Europe/Berlin';
  const date = d.toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
  });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz });
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
  const typeBadgeColor = isDigital ? '#1a3a6b' : '#145a32';
  const typeBadgeBg = isDigital ? '#d6e4f7' : '#d5f5e3';

  const lastName = booking.customer_name.split(' ').pop();

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f4fb;">
  <div style="max-width: 600px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(3,39,68,0.12);">

    <!-- HEADER -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #032744;">
      <tr>
        <td style="padding: 24px 30px; vertical-align: middle; white-space: nowrap;">
          <span style="color: #fff; font-size: 20px; font-weight: 700;">Ihr Beratungstermin ist bestätigt!</span>
        </td>
        <td style="padding: 24px 30px 24px 0; vertical-align: middle; text-align: right; width: 90px;">
          <img src="${LOGO_B64}" alt="HypoKompass" style="height: 70px; width: auto; display: block; margin-left: auto;">
        </td>
      </tr>
    </table>

    <!-- BODY -->
    <div style="padding: 32px 30px;">
      <p style="font-size: 17px; font-weight: 600; color: #032744; margin: 0 0 16px;">Guten Tag, Herr/Frau ${lastName},</p>
      <p style="font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 24px;">vielen Dank für Ihr Vertrauen. Ich freue mich auf unser Gespräch und habe Ihren Termin fest für Sie vorgemerkt.</p>

      <!-- Terminart-Badge -->
      <div style="display: inline-block; background: ${typeBadgeBg}; color: ${typeBadgeColor}; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 20px;">${typeLabel}</div>

      <!-- Terminbox -->
      <div style="background: #f0f4ff; border-left: 4px solid #032744; padding: 18px 20px; margin: 0 0 24px; border-radius: 8px;">
        <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Ihr Termin</div>
        <div style="font-size: 19px; font-weight: 700; color: #032744;">${date}, um ${time} Uhr</div>
      </div>

      <p style="font-size: 14px; line-height: 1.7; color: #555; margin: 0 0 20px;">Ich werde mich zeitnah telefonisch bei Ihnen melden, um unseren gemeinsamen Termin vorab zu besprechen und diesen dementsprechend vorzubereiten.</p>

      <p style="font-size: 14px; line-height: 1.7; color: #555; margin: 0 0 12px;">Möchten Sie den Termin verschieben oder stornieren? Kein Problem — nutzen Sie einfach folgenden Link:</p>
      <a href="${cancelUrl}" style="display: inline-block; background: #e0352b; color: #fff; padding: 13px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Termin verwalten</a>

      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

      <!-- SIGNATUR -->
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: top; padding-right: 20px;">
            <p style="margin: 0 0 6px; font-size: 14px; color: #555;">Mit freundlichen Grüßen</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.8;">
              <strong style="color: #032744; font-size: 16px;">Yasin Uca</strong><br>
              <span style="color: #e0352b; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Baufinanzierungsexperte</span><br>
              <strong style="color: #032744;">HypoKompass</strong><br>
              <a href="mailto:info@hypokompass.de" style="color: #032744; text-decoration: none;">info@hypokompass.de</a><br>
              <a href="https://www.hypokompass.de" style="color: #032744; text-decoration: none;">www.hypokompass.de</a>
            </p>
          </td>
          <td style="vertical-align: top; text-align: right; width: 120px;">
            <img src="${PROFILE_B64}" alt="Yasin Uca" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; object-position: top; border: 3px solid #e0352b;">
          </td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="background: #f8f9fb; padding: 16px 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee;">
      <a href="https://www.hypokompass.de" style="color: #032744; text-decoration: none;">www.hypokompass.de</a> &nbsp;|&nbsp;
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
