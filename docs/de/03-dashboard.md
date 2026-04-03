# Dashboard

Das Dashboard ist deine Finanz-Zentrale. Auf einen Blick siehst du, wie es um deine Finanzen steht.

![Dashboard Übersicht](../images/dashboard-overview.png)

---

## Die vier Widgets

### 🩺 Health Score

Der Health Score ist eine Zahl zwischen 0 und 100, die deine finanzielle Gesundheit zusammenfasst.

**Berechnung (vereinfacht):**

```
Health Score = (Freies Geld / Einnahmen) × 100
```

Ein Score von 30 bedeutet: Du sparst/behältst 30% deiner Einnahmen nach allen Ausgaben.

**Skala:**

| Score | Bewertung | Was das bedeutet |
|-------|-----------|-----------------|
| 90–100 | 🌟 Hervorragend | Du lebst weit unter deinen Verhältnissen |
| 70–89 | ✅ Gut | Solide Finanzen, guter Puffer |
| 50–69 | 🟡 Mittel | Ausgaben sollten beobachtet werden |
| 30–49 | 🟠 Niedrig | Wenig Spielraum, prüfe Ausgaben |
| 0–29 | 🔴 Kritisch | Ausgaben übersteigen Einnahmen |

> ✅ Tipp: Ziel ist ein Score über 70. Alles unter 50 sollte zum Überdenken der Ausgaben motivieren.

---

### 🚦 Ampel (Traffic Light)

Die Ampel gibt dir sofort ein Gefühl für deine Budget-Situation — ohne Zahlen lesen zu müssen.

| Farbe | Bedeutung | Schwellenwert |
|-------|-----------|--------------|
| 🟢 Grün | Alles im grünen Bereich | Freies Geld > 20% der Einnahmen |
| 🟡 Gelb | Knappe Kasse | Freies Geld 5–20% der Einnahmen |
| 🔴 Rot | Ausgaben zu hoch | Freies Geld < 5% oder negativ |

---

### 💰 Freies Geld

Zeigt, wie viel Geld dir in diesem Monat nach allen Verpflichtungen übrig bleibt.

**Berechnung:**

```
Freies Geld = Monatliche Einnahmen
            − Monatliche Ausgaben
            − Monatliche Kreditraten
```

**Beispiel:**

| Position | Betrag |
|----------|--------|
| Gehalt | 2.800€ |
| − Miete | −800€ |
| − Strom/Gas | −120€ |
| − Internet | −40€ |
| − Lebensmittel | −400€ |
| − Autokredit | −250€ |
| **= Freies Geld** | **1.190€** |

> ⚠️ **Hinweis:** Jährliche oder quartalsweise Ausgaben werden anteilig berechnet. Eine KFZ-Steuer von 180€/Jahr zählt als 15€/Monat.

---

### 📅 Anstehende Buchungen

Listet alle Buchungen der nächsten Tage und Wochen, sortiert nach Datum. So siehst du auf einen Blick, wann Geld fließt.

Angezeigt werden:
- Name der Buchung
- Datum (Buchungstag dieses Monats)
- Betrag (Einnahme grün, Ausgabe rot)
- Kategorie (bei Ausgaben)

---

## Warnungen

Das Dashboard zeigt automatisch Warnhinweise, wenn etwas Aufmerksamkeit braucht:

### Liquiditätswarnung

Erscheint, wenn das freie Geld negativ ist oder die Ampel auf Rot steht.

> ⚠️ "Deine monatlichen Ausgaben übersteigen deine Einnahmen."

**Was tun?** Prüfe unter [Buchungen](./04-buchungen.md), welche Ausgaben reduziert werden können.

### Rücklagen-Warnung

Erscheint, wenn dein Rücklagen-Kontostand unter dem empfohlenen Notgroschen liegt.

> ⚠️ "Deine Rücklagen liegen unter dem empfohlenen Mindestbetrag (3 Monate Ausgaben)."

**Was tun?** Mehr dazu in der [Rücklagen-Anleitung](./06-ruecklagen.md).

---

## Mobile Ansicht (PWA)

HELFINANCE ist als PWA (Progressive Web App) installierbar — wie eine native App auf deinem Handy.

**Installation auf Android/iOS:**
1. HELFINANCE im Browser öffnen
2. "Zum Startbildschirm hinzufügen" wählen
3. App-Icon erscheint auf dem Homescreen

**FAB-Button (Floating Action Button)**

Auf dem Handy erscheint ein `+`-Button unten rechts. Damit kannst du schnell neue Buchungen hinzufügen, ohne durch Menüs zu navigieren.

---

Weiter mit: [Einnahmen & Ausgaben →](./04-buchungen.md)
