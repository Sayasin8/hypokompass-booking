# HypoKompass Buchungssystem – Setup-Anleitung

## Schritt 1: Voraussetzungen
- Node.js (Version 18+): https://nodejs.org
- Ein STRATO-Webhosting mit SSH-Zugang ODER ein VPS

---

## Schritt 2: Apple iCloud App-Passwort erstellen

1. Gehe zu https://appleid.apple.com
2. Melde dich mit deiner Apple ID an
3. Klicke auf **"Anmelden und Sicherheit"** → **"App-spezifische Passwörter"**
4. Klicke auf **"+"** und erstelle ein Passwort für "HypoKompass Buchung"
5. Notiere das Passwort (Format: xxxx-xxxx-xxxx-xxxx)

---

## Schritt 3: Konfiguration (.env Datei)

```bash
cp .env.example .env
```

Dann `.env` öffnen und ausfüllen:

```
CALDAV_USERNAME=deine@icloud.com
CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx    # App-spezifisches Passwort von Schritt 2
SMTP_PASS=DeinSTRATOPasswort
ADMIN_PASSWORD=EinSicheresPasswort!
BASE_URL=https://buchen.hypokompass.de  # Deine Domain
```

---

## Schritt 4: Abhängigkeiten installieren & starten

```bash
cd hypokompass-booking
npm install
npm start
```

Lokaler Test: http://localhost:3000

---

## Schritt 5: Logo einbinden

Kopiere dein Logo als `logo.png` in den Ordner `public/`:
```
public/logo.png
```

---

## Schritt 6: Auf STRATO deployen

### Option A: STRATO VPS / Root-Server
```bash
# Auf dem Server:
npm install
npm install -g pm2
pm2 start server.js --name hypokompass-booking
pm2 save
pm2 startup
```

### Option B: Kostenlos auf Railway.app deployen
1. https://railway.app → neues Projekt
2. "Deploy from GitHub" → Repo hochladen
3. Environment Variables aus `.env` eintragen
4. Fertig – URL erhältst du automatisch

---

## Schritt 7: Buchungslinks einbinden

### Website (iframe)
```html
<iframe 
  src="https://buchen.hypokompass.de" 
  width="100%" 
  height="700" 
  frameborder="0"
  style="border-radius:12px">
</iframe>
```

### Instagram (Link in Bio)
```
https://buchen.hypokompass.de?source=instagram
```

### WhatsApp Business (Willkommensnachricht)
```
https://buchen.hypokompass.de?source=whatsapp
```

### Google Business Profil (Website-Button)
```
https://buchen.hypokompass.de?source=google
```

---

## Admin Dashboard

Erreichbar unter: https://buchen.hypokompass.de/admin

Funktionen:
- Live-Statistiken (Buchungen, Stornierungen, Quellen)
- Alle Termine verwalten
- Traffic-Auswertung nach Quelle (Website/Instagram/WhatsApp/Google)
- Buchungslinks mit 1 Klick kopieren

---

## Buchungseinstellungen anpassen (.env)

| Variable | Standard | Bedeutung |
|---|---|---|
| BOOKING_START_HOUR | 8 | Erster Termin um 8:00 Uhr |
| BOOKING_END_HOUR | 18 | Letzter Termin endet um 18:00 Uhr |
| BOOKING_DAYS | 1,2,3,4,5 | Mo-Fr (0=So, 6=Sa) |
| SLOT_DURATION_MINUTES | 60 | 1 Stunde pro Termin |
| MAX_RESCHEDULE_COUNT | 3 | Max. 3x verschieben |
| ADVANCE_BOOKING_DAYS | 60 | Buchbar bis 60 Tage im Voraus |
