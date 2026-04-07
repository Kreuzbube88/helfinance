<p align="center">
  <img src="frontend/public/logo.png" alt="HELFINANCE" width="450" height="450"/>
</p>

<p align="center">
  <strong>Personal Finance Dashboard for Homelab</strong>
</p>

<p align="center">
  <a href="README.de.md">🇩🇪 Deutsch</a> &nbsp;|&nbsp; 🇬🇧 English
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-yellow" alt="Status">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js">
  <img src="https://img.shields.io/github/license/Kreuzbube88/helfinance" alt="License">
  <img src="https://img.shields.io/badge/platform-Unraid-orange" alt="Platform">
</p>

---

HELFINANCE is a self-hosted personal finance tracker built for homelab enthusiasts. It runs as a single Docker container, stores everything in a local SQLite database, and gives you full control over your financial data — no cloud dependency, no subscription, works offline as a PWA.

> ⚠️ HELFINANCE was built entirely with AI (Claude.ai). It is not designed for public internet exposure and should only be used within a local network / homelab.

---

## Features

- **Dashboard** — Health score gauge, budget traffic light, free money this month, upcoming bookings
- **Bookings** — Income and expense tracking with recurring schedules, future amount changes, and category budget limits
- **Loans** — Annuity loan calculator with full amortization table, special payments, and avalanche payoff hints
- **Savings Tracking** — Savings balance, irregular expenses reserve, and emergency fund recommendations
- **Reports** — Monthly/yearly overview with donut chart, income/expense tables, required savings breakdown, and 6-month history
- **Notifications** — In-app alerts for negative projections and large upcoming expenses
- **Email (SMTP)** — Optional email notifications via configurable SMTP
- **OIDC Login** — Optional SSO via any OIDC provider (Authentik, Keycloak, etc.); native login always available
- **Admin Panel** — SMTP config, OIDC config, default language/currency, user management, registration control
- **PWA** — Installable on desktop and mobile; offline shell via service worker
- **i18n** — German (default) and English; per-user language preference
- **Dark/Light Mode** — Manual toggle

---

## Installation

### Unraid Community Apps (recommended)

1. Open the **Apps** tab in Unraid
2. Search for **HELFINANCE**
3. Click **Install** and follow the template

HELFINANCE will be available at `http://YOUR-UNRAID-IP:3000`.

### Docker Compose

```yaml
services:
  helfinance:
    image: ghcr.io/kreuzbube88/helfinance:latest
    container_name: helfinance
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - SECRET_KEY=your_secret_here   # openssl rand -hex 32
      - DATABASE_PATH=/data/helfinance.db
      - TZ=Europe/Berlin
    volumes:
      - /mnt/user/appdata/helfinance:/data
```

### Docker Run

```bash
docker run -d \
  --name helfinance \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/appdata:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e DATABASE_PATH=/data/helfinance.db \
  ghcr.io/kreuzbube88/helfinance:latest
```

---

## Quick Start

After installation, open the web UI at `http://YOUR-IP:3000`. The first registered user becomes the admin automatically. Head to the **Admin** panel to configure SMTP, OIDC, default currency, and language.

---

## Documentation

Full documentation is available in the [`docs/`](docs/en/01-installation.md) folder in both German and English, covering installation, bookings, loans, savings, reports, and admin configuration.

---

## Requirements

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | HTTP port the app listens on |
| `DATABASE_PATH` | `/data/helfinance.db` | No | Absolute path to the SQLite database file |
| `SECRET_KEY` | `changeme` | **Yes** | Secret used for JWT signing — use `openssl rand -hex 32` |

All other configuration (SMTP, OIDC, default currency/language) lives in the Admin UI and is stored in the database.

---

## License

MIT © 2024 HEL*Apps
