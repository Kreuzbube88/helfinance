# Admin Panel

The Admin Panel is only visible to users with admin rights. Here you configure global settings for all users of your HELFINANCE installation.

Access via: **Profile → Admin Panel** (only visible if you are an admin)

---

## Configure SMTP (Email Notifications)

SMTP allows HELFINANCE to send emails — for example, notifications for critical budget warnings.

### Setup

| Field | Description | Example |
|-------|-------------|---------|
| SMTP Server | Hostname of the email server | `smtp.gmail.com` |
| Port | SMTP port | `587` (TLS) or `465` (SSL) |
| Username | Email address or login | `you@gmail.com` |
| Password | Email password or app password | *(secret)* |
| Sender Name | Display name in the inbox | "HELFINANCE" |
| Sender Email | From address | `noreply@your-server.com` |

**Test Button**

After saving, click **Send Test Email**. You'll receive a test message at your admin address.

> ⚠️ For Gmail: Use an **App Password** instead of your regular password (Google Account → Security → App Passwords).

---

## Configure OIDC (Single Sign-On)

OIDC (OpenID Connect) allows login via external identity providers like Authentik or Keycloak. The normal login form always remains available.

### When does OIDC make sense?

- You already run an identity provider in your homelab
- Multiple apps should share the same login
- Centralized user management is desired

### Configuration

| Field | Description |
|-------|-------------|
| Client ID | ID from your identity provider |
| Client Secret | Secret from your identity provider |
| Issuer URL | Discovery URL of your provider |
| Redirect URI | Auto-filled: `https://[your-domain]/auth/oidc/callback` |

### Example: Authentik

1. In Authentik: Create a new OAuth2/OIDC application
2. Redirect URI: `http://[HELFINANCE-IP]:3000/auth/oidc/callback`
3. Copy Client ID and Secret
4. Issuer URL: `https://[authentik-domain]/application/o/[slug]/`
5. Enter values in HELFINANCE Admin Panel

### Example: Keycloak

1. In Keycloak: Create a new client (Client Protocol: openid-connect)
2. Valid Redirect URIs: `http://[HELFINANCE-IP]:3000/*`
3. Copy Client ID and Secret
4. Issuer URL: `https://[keycloak-domain]/realms/[realm]/`

---

## Default Settings

Here you define the default values new users receive upon registration:

| Setting | Description | Options |
|---------|-------------|---------|
| Default Language | Language for new users | German, English |
| Default Currency | Currency symbol for new users | €, $, £, CHF, … |

Users can always change these settings in their own profile.

---

## User Management

An overview of all registered users:

| Column | Description |
|--------|-------------|
| Name | Username |
| Email | Registered email address |
| Admin | Does the user have admin rights? |
| Active | Is the account active? |

**Actions:**

- **Grant/revoke admin rights** — toggle next to the username
- **Deactivate user** — block access without deleting data

### Control Registration

In the Admin Panel you can disable public registration:

- **Registration active** → Anyone with access to the app can register
- **Registration disabled** → Only admin can manually create new accounts

> ✅ Recommendation for single-user installs: Disable registration after setup.

---

## Manage Categories

Global default categories for all users:

- System-wide default categories can be created here
- Users can additionally create their own categories
- Default categories appear as suggestions when adding new expenses

---

Continue with: [FAQ →](./09-faq.md)
