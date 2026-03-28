import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      language TEXT DEFAULT 'de',
      currency TEXT DEFAULT 'EUR',
      onboarding_done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '💰',
      color TEXT DEFAULT '#6366f1',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      interval TEXT DEFAULT 'monthly' CHECK(interval IN ('monthly','yearly','once')),
      booking_day INTEGER DEFAULT 1,
      effective_from TEXT,
      effective_to TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS income_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      income_id INTEGER NOT NULL,
      new_amount REAL NOT NULL,
      effective_from TEXT NOT NULL,
      FOREIGN KEY(income_id) REFERENCES income(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      interval_months INTEGER DEFAULT 1 CHECK(interval_months IN (1,3,6,12)),
      category_id INTEGER,
      booking_day INTEGER DEFAULT 1,
      effective_from TEXT,
      effective_to TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS expense_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      new_amount REAL NOT NULL,
      effective_from TEXT NOT NULL,
      FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      principal REAL NOT NULL,
      interest_rate_pct REAL NOT NULL,
      start_date TEXT NOT NULL,
      term_months INTEGER NOT NULL,
      monthly_rate REAL,
      category_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      contribution_mode TEXT DEFAULT 'fixed' CHECK(contribution_mode IN ('fixed','dynamic','both')),
      fixed_amount REAL DEFAULT 0,
      dynamic_buffer_amount REAL DEFAULT 0,
      color TEXT DEFAULT '#10b981'
    );

    CREATE TABLE IF NOT EXISTS household_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_a_id INTEGER NOT NULL,
      user_b_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active')),
      invited_by INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_link_id INTEGER NOT NULL,
      expense_id INTEGER NOT NULL,
      split_ratio_a REAL DEFAULT 0.5,
      split_ratio_b REAL DEFAULT 0.5,
      paid_by_user_id INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      income_total REAL DEFAULT 0,
      expense_total REAL DEFAULT 0,
      savings_total REAL DEFAULT 0,
      data_json TEXT DEFAULT '{}',
      UNIQUE(user_id, year, month)
    );
  `);

  // Add category TEXT column to expenses (idempotent — fails silently if already exists)
  try { db.exec('ALTER TABLE expenses ADD COLUMN category TEXT'); } catch {}

  // V1: Manual transactions log
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      category_id INTEGER,
      date TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // V2: Budget limits per category
  try { db.exec('ALTER TABLE categories ADD COLUMN budget_limit REAL DEFAULT NULL'); } catch {}

  // V6: Widget preferences stored per user as JSON in settings-like table
  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_preferences (
      user_id INTEGER NOT NULL,
      widget_key TEXT NOT NULL,
      visible INTEGER DEFAULT 1,
      PRIMARY KEY(user_id, widget_key),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Housing', icon: '\u{1F3E0}', color: '#6366f1' },
  { name: 'Mobility', icon: '\u{1F697}', color: '#f59e0b' },
  { name: 'Food & Groceries', icon: '\u{1F6D2}', color: '#10b981' },
  { name: 'Insurance', icon: '\u{1F6E1}\uFE0F', color: '#3b82f6' },
  { name: 'Entertainment', icon: '\u{1F3AC}', color: '#8b5cf6' },
  { name: 'Health', icon: '\u2764\uFE0F', color: '#ef4444' },
  { name: 'Loans', icon: '\u{1F4B3}', color: '#f97316' },
  { name: 'Savings', icon: '\u{1F437}', color: '#06b6d4' },
  { name: 'Miscellaneous', icon: '\u{1F4E6}', color: '#6b7280' },
];

export function seedDefaultCategories(db: Database.Database, userId: number): void {
  const insert = db.prepare(
    'INSERT INTO categories (user_id, name, icon, color, is_default, sort_order) VALUES (?, ?, ?, ?, 1, ?)'
  );
  DEFAULT_CATEGORIES.forEach((cat, idx) => {
    insert.run(userId, cat.name, cat.icon, cat.color, idx);
  });
}
