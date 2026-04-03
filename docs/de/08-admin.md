# Admin-Panel

Das Admin-Panel ist nur für Benutzer mit Admin-Rechten sichtbar. Hier konfigurierst du globale Einstellungen für alle Nutzer deiner HELFINANCE-Installation.

Erreichbar über: **Profil → Admin-Panel** (nur wenn du Admin bist)

---

## SMTP konfigurieren (E-Mail-Benachrichtigungen)

SMTP ermöglicht es HELFINANCE, E-Mails zu versenden — zum Beispiel Benachrichtigungen bei kritischen Budget-Warnungen.

### Einrichtung

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| SMTP-Server | Hostname des E-Mail-Servers | `smtp.gmail.com` |
| Port | SMTP-Port | `587` (TLS) oder `465` (SSL) |
| Benutzername | E-Mail-Adresse oder Login | `dein@gmail.com` |
| Passwort | E-Mail-Passwort oder App-Passwort | *(geheim)* |
| Absender-Name | Anzeigename im Postfach | "HELFINANCE" |
| Absender-E-Mail | Absenderadresse | `noreply@dein-server.de` |

**Test-Button**

Nach dem Speichern kannst du auf **Test-E-Mail senden** klicken. Du erhältst eine Test-Nachricht an deine Admin-Adresse.

> ⚠️ Bei Gmail: Nutze ein **App-Passwort** statt deines normalen Passworts (Google Konto → Sicherheit → App-Passwörter).

---

## OIDC konfigurieren (Single Sign-On)

OIDC (OpenID Connect) erlaubt die Anmeldung über externe Identity Provider wie Authentik oder Keycloak. Das normale Login-Formular bleibt immer verfügbar.

### Wann ist OIDC sinnvoll?

- Du betreibst bereits einen Identity Provider im Homelab
- Mehrere Apps sollen denselben Login verwenden
- Zentrales Benutzermanagement gewünscht

### Konfiguration

| Feld | Beschreibung |
|------|-------------|
| Client ID | ID aus deinem Identity Provider |
| Client Secret | Geheimnis aus deinem Identity Provider |
| Issuer URL | Discovery-URL deines Providers |
| Redirect URI | Wird automatisch ausgefüllt: `https://[deine-domain]/auth/oidc/callback` |

### Beispiel: Authentik

1. In Authentik: Neue OAuth2/OIDC-Anwendung erstellen
2. Redirect URI: `http://[HELFINANCE-IP]:3000/auth/oidc/callback`
3. Client ID und Secret kopieren
4. Issuer URL: `https://[authentik-domain]/application/o/[slug]/`
5. Werte in HELFINANCE Admin-Panel eintragen

### Beispiel: Keycloak

1. In Keycloak: Neuen Client anlegen (Client Protocol: openid-connect)
2. Valid Redirect URIs: `http://[HELFINANCE-IP]:3000/*`
3. Client ID und Secret kopieren
4. Issuer URL: `https://[keycloak-domain]/realms/[realm]/`

---

## Standard-Einstellungen

Hier legst du fest, welche Standardwerte neue Benutzer bei der Registrierung erhalten:

| Einstellung | Beschreibung | Optionen |
|------------|-------------|---------|
| Standard-Sprache | Sprache für neue Nutzer | Deutsch, Englisch |
| Standard-Währung | Währungssymbol für neue Nutzer | €, $, £, CHF, … |

Diese Einstellungen können Nutzer jederzeit in ihrem eigenen Profil ändern.

---

## Benutzerverwaltung

Eine Übersicht aller registrierten Benutzer:

| Spalte | Beschreibung |
|--------|-------------|
| Name | Benutzername |
| E-Mail | Registrierte E-Mail-Adresse |
| Admin | Hat der Nutzer Admin-Rechte? |
| Aktiv | Ist der Account aktiv? |

**Aktionen:**

- **Admin-Rechte vergeben/entziehen** — Toggle neben dem Nutzernamen
- **Nutzer deaktivieren** — Zugang sperren ohne Datenlöschung

### Registrierung steuern

Im Admin-Panel kannst du die öffentliche Registrierung deaktivieren:

- **Registrierung aktiv** → Jeder mit Zugang zur App kann sich registrieren
- **Registrierung deaktiviert** → Nur Admin kann neue Accounts manuell anlegen

> ✅ Empfehlung für Einzel-Nutzer: Registrierung nach Einrichtung deaktivieren.

---

## Kategorien verwalten

Standard-Kategorien für alle Nutzer:

- Hier können globale Standard-Kategorien angelegt werden
- Nutzer können eigene Kategorien zusätzlich erstellen
- Standard-Kategorien erscheinen als Vorschläge bei neuen Ausgaben

---

Weiter mit: [Häufige Fragen (FAQ) →](./09-faq.md)
