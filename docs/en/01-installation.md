# Installation

Welcome to HELFINANCE! This guide covers three ways to install it — from easiest to most advanced.

---

## Unraid Community Applications (Recommended) ⭐

The easiest method: HELFINANCE is available directly in the Unraid Community App Store.

**Step 1 — Open Apps**

Open your Unraid Web Interface and click the **Apps** tab.

![Unraid Apps Tab](../images/unraid-apps-tab.png)

**Step 2 — Search for HELFINANCE**

Type `HELFINANCE` in the search bar and press Enter.

![Unraid Search](../images/unraid-search.png)

**Step 3 — Install**

Click **Install** on the HELFINANCE entry.

**Step 4 — Configure**

In the installation dialog, enter the following values:

| Field | Recommended Value | Explanation |
|-------|------------------|-------------|
| Port | `3000` | Port to access the app |
| Volume | `/mnt/user/appdata/helfinance:/data` | Where the database is stored |
| SECRET_KEY | *(auto-generated or your own value)* | Security key — **important!** |
| DATABASE_PATH | `/data/helfinance.db` | Path to the database file |

> ⚠️ **Important:** Keep your `SECRET_KEY` safe! It is required for login security. If you change it later, all active sessions will be terminated.

**Step 5 — Apply**

Click **Apply**. Unraid will download the image and start the container.

**Step 6 — Access**

Open `http://[YOUR-UNRAID-IP]:3000` in your browser.

![HELFINANCE Login](../images/helfinance-login.png)

---

## Docker Run

For anyone running Docker directly on a server or NAS:

```bash
docker run -d \
  --name helfinance \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/your/data:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e DATABASE_PATH=/data/helfinance.db \
  ghcr.io/kreuzbube88/helfinance:latest
```

**What does this mean?**

- `-d` → Container runs in the background
- `--restart unless-stopped` → Container restarts automatically after a reboot
- `-p 3000:3000` → Forward port 3000 to the outside
- `-v /path/to/your/data:/data` → Folder for the database (replace the path!)
- `-e SECRET_KEY=...` → Automatically generates a secure key
- `-e DATABASE_PATH=/data/helfinance.db` → Database file in the mounted folder

Then open: `http://localhost:3000` (or your server's IP)

---

## Docker Compose

For a cleaner configuration using a YAML file:

**Step 1 — Create `docker-compose.yml`**

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
      - SECRET_KEY=your-secret-key-here
      - DATABASE_PATH=/data/helfinance.db
      - PORT=3000
```

**Step 2 — Start**

```bash
docker compose up -d
```

**Step 3 — Check if everything is running**

```bash
docker compose logs helfinance
```

You should see: `Server running on port 3000`

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Security key for logins (JWT signing). Use `openssl rand -hex 32` | `changeme` | **Yes** |
| `DATABASE_PATH` | Absolute path to the SQLite database file | `/data/helfinance.db` | No |
| `PORT` | HTTP port of the application | `3000` | No |

> ⚠️ **Security:** Always set your own `SECRET_KEY`! The default value `changeme` is insecure. All other settings (SMTP, OIDC, language, currency) are configured in the app's Admin Panel and stored in the database.

---

## First Launch

**Create an account**

On the first visit to HELFINANCE, there are no users yet. Click **Register** and create your admin account.

> ✅ The first registered user automatically receives admin rights.

**Choose language & currency**

After logging in, you'll be guided through onboarding. You can change language (German/English) and currency (€, $, £ etc.) at any time under **Profile**.

**Let's go!**

Continue with: [Getting Started →](./02-getting-started.md)
