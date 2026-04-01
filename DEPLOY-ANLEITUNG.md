# Qntum Designs — Deployment-Anleitung (Schritt für Schritt)

---

## SCHRITT 1: Supabase einrichten (Datenbank + Auth)

1. Öffne https://supabase.com und klicke **"Start your project"**
2. Melde dich an (GitHub-Login geht am schnellsten)
3. Klicke **"New Project"**
   - Name: `qntum-designs`
   - Passwort: wähle ein sicheres Passwort (aufschreiben!)
   - Region: `Central EU (Frankfurt)`
   - Klicke **"Create new project"**
4. Warte 1-2 Minuten bis das Projekt erstellt ist

### Datenbank-Schema anlegen

5. Im Supabase Dashboard: klicke links auf **"SQL Editor"** (das Datenbank-Symbol)
6. Klicke **"New query"**
7. Öffne auf deinem Computer die Datei: `qntum-designs/db/schema.sql`
8. Kopiere den GESAMTEN Inhalt dieser Datei
9. Füge ihn in den SQL Editor ein
10. Klicke **"Run"** (der grüne Button)
11. Du solltest sehen: "Success. No rows returned" — das ist korrekt!

### API-Keys kopieren

12. Klicke links auf **"Project Settings"** (das Zahnrad ganz unten)
13. Klicke auf **"API"** (unter Configuration)
14. Du siehst jetzt 3 wichtige Werte — kopiere sie in eine Notiz:

```
Project URL:        https://xxxxxxx.supabase.co        ← das ist SUPABASE_URL
anon public Key:    eyJhbGci...                         ← das ist SUPABASE_ANON_KEY
service_role Key:   eyJhbGci... (klick "Reveal")        ← das ist SUPABASE_SERVICE_KEY
```

> WICHTIG: Den service_role Key NIEMALS öffentlich teilen!

---

## SCHRITT 2: Anthropic API-Key holen

1. Öffne https://console.anthropic.com
2. Melde dich an / erstelle ein Konto
3. Klicke links auf **"API Keys"**
4. Klicke **"Create Key"**
5. Name: `qntum-designs`
6. Kopiere den Key (beginnt mit `sk-ant-...`) — den siehst du nur EINMAL!

```
API Key:  sk-ant-api03-...    ← das ist ANTHROPIC_API_KEY
```

---

## SCHRITT 3: .env Datei erstellen

1. Öffne den Ordner `qntum-designs` in VS Code
2. Erstelle eine neue Datei mit dem Namen: `.env` (genau so, mit Punkt vorne!)
3. Füge folgendes ein und ersetze die Platzhalter mit deinen echten Keys:

```
ANTHROPIC_API_KEY=sk-ant-api03-DEIN-KEY-HIER
SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
SUPABASE_ANON_KEY=eyJhbGci-DEIN-ANON-KEY
SUPABASE_SERVICE_KEY=eyJhbGci-DEIN-SERVICE-KEY
SESSION_SECRET=ein-beliebiger-langer-text-hier-z-b-qntum2024geheim
PORT=3000
NODE_ENV=production
```

4. Speichern (Cmd+S)

---

## SCHRITT 4: Lokal testen

1. Öffne das Terminal in VS Code (Cmd + J)
2. Navigiere zum Projektordner:

```bash
cd /Users/ektasingh/Desktop/Webseiten/qntum-designs
```

3. Installiere die Abhängigkeiten:

```bash
npm install
```

4. Starte den Server:

```bash
npm run dev
```

5. Du solltest sehen: `Server running on http://localhost:3000`
6. Öffne im Browser: **http://localhost:3000**
7. Du siehst die Landing Page
8. Klicke auf "Jetzt starten" → Registrierungsseite
9. Erstelle einen Account (E-Mail + Passwort)
10. Du landest im Dashboard
11. Klicke "Neues Projekt" → Workspace öffnet sich
12. Schreibe eine Nachricht wie "Erstelle eine Portfolio-Website" → Claude antwortet!

> Wenn alles funktioniert: Weiter zu Schritt 5!
> Wenn Fehler: Prüfe ob alle Keys in der .env korrekt sind.

Zum Stoppen: Drücke `Ctrl + C` im Terminal.

---

## SCHRITT 5: GitHub Repository erstellen

### Auf GitHub:

1. Öffne https://github.com
2. Klicke oben rechts auf **"+"** → **"New repository"**
3. Repository name: `qntum-designs`
4. Visibility: **Private** (empfohlen, wegen API-Keys)
5. NICHT ankreuzen: "Add a README file" (wir haben schon Dateien)
6. Klicke **"Create repository"**
7. Du siehst jetzt Befehle — die brauchst du gleich

### .gitignore erstellen (damit .env NICHT hochgeladen wird):

1. Erstelle im Projektordner eine Datei namens `.gitignore`
2. Inhalt:

```
node_modules/
.env
.DS_Store
```

3. Speichern

### Im Terminal:

```bash
cd /Users/ektasingh/Desktop/Webseiten/qntum-designs

git init
git add .
git commit -m "Initial release — Qntum Designs"
git branch -M main
git remote add origin https://github.com/DEIN-GITHUB-USERNAME/qntum-designs.git
git push -u origin main
```

> Ersetze `DEIN-GITHUB-USERNAME` mit deinem echten GitHub-Benutzernamen!
> Wenn nach Passwort gefragt wird: Verwende einen GitHub Personal Access Token (nicht dein Passwort).

---

## SCHRITT 6: Railway Deployment

1. Öffne https://railway.app
2. Klicke **"Login"** → **"Login with GitHub"**
3. Autorisiere Railway für deinen GitHub-Account

### Neues Projekt erstellen:

4. Klicke **"New Project"**
5. Wähle **"Deploy from GitHub Repo"**
6. Wähle dein Repository: `qntum-designs`
7. Railway erkennt automatisch, dass es ein Node.js-Projekt ist

### Environment Variables setzen:

8. Klicke auf dein Deployment (das lila Kästchen)
9. Klicke auf den Tab **"Variables"**
10. Füge ALLE diese Variablen einzeln hinzu (klick jeweils "New Variable"):

```
ANTHROPIC_API_KEY     =  sk-ant-api03-DEIN-KEY
SUPABASE_URL          =  https://DEIN-PROJEKT.supabase.co
SUPABASE_ANON_KEY     =  eyJhbGci-DEIN-ANON-KEY
SUPABASE_SERVICE_KEY  =  eyJhbGci-DEIN-SERVICE-KEY
SESSION_SECRET        =  ein-beliebiger-langer-text
PORT                  =  3000
NODE_ENV              =  production
```

11. Railway deployed automatisch neu nach dem Setzen der Variablen

### Domain einrichten:

12. Klicke auf den Tab **"Settings"**
13. Scrolle zu **"Networking"** → **"Public Networking"**
14. Klicke **"Generate Domain"**
15. Du bekommst eine URL wie: `qntum-designs-production.up.railway.app`
16. Öffne diese URL im Browser — deine App ist LIVE!

### Eigene Domain (optional):

17. Unter "Custom Domain" kannst du z.B. `app.qntum.design` eintragen
18. Railway zeigt dir DNS-Einträge die du bei deinem Domain-Provider setzen musst

---

## FERTIG!

Deine App läuft jetzt unter:
**https://qntum-designs-production.up.railway.app** (oder deine Custom Domain)

### Checkliste:
- [ ] Supabase Projekt erstellt + Schema ausgeführt
- [ ] Anthropic API-Key erstellt
- [ ] .env Datei erstellt
- [ ] Lokal getestet — alles funktioniert
- [ ] GitHub Repo erstellt + Code gepusht
- [ ] Railway Projekt erstellt + Variables gesetzt
- [ ] Domain generiert + App ist erreichbar

---

## Häufige Probleme

### "Cannot find module" Fehler auf Railway
→ Prüfe ob `package.json` im Root-Verzeichnis liegt (nicht in einem Unterordner)

### "Invalid API Key" im Chat
→ Prüfe den ANTHROPIC_API_KEY in den Railway Variables — kein Leerzeichen am Ende?

### Registrierung funktioniert nicht
→ Prüfe ob das Schema in Supabase korrekt ausgeführt wurde (SQL Editor → Run)
→ Prüfe SUPABASE_URL und SUPABASE_SERVICE_KEY

### Seite lädt aber Chat antwortet nicht
→ Prüfe ob ANTHROPIC_API_KEY gültig ist und Guthaben vorhanden ist (console.anthropic.com → Billing)

### Railway zeigt "Build failed"
→ Klicke auf "View Logs" und schau was der Fehler ist. Meistens fehlende Environment Variable.
