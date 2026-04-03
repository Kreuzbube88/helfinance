# Kredite & Darlehen

HELFINANCE hilft dir, Kredite im Überblick zu behalten und zu verstehen, wie lange du noch zahlst.

---

## Was ist ein Annuitätenkredit?

Ein **Annuitätenkredit** ist die häufigste Kreditform — zum Beispiel für Autos oder Renovierungen. Du zahlst jeden Monat den gleichen Betrag (die "Rate"). Am Anfang ist darin mehr Zinsen, am Ende mehr Tilgung (Rückzahlung).

**Einfaches Beispiel:**

- Kreditbetrag: 10.000€
- Zinssatz: 5% pro Jahr
- Laufzeit: 3 Jahre
- Monatliche Rate: ~299,71€

---

## Kredit hinzufügen

Klicke auf **+ Kredit hinzufügen** und fülle das Formular aus:

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| Bezeichnung | Name des Kredits | "Autokredit VW Golf" |
| Darlehensbetrag | Die ursprünglich geliehene Summe | 15.000€ |
| Zinssatz | Jährlicher Zinssatz in Prozent | 4,5 |
| Laufzeit | Gesamtlaufzeit in Monaten | 48 (= 4 Jahre) |
| Startdatum | Wann hat der Kredit begonnen? | 01.03.2024 |

> ✅ Nach dem Speichern berechnet HELFINANCE automatisch deine monatliche Rate und erstellt den vollständigen Tilgungsplan.

---

## Tilgungsplan (Amortisationsplan)

Der Tilgungsplan zeigt für jeden Monat der Kreditlaufzeit:

| Spalte | Bedeutung |
|--------|-----------|
| Monat | Monat der Rate |
| Rate | Gesamter Zahlungsbetrag |
| Zinsen | Anteil der Zinsen an dieser Rate |
| Tilgung | Anteil der Rückzahlung |
| Restschuld | Verbleibende Schuldensumme nach dieser Rate |

**Warum sinkt die Restschuld langsam am Anfang?**

Am Anfang eines Kredits ist die Restschuld hoch → mehr Zinsen fallen an → weniger der Rate geht in die Tilgung. Mit jeder Zahlung sinkt die Restschuld, also sinken auch die Zinsen → mehr Tilgung. Das nennt man **Amortisation**.

![Tilgungsplan](../images/loan-amortization.png)

---

## Dashboard-Integration

Kreditraten werden automatisch im Dashboard berücksichtigt:

```
Freies Geld = Einnahmen − Ausgaben − Kreditraten
```

Jeder aktive Kredit zählt als monatliche Verpflichtung und beeinflusst den Health Score.

> ✅ Du musst Kreditraten **nicht** zusätzlich unter "Ausgaben" erfassen — sie werden direkt aus dem Kredit-Bereich berechnet.

---

## Kredite in Reports

In den [Monthly Reports](./07-reports.md) erscheinen Kreditraten als eigene Zeile in der Ausgaben-Übersicht. So siehst du klar, wie viel Anteil Kredite an deinen monatlichen Ausgaben haben.

---

## Sondertilgungen

Du hast eine größere Summe übrig und möchtest den Kredit schneller abbezahlen? Trage eine **Sondertilgung** ein:

1. Kredit anklicken → Detailansicht
2. "Sondertilgung hinzufügen" wählen
3. Betrag und Datum eingeben

HELFINANCE berechnet den Tilgungsplan neu und zeigt dir, wie viele Monate du sparst und wie viel Zinsen du dadurch nicht zahlen musst.

---

## Avalanche-Hinweis

Wenn du mehrere Kredite hast, zeigt HELFINANCE einen **Avalanche-Hinweis**: Welchen Kredit solltest du zuerst abbezahlen, um insgesamt am wenigsten Zinsen zu zahlen?

**Strategie:** Kredit mit dem höchsten Zinssatz zuerst tilgen — das spart langfristig am meisten.

---

Weiter mit: [Rücklagen & Notgroschen →](./06-ruecklagen.md)
