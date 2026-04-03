# Frequently Asked Questions (FAQ)

---

## General

### How do I change my language?

Go to **Profile** (top right) → **Language** → choose German or English. The setting takes effect immediately and is saved.

### Where is my data stored?

All data is stored in a SQLite database file on your own server — never in the cloud.

- Default path: `/data/helfinance.db`
- Docker: In the mounted volume (`-v /your/path:/data`)
- Unraid: `/mnt/user/appdata/helfinance/helfinance.db`

### Can I export my data?

Yes! In the [Reports section](./07-reports.md) there are export buttons for:

- **CSV** — for Excel, LibreOffice, Google Sheets
- **PDF** — for filing or printing

### Does HELFINANCE support automatic bank synchronization?

No. HELFINANCE is a manual entry system — you enter income and expenses yourself. Automatic connection to your bank is not planned.

### Does HELFINANCE work offline?

Yes. HELFINANCE is a PWA (Progressive Web App). Once you've opened the app, the interface works offline — new data syncs as soon as you're back online.

---

## Data & Security

### How do I back up my data?

Back up the Docker volume regularly. The volume contains the complete database.

**Unraid users:** The Unraid Backup plugin (e.g. CA Backup/Restore) can automatically back up AppData.

**Manually:**

```bash
# Copy database file
cp /path/to/helfinance.db /path/to/backup/helfinance-$(date +%Y%m%d).db
```

### What happens during an update or reinstall?

The database is preserved as long as the volume remains mounted. Updates to the Docker image only overwrite the application, not the data.

On first launch, HELFINANCE automatically checks whether the database structure is current and performs any necessary migration steps.

### Can I manage multiple households?

No. HELFINANCE is designed for a single user or household. Multi-household management is not supported.

---

## Features & Functions

### Can I define savings goals?

No. The current version offers simple savings tracking (account balance, deposits/withdrawals, history). A goal system with defined targets and progress bars is not included.

More details: [Savings & Emergency Fund](./06-savings.md)

### How is the Health Score calculated?

The Health Score is based on the ratio of free money to total income. Details: [Dashboard → Health Score](./03-dashboard.md#health-score)

### Why does the dashboard show different values than my bank statement?

HELFINANCE shows **planned** income and expenses based on your bookings — not actual bank transactions. Differences arise when:

- Bookings have different amounts than actually charged
- Variable expenses (e.g. groceries) differ from the budgeted amount
- One-time payments were not recorded

### Is there an API documentation?

No. The internal API is only used by the HELFINANCE frontend and is not intended for external use.

---

## Technical

### Which browsers are supported?

All modern browsers: Chrome, Firefox, Safari, Edge (current versions). Internet Explorer is not supported.

### Can I run HELFINANCE behind a reverse proxy?

Yes. HELFINANCE works behind nginx, Traefik, or similar proxies. Set the usual headers (`X-Forwarded-For`, `X-Real-IP`).

Example Traefik label (Docker Compose):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.helfinance.rule=Host(`finance.your-server.com`)"
  - "traefik.http.services.helfinance.loadbalancer.server.port=3000"
```

### I found a bug — where do I report it?

Open an issue on GitHub: [github.com/Kreuzbube88/helfinance/issues](https://github.com/Kreuzbube88/helfinance/issues)

Please include:
- What you were doing
- What was expected
- What happened instead
- Browser and version

---

[← Back to Overview](./01-installation.md)
