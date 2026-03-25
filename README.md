# ![HELFINANCE](logo.png)

**HELFINANCE** — Personal Finance Dashboard

A self-hosted, privacy-first finance tracker. Manage income, expenses, loans, savings goals, and household finances from a single clean dashboard. Runs as a single Docker container, stores everything in a local SQLite database, and works offline as a PWA.

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Health score gauge, budget traffic light, free money this month, upcoming bookings, savings progress |
| **Income** | Track salaries and recurring income; schedule future amount changes |
| **Expenses** | Group by category; monthly/quarterly/semi-annual/annual intervals; schedule changes |
| **Loans** | Annuity loan calculator with full amortization table; avalanche payoff hints |
| **Savings Goals** | Fixed, dynamic, or combined contribution modes; emergency reserve tracker |
| **Cashflow Calendar** | Daily booking overview + projected running balance chart |
| **Reports** | Monthly breakdown with category donut chart; yearly 12-column table |
| **Export** | PDF and CSV export for monthly and yearly reports |
| **Household** | Link two users; split shared expenses; see monthly balance ("User B owes User A: X€") |
| **Notifications** | In-app alerts for upcoming large expenses, negative projections, savings goals reached |
| **Email (SMTP)** | Optional email notifications via configurable SMTP; test button in admin |
| **OIDC Login** | Optional single sign-on via any OIDC provider (Authentik, Keycloak, etc.); native login always available |
| **Admin Panel** | SMTP config, OIDC config, default language/currency, user management |
| **PWA** | Installable on desktop and mobile; offline shell via service worker |
| **i18n** | German (default) and English; per-user language preference stored in DB |
| **Dark/Light Mode** | System preference + manual toggle |

---

## Quick Start

### Docker Run
```bash
docker run -d \
  --name helfinance \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /your/appdata/helfinance:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e DATABASE_PATH=/data/helfinance.db \
  -e PORT=3000 \
  ghcr.io/kreuzbube88/helfinance:latest
```

Then open `http://localhost:3000`. The first registered user is automatically assigned admin.

### Docker Compose
```bash
cp .env.example .env
# edit .env and set a strong SECRET_KEY
docker compose up -d
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | HTTP port the app listens on |
| `DATABASE_PATH` | `/data/helfinance.db` | No | Absolute path to the SQLite database file |
| `SECRET_KEY` | `changeme` | **Yes** | Secret used for JWT signing — use `openssl rand -hex 32` |

All other configuration (SMTP, OIDC, default currency/language) lives in the Admin UI and is stored in the database.

---

## Unraid Installation

HELFINANCE is not listed in the Community Applications store. Install it by importing the template URL manually.

### Import template via Community Applications

1. Open **Apps** (Community Applications) in Unraid
2. Click the **Settings** icon (top right) → **Use custom template URL**
   *(or go to **Docker** → **Add Container** → **Template** → paste URL)*
3. Paste the template URL:
   ```
   https://raw.githubusercontent.com/Kreuzbube88/helfinance/main/helfinance.xml
   ```
4. Click **Apply** — the template pre-fills all fields
5. Set `SECRET_KEY` to a random secret (e.g. output of `openssl rand -hex 32`)
6. Click **Apply** to create the container

### Manual via Docker UI (no template)

1. Go to **Docker** → **Add Container**
2. Fill in the following fields:

| Field | Value |
|-------|-------|
| Name | `helfinance` |
| Repository | `ghcr.io/kreuzbube88/helfinance:latest` |
| Network Type | `bridge` |
| Port | Host `3000` → Container `3000` (TCP) |
| Path | Host `/mnt/cache/appdata/helfinance` → Container `/data` (RW) |
| Variable `SECRET_KEY` | your random secret (required) |
| Variable `DATABASE_PATH` | `/data/helfinance.db` (optional, this is the default) |
| Variable `PORT` | `3000` (optional, this is the default) |

3. Click **Apply**

Data is stored in `/mnt/cache/appdata/helfinance/helfinance.db`.

---

## Development Setup

Requirements: Node.js 20+

### Backend
```bash
cd backend
npm install
cp ../.env.example .env   # edit DATABASE_PATH to a local path like ./helfinance.db
npm run dev               # starts on :3000 with ts-node-dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # starts on :5173, proxies /api → :3000
```

The frontend dev server (`localhost:5173`) automatically proxies all `/api/*` requests to the backend at `localhost:3000`.

### Build
```bash
cd backend && npm run build    # outputs to backend/dist/
cd frontend && npm run build   # outputs to frontend/dist/
```

---

## GitHub Actions

Two workflow dispatch triggers are available:

### Build dev image
**Actions** → **Build & Push Docker Image** → **Run workflow**
Builds and pushes `ghcr.io/kreuzbube88/helfinance:dev-DD.MM.YYYY-HH.MM.SS` (amd64 + arm64).

### Release
**Actions** → **Release Latest** → **Run workflow** → enter version (e.g. `1.0.0`)
- Bumps `backend/package.json` version
- Tags commit `v1.0.0`
- Pushes `ghcr.io/kreuzbube88/helfinance:1.0.0` and `:latest`
- Creates GitHub Release

### Cleanup dev images
**Actions** → **Cleanup Dev Packages** — deletes all `dev-*` tagged container images and untagged layers older than 7 days.

---

## Data

All persistent data lives in a single SQLite file at the path configured via `DATABASE_PATH` (default `/data/helfinance.db`).

### Database tables
```
users             — accounts, preferences
settings          — SMTP, OIDC, defaults (key/value)
categories        — expense categories per user
income            — recurring and one-time income
income_changes    — scheduled future amount changes
expenses          — recurring expenses
expense_changes   — scheduled future amount changes
loans             — annuity loans
savings_goals     — savings targets with contribution config
household_links   — two-user household connections
shared_expenses   — split expense configurations
notifications     — in-app alerts
monthly_snapshots — archived monthly summaries
```

Backup: copy the `.db` file. Restore: replace it. No migrations needed between minor versions — the schema runs `CREATE TABLE IF NOT EXISTS` on every start.

---

## Roadmap

- [ ] Multi-currency support with live exchange rates
- [ ] Recurring transaction import (CSV bank export)
- [ ] Budget envelope system
- [ ] Investment portfolio tracker
- [ ] PWA enhancements (offline mode, push notifications)
- [ ] Two-factor authentication
- [ ] API key access for external integrations

---

## About

HELFINANCE is a self-hosted personal finance tool built for homelab enthusiasts who want full control over their financial data without any cloud dependency.

*Coded with Claude.ai — because good prompts build great software.*
