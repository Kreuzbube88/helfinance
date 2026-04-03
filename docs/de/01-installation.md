# Installation

Willkommen bei HELFINANCE! Diese Anleitung zeigt dir drei Wege zur Installation — von der einfachsten bis zur fortgeschrittenen Methode.

---

## Unraid Community Applications (Empfohlen) ⭐

Die einfachste Methode: HELFINANCE ist direkt im Unraid Community App Store verfügbar.

**Schritt 1 — Apps öffnen**

Öffne dein Unraid Web-Interface und klicke auf den Tab **Apps**.

![Unraid Apps Tab](../images/unraid-apps-tab.png)

**Schritt 2 — HELFINANCE suchen**

Tippe in der Suchleiste `HELFINANCE` und drücke Enter.

![Unraid Suche](../images/unraid-search.png)

**Schritt 3 — Installieren**

Klicke auf **Install** beim HELFINANCE-Eintrag.

**Schritt 4 — Konfigurieren**

Im Installations-Dialog folgende Werte eintragen:

| Feld | Empfohlener Wert | Erklärung |
|------|-----------------|-----------|
| Port | `3000` | Port, unter dem die App erreichbar ist |
| Volume | `/mnt/user/appdata/helfinance:/data` | Wo die Datenbank gespeichert wird |
| SECRET_KEY | *(auto-generiert oder eigener Wert)* | Sicherheitsschlüssel — **wichtig!** |
| DATABASE_PATH | `/data/helfinance.db` | Pfad zur Datenbankdatei |

> ⚠️ **Wichtig:** Den `SECRET_KEY` sicher aufbewahren! Er wird für die Anmelde-Sicherheit benötigt. Änderst du ihn nachträglich, werden alle aktiven Sitzungen beendet.

**Schritt 5 — Apply**

Klicke auf **Apply**. Unraid lädt das Image herunter und startet den Container.

**Schritt 6 — Zugriff**

Öffne `http://[DEINE-UNRAID-IP]:3000` im Browser.

![HELFINANCE Login](../images/helfinance-login.png)

---

## Docker Run

Für alle, die Docker direkt auf einem Server oder NAS betreiben:

```bash
docker run -d \
  --name helfinance \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /pfad/zu/deinen/daten:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e DATABASE_PATH=/data/helfinance.db \
  ghcr.io/kreuzbube88/helfinance:latest
```

**Was bedeutet das?**

- `-d` → Container läuft im Hintergrund
- `--restart unless-stopped` → Container startet automatisch nach Neustart
- `-p 3000:3000` → Port 3000 nach außen weiterleiten
- `-v /pfad/zu/deinen/daten:/data` → Ordner für die Datenbank (ersetze den Pfad!)
- `-e SECRET_KEY=...` → Generiert automatisch einen sicheren Schlüssel
- `-e DATABASE_PATH=/data/helfinance.db` → Datenbankdatei im gemounteten Ordner

Danach erreichbar unter: `http://localhost:3000` (oder IP deines Servers)

---

## Docker Compose

Für eine sauberere Konfiguration mit einer YAML-Datei:

**Schritt 1 — `docker-compose.yml` erstellen**

```yaml
version: "3.8"

services:
  helfinance:
    image: ghcr.io/kreuzbube88/helfinance:latest
    container_name: helfinance
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - SECRET_KEY=dein-geheimer-schluessel-hier
      - DATABASE_PATH=/data/helfinance.db
      - PORT=3000
```

**Schritt 2 — Starten**

```bash
docker compose up -d
```

**Schritt 3 — Prüfen ob alles läuft**

```bash
docker compose logs helfinance
```

Du solltest sehen: `Server running on port 3000`

---

## Umgebungsvariablen

| Variable | Beschreibung | Standard | Pflicht |
|----------|-------------|---------|---------|
| `SECRET_KEY` | Sicherheitsschlüssel für Anmeldungen (JWT-Signierung). Nutze `openssl rand -hex 32` | `changeme` | **Ja** |
| `DATABASE_PATH` | Absoluter Pfad zur SQLite-Datenbankdatei | `/data/helfinance.db` | Nein |
| `PORT` | HTTP-Port der Anwendung | `3000` | Nein |

> ⚠️ **Sicherheit:** Setze immer einen eigenen `SECRET_KEY`! Der Standardwert `changeme` ist unsicher. Alle weiteren Einstellungen (SMTP, OIDC, Sprache, Währung) werden im Admin-Bereich der App vorgenommen und in der Datenbank gespeichert.

---

## Erster Start

**Konto erstellen**

Beim ersten Aufruf von HELFINANCE gibt es noch keine Benutzer. Klicke auf **Registrieren** und lege dein Admin-Konto an.

> ✅ Der erste registrierte Benutzer erhält automatisch Admin-Rechte.

**Sprache & Währung wählen**

Nach der Anmeldung wirst du durch das Onboarding geführt. Du kannst Sprache (Deutsch/Englisch) und Währung (€, $, £ etc.) jederzeit unter **Profil** ändern.

**Los geht's!**

Weiter mit: [Erste Schritte →](./02-erste-schritte.md)
