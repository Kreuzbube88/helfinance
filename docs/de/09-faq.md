# Häufig gestellte Fragen (FAQ)

---

## Allgemein

### Wie ändere ich meine Sprache?

Gehe zu **Profil** (oben rechts) → **Sprache** → wähle Deutsch oder Englisch. Die Einstellung wird sofort übernommen und gespeichert.

### Wo sind meine Daten gespeichert?

Alle Daten liegen in einer SQLite-Datenbankdatei auf deinem eigenen Server — niemals in der Cloud.

- Standard-Pfad: `/data/helfinance.db`
- Docker: Im gemounteten Volume (`-v /dein/pfad:/data`)
- Unraid: `/mnt/user/appdata/helfinance/helfinance.db`

### Kann ich meine Daten exportieren?

Ja! Im [Reports-Bereich](./07-reports.md) gibt es Export-Buttons für:

- **CSV** — für Excel, LibreOffice, Google Sheets
- **PDF** — für Ablage oder Ausdruck

### Unterstützt HELFINANCE automatische Kontosynchronisation?

Nein. HELFINANCE ist ein manuelles Buchungssystem — du trägst Einnahmen und Ausgaben selbst ein. Eine automatische Verbindung zu deiner Bank ist nicht geplant.

### Funktioniert HELFINANCE offline?

Ja. HELFINANCE ist eine PWA (Progressive Web App). Wenn du die App einmal geöffnet hast, funktioniert die Benutzeroberfläche auch offline — neue Daten werden synchronisiert, sobald du wieder online bist.

---

## Daten & Sicherheit

### Wie sichere ich meine Daten?

Sichere das Docker-Volume regelmäßig. Das Volume enthält die komplette Datenbank.

**Unraid-Nutzer:** Das Unraid Backup-Plugin (z. B. CA Backup/Restore) kann AppData automatisch sichern.

**Manuell:**

```bash
# Datenbankdatei kopieren
cp /pfad/zu/helfinance.db /pfad/zum/backup/helfinance-$(date +%Y%m%d).db
```

### Was passiert bei einem Update oder Neuinstall?

Die Datenbank bleibt erhalten, solange das Volume gemountet bleibt. Updates des Docker-Images überschreiben nur die Anwendung, nicht die Daten.

Beim ersten Start prüft HELFINANCE automatisch, ob die Datenbankstruktur aktuell ist, und führt nötige Migrations-Schritte durch.

### Kann ich mehrere Haushalte verwalten?

Nein. HELFINANCE ist auf einen einzelnen Nutzer oder Haushalt ausgelegt. Multi-Haushalt-Verwaltung ist nicht vorgesehen.

---

## Features & Funktionen

### Kann ich Sparziele definieren?

Nein. Die aktuelle Version bietet einfache Rücklagen-Verwaltung (Kontostand, Ein-/Auszahlungen, Verlauf). Ein Ziel-System mit definierten Zielen und Fortschrittsbalken ist nicht enthalten.

Mehr dazu: [Rücklagen & Notgroschen](./06-ruecklagen.md)

### Wie berechnet sich der Health Score?

Der Health Score basiert auf dem Verhältnis von freiem Geld zu Gesamteinnahmen. Details: [Dashboard → Health Score](./03-dashboard.md#health-score)

### Warum zeigt das Dashboard andere Werte als mein Kontoauszug?

HELFINANCE zeigt **geplante** Einnahmen und Ausgaben basierend auf deinen Buchungen — keine tatsächlichen Kontobewegungen. Abweichungen entstehen, wenn:

- Buchungen andere Beträge haben als eingetragen
- Variable Ausgaben (z. B. Lebensmittel) tatsächlich anders ausfallen
- Einmalzahlungen nicht erfasst wurden

### Gibt es eine API-Dokumentation?

Nein. Die interne API wird nur vom HELFINANCE-Frontend genutzt und ist nicht für externe Nutzung vorgesehen.

---

## Technisches

### Welche Browser werden unterstützt?

Alle modernen Browser: Chrome, Firefox, Safari, Edge (jeweils aktuelle Version). Internet Explorer wird nicht unterstützt.

### Kann ich HELFINANCE hinter einem Reverse Proxy betreiben?

Ja. HELFINANCE funktioniert hinter nginx, Traefik oder ähnlichen Proxies. Setze die üblichen Header (`X-Forwarded-For`, `X-Real-IP`).

Beispiel für Traefik-Label (Docker Compose):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.helfinance.rule=Host(`finance.dein-server.de`)"
  - "traefik.http.services.helfinance.loadbalancer.server.port=3000"
```

### Ich habe einen Fehler gefunden — wo melde ich ihn?

Öffne ein Issue auf GitHub: [github.com/Kreuzbube88/helfinance/issues](https://github.com/Kreuzbube88/helfinance/issues)

Bitte beschreibe:
- Was du gemacht hast
- Was erwartet wurde
- Was stattdessen passiert ist
- Browser und Version

---

[← Zurück zur Übersicht](./01-installation.md)
