# Einnahmen & Ausgaben verwalten

Buchungen sind das Herzstück von HELFINANCE. Hier erfasst du alles, was regelmäßig rein- oder rausgeht.

---

## Navigation

Unter **Buchungen** findest du zwei Tabs:

- **Einnahmen** — Gehalt, Nebeneinkünfte, Kindergeld, Mieteinnahmen…
- **Ausgaben** — Miete, Strom, Lebensmittel, Versicherungen…

![Buchungen Tabs](../images/bookings-tabs.png)

---

## Einnahmen

### Neue Einnahme hinzufügen

Klicke auf **+ Einnahme hinzufügen** und fülle das Formular aus:

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| Name | Bezeichnung der Einnahme | "Gehalt" |
| Betrag | Monatlicher Betrag in deiner Währung | 2.800 |
| Buchungstag | Tag im Monat, an dem die Einnahme eingeht | 15 |
| Gültig ab | Ab welchem Datum gilt diese Buchung | 01.01.2025 |
| Gültig bis | Optionales Enddatum | leer lassen |
| Intervall | Wie oft kommt die Einnahme | Monatlich |

> ✅ Die **Live-Vorschau** rechts im Formular zeigt sofort, wie sich deine Finanzübersicht mit dieser Buchung ändert.

### Einnahme bearbeiten

Klicke auf eine vorhandene Einnahme, um das Detail-Panel zu öffnen. Dort kannst du:

- Betrag und Name ändern
- Eine **Planänderung** anlegen (z. B. Gehaltserhöhung ab März)
- Ein Enddatum setzen (z. B. befristeter Job)

### Planänderung (Gehaltserhöhung)

Wenn sich dein Gehalt ändert, lösche nicht die alte Buchung — nutze stattdessen eine **Planänderung**:

1. Einnahme anklicken → Detail-Panel öffnet sich
2. "Änderung planen" wählen
3. Neuen Betrag und **Gültig ab**-Datum eingeben

✅ Beispiel: Gehalt steigt von 2.800€ auf 3.100€ ab 01.04.2025

HELFINANCE zeigt bis März den alten Betrag, ab April den neuen — die Historie bleibt erhalten.

---

## Ausgaben

### Neue Ausgabe hinzufügen

Ausgaben funktionieren wie Einnahmen, haben aber zusätzlich:

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| Kategorie | Thematische Einordnung | "Wohnen" |
| Budget-Limit | Optionale Warnschwelle (für variable Ausgaben) | 400€ |

### Ausgaben-Kategorien

Kategorien helfen bei der Analyse in [Reports](./07-reports.md). Empfohlene Kategorien:

| Kategorie | Typische Buchungen |
|-----------|------------------|
| Wohnen | Miete, Nebenkosten, Internet |
| Mobilität | Autokredit, Tanken, ÖPNV, Versicherung |
| Lebensmittel | Supermarkt, Wochenmarkt |
| Freizeit | Streaming, Hobby, Restaurant |
| Versicherungen | Haftpflicht, Hausrat, Kranken |
| Gesundheit | Arzt, Medikamente, Sport |
| Sparen | Regelmäßige Sparbeträge |

**Eigene Kategorie anlegen:** Im Admin-Panel unter *Kategorien verwalten* oder direkt beim Hinzufügen einer Ausgabe.

---

## Intervalle erklärt

HELFINANCE rechnet alle Ausgaben auf monatliche Beträge um. Das ist wichtig für korrekte Dashboard-Werte.

| Intervall | Buchungsfrequenz | Beispiel | Monatlicher Anteil |
|-----------|-----------------|---------|-------------------|
| Monatlich | Jeden Monat | Miete 800€ | 800€ |
| Vierteljährlich | Alle 3 Monate | Versicherung 150€ | 50€ |
| Halbjährlich | Alle 6 Monate | GEZ 55€ | ~9,17€ |
| Jährlich | Einmal im Jahr | KFZ-Steuer 180€ | 15€ |

> ✅ **Richtig:** KFZ-Steuer 180€ als **jährlich** eingeben
> ❌ **Falsch:** KFZ-Steuer 15€ als **monatlich** eingeben (verliert den Kontext)

---

## Live-Vorschau

Wenn du eine Buchung hinzufügst oder bearbeitest, siehst du rechts neben dem Formular eine Live-Vorschau:

- Aktualisiert sich bei jeder Eingabe
- Zeigt das neue freie Geld nach dieser Buchung
- Zeigt den neuen Health Score

So siehst du sofort, welche Auswirkung eine Ausgabe hat, bevor du speicherst.

---

## Erweiterte Optionen (Progressive Disclosure)

Das Formular zeigt zunächst nur die wichtigsten Felder. Klicke auf **Erweiterte Optionen**, um mehr zu sehen:

- Gültig bis (Enddatum)
- Budget-Limit
- Buchungstag
- Notizen

---

## Quick Add (Mobile / FAB-Button)

Auf dem Handy erscheint ein **+**-Button unten rechts auf dem Bildschirm. Damit öffnet sich ein vereinfachtes Formular für schnelle Eingaben — ideal für unterwegs.

---

## Tipps

**Fixkosten vs. variable Ausgaben**

- **Fixkosten:** Gleicher Betrag jeden Monat → monatlich, gleicher Buchungstag
  - Beispiele: Miete, Internet, Handyvertrag, Netflix
- **Variable Ausgaben:** Schwanken → monatlich mit Durchschnittsbetrag
  - Beispiele: Lebensmittel, Tanken, Restaurants

**Jährliche Ausgaben richtig erfassen**

| Ausgabe | Betrag | Intervall | Buchungstag | Monat |
|---------|--------|-----------|-------------|-------|
| KFZ-Steuer | 180€ | Jährlich | 15 | März |
| Hausrat-Versicherung | 90€ | Jährlich | 1 | Januar |

**Kategorien best practices**

- Max. 8–10 Kategorien für klare Reports
- Ähnliche Ausgaben zusammenfassen (z. B. alle Versicherungen in eine Kategorie)
- Keine Kategorie "Sonstiges" — lieber passende Kategorie wählen

---

Weiter mit: [Kredite & Darlehen →](./05-kredite.md)
