import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface TransactionRow {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: number | null;
  date: string;
  note: string | null;
  income_id: number | null;
  expense_id: number | null;
  is_auto: number;
}

interface IncomeRow {
  id: number;
  name: string;
  amount: number;
  interval: 'monthly' | 'yearly' | 'once';
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
  category_id: number | null;
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: number;
  interval_months: number;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

/** Returns the number of days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Clamps booking_day to the last valid day of the given month. */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/** Format Date as YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Computes all past booking dates for a recurring entry.
 * Returns dates from effectiveFrom up to min(today, effectiveTo), max 24 months back.
 */
function computeBookingDates(
  effectiveFrom: string | null,
  effectiveTo: string | null,
  bookingDay: number,
  intervalMonths: number
): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - 24);

  const start = effectiveFrom ? new Date(effectiveFrom) : cutoff;
  const end = effectiveTo ? new Date(effectiveTo) : today;

  const rangeStart = start > cutoff ? start : cutoff;
  const rangeEnd = end < today ? end : today;

  if (rangeStart > rangeEnd) return [];

  const dates: string[] = [];

  // Find first occurrence: start from rangeStart's year/month
  let year = rangeStart.getFullYear();
  let month = rangeStart.getMonth() + 1; // 1-indexed

  // Align to the effective_from month so intervals stay consistent
  if (effectiveFrom) {
    const fromDate = new Date(effectiveFrom);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth() + 1;
    // How many full intervals have passed since effective_from?
    const totalMonthsElapsed = (year - fromYear) * 12 + (month - fromMonth);
    const intervalsElapsed = Math.floor(totalMonthsElapsed / intervalMonths);
    const alignedMonths = fromMonth - 1 + intervalsElapsed * intervalMonths;
    year = fromYear + Math.floor(alignedMonths / 12);
    month = (alignedMonths % 12) + 1;
  }

  for (let i = 0; i < 300; i++) { // safety cap
    const day = clampDay(year, month, bookingDay);
    const d = new Date(year, month - 1, day);
    if (d > rangeEnd) break;
    if (d >= rangeStart) {
      dates.push(toDateStr(d));
    }
    month += intervalMonths;
    if (month > 12) {
      year += Math.floor((month - 1) / 12);
      month = ((month - 1) % 12) + 1;
    }
  }

  return dates;
}

/**
 * Auto-generates transaction records for all past income/expense booking days.
 * Idempotent: skips dates that already have a transaction with the same income_id/expense_id.
 */
function generateAutoTransactions(db: Database.Database, userId: number): void {
  const incomes = db
    .prepare('SELECT id, name, amount, interval, booking_day, effective_from, effective_to, category_id FROM income WHERE user_id = ?')
    .all(userId) as IncomeRow[];

  const expenses = db
    .prepare('SELECT id, name, amount, interval_months, booking_day, effective_from, effective_to FROM expenses WHERE user_id = ?')
    .all(userId) as ExpenseRow[];

  const checkIncome = db.prepare('SELECT id FROM transactions WHERE income_id = ? AND date = ?');
  const checkExpense = db.prepare('SELECT id FROM transactions WHERE expense_id = ? AND date = ?');
  const insertTx = db.prepare(
    'INSERT INTO transactions (user_id, name, amount, type, category_id, date, income_id, expense_id, is_auto) VALUES (?,?,?,?,?,?,?,?,1)'
  );

  const insertMany = db.transaction(() => {
    for (const inc of incomes) {
      let dates: string[];
      if (inc.interval === 'once') {
        dates = inc.effective_from ? [inc.effective_from.slice(0, 10)] : [];
      } else if (inc.interval === 'yearly') {
        dates = computeBookingDates(inc.effective_from, inc.effective_to, inc.booking_day, 12);
      } else {
        // monthly
        dates = computeBookingDates(inc.effective_from, inc.effective_to, inc.booking_day, 1);
      }
      for (const date of dates) {
        const existing = checkIncome.get(inc.id, date);
        if (!existing) {
          insertTx.run(userId, inc.name, inc.amount, 'income', inc.category_id ?? null, date, inc.id, null);
        }
      }
    }

    for (const exp of expenses) {
      const dates = computeBookingDates(exp.effective_from, exp.effective_to, exp.booking_day, exp.interval_months);
      for (const date of dates) {
        const existing = checkExpense.get(exp.id, date);
        if (!existing) {
          insertTx.run(userId, exp.name, exp.amount, 'expense', null, date, null, exp.id);
        }
      }
    }
  });

  insertMany();
}

export function createTransactionsRouter(db: Database.Database): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      generateAutoTransactions(db, req.user!.id);
      const rows = db
        .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC')
        .all(req.user!.id) as TransactionRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, amount, type, category_id, date, note } = req.body as {
        name: string;
        amount: number;
        type: 'income' | 'expense';
        category_id?: number | null;
        date: string;
        note?: string;
      };
      if (!name || amount == null || !type || !date) {
        res.status(400).json({ error: 'name, amount, type and date are required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO transactions (user_id, name, amount, type, category_id, date, note) VALUES (?,?,?,?,?,?,?)')
        .run(req.user!.id, name, amount, type, category_id ?? null, date, note ?? null);
      const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as TransactionRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user!.id) as TransactionRow | undefined;
      if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
      const { name, amount, type, category_id, date, note } = req.body as Partial<TransactionRow>;
      db.prepare(
        'UPDATE transactions SET name=COALESCE(?,name), amount=COALESCE(?,amount), type=COALESCE(?,type), category_id=?, date=COALESCE(?,date), note=? WHERE id=?'
      ).run(name ?? null, amount ?? null, type ?? null, category_id ?? null, date ?? null, note ?? null, id);
      res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user!.id);
      if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      res.status(204).end();
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // V4: CSV import
  router.post('/import', (req: Request, res: Response) => {
    try {
      const { csv } = req.body as { csv: string };
      if (!csv) { res.status(400).json({ error: 'csv field required' }); return; }

      const lines = csv.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const insert = db.prepare('INSERT INTO transactions (user_id, name, amount, type, date) VALUES (?,?,?,?,?)');
      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p: string) => p.trim());
        if (parts.length < 4) { errors.push(`Line ${i + 1}: expected date,amount,name,type`); continue; }
        const [date, amountStr, name, type] = parts;
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) { errors.push(`Line ${i + 1}: invalid amount`); continue; }
        if (type !== 'income' && type !== 'expense') { errors.push(`Line ${i + 1}: type must be income or expense`); continue; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Line ${i + 1}: date must be YYYY-MM-DD`); continue; }
        insert.run(req.user!.id, name, amount, type, date);
        imported++;
      }

      res.json({ imported, errors });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
