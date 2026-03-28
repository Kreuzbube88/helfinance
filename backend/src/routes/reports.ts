import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import {
  calcYearlyProjection,
  calcDailyCashflow,
  normalizeToMonthly,
  IncomeRecord,
  ExpenseRecord,
  ChangeRecord,
} from '../services/financeCalc';

interface IncomeRow {
  id: number;
  name: string;
  amount: number;
  interval: string;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: number;
  interval_months: number;
  category: string | null;
  category_id: number | null;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface SnapshotRow {
  id: number;
  user_id: number;
  year: number;
  month: number;
  income_total: number;
  expense_total: number;
  savings_total: number;
}


interface IncomeChangeRow {
  income_id: number;
  new_amount: number;
  effective_from: string;
}

interface ExpenseChangeRow {
  expense_id: number;
  new_amount: number;
  effective_from: string;
}

export function createReportsRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/monthly', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
      const datePrefix = `${year}-${String(month).padStart(2, '0')}`;

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId) as ExpenseRow[];

      const monthlyIncome = incomes.reduce((sum, inc) => {
        if (inc.effective_from && inc.effective_from > `${datePrefix}-01`) return sum;
        if (inc.effective_to && inc.effective_to < `${datePrefix}-01`) return sum;
        if (inc.interval === 'monthly') return sum + inc.amount;
        if (inc.interval === 'yearly') return sum + inc.amount / 12;
        return sum;
      }, 0);

      const totalExpenses = expenses.reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.interval_months), 0);

      // Group expenses by category name
      const categoryNames = [...new Set(expenses.map((e) => e.category || 'Miscellaneous'))];
      const expenseBreakdown = categoryNames.map((catName) => {
        const catExpenses = expenses.filter((e) => (e.category || 'Miscellaneous') === catName);
        const items = catExpenses.map((e) => ({ name: e.name, amount: Math.round(normalizeToMonthly(e.amount, e.interval_months) * 100) / 100 }));
        const total = items.reduce((s, i) => s + i.amount, 0);
        return { category: catName, items, total: Math.round(total * 100) / 100 };
      }).filter((g) => g.items.length > 0);

      // Upsert snapshot
      db.prepare(
        `INSERT INTO monthly_snapshots (user_id, year, month, income_total, expense_total, savings_total, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, year, month) DO UPDATE SET
           income_total = excluded.income_total,
           expense_total = excluded.expense_total,
           savings_total = excluded.savings_total,
           data_json = excluded.data_json`
      ).run(
        userId,
        year,
        month,
        Math.round(monthlyIncome * 100) / 100,
        Math.round(totalExpenses * 100) / 100,
        Math.round((monthlyIncome - totalExpenses) * 100) / 100,
        JSON.stringify({ expense_breakdown: expenseBreakdown })
      );

      // Fetch snapshots archive
      const snapshots = db
        .prepare('SELECT rowid as id, * FROM monthly_snapshots WHERE user_id = ? ORDER BY year DESC, month DESC')
        .all(userId) as SnapshotRow[];

      res.json({
        year,
        month,
        total_income: Math.round(monthlyIncome * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        net: Math.round((monthlyIncome - totalExpenses) * 100) / 100,
        income_breakdown: incomes.map((i) => ({ name: i.name, amount: i.amount, interval: i.interval })),
        expense_breakdown: expenseBreakdown,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          year: s.year,
          month: s.month,
          total_income: s.income_total,
          total_expenses: s.expense_total,
          total_savings: s.savings_total,
          net: s.savings_total,
          created_at: '',
        })),
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/yearly', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId) as ExpenseRow[];
      const incomeChanges = db
        .prepare('SELECT ic.* FROM income_changes ic JOIN income i ON ic.income_id = i.id WHERE i.user_id = ?')
        .all(userId) as IncomeChangeRow[];
      const expenseChanges = db
        .prepare('SELECT ec.* FROM expense_changes ec JOIN expenses e ON ec.expense_id = e.id WHERE e.user_id = ?')
        .all(userId) as ExpenseChangeRow[];

      const incomeRecords: IncomeRecord[] = incomes.map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        interval: i.interval,
        booking_day: i.booking_day,
        effective_from: i.effective_from,
        effective_to: i.effective_to,
      }));

      const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount,
        interval_months: e.interval_months,
        booking_day: e.booking_day,
        effective_from: e.effective_from,
        effective_to: e.effective_to,
      }));

      const icChanges: ChangeRecord[] = incomeChanges.map((c) => ({
        income_id: c.income_id,
        new_amount: c.new_amount,
        effective_from: c.effective_from,
      }));

      const ecChanges: ChangeRecord[] = expenseChanges.map((c) => ({
        expense_id: c.expense_id,
        new_amount: c.new_amount,
        effective_from: c.effective_from,
      }));

      const projection = calcYearlyProjection(year, incomeRecords, expenseRecords, icChanges, ecChanges);

      // Map to frontend YearlyReport shape
      const months = projection.map((m) => ({
        month: m.month,
        income: Math.round(m.income * 100) / 100,
        fixed_expenses: Math.round(m.expenses * 100) / 100,
        provisions: 0,
        loans: 0,
        net_savings: Math.round(m.savings * 100) / 100,
      }));

      const totals = months.reduce(
        (acc, m) => ({
          income: acc.income + m.income,
          fixed_expenses: acc.fixed_expenses + m.fixed_expenses,
          provisions: 0,
          loans: 0,
          net_savings: acc.net_savings + m.net_savings,
        }),
        { income: 0, fixed_expenses: 0, provisions: 0, loans: 0, net_savings: 0 }
      );

      res.json({ year, months, totals });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/cashflow', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId) as ExpenseRow[];

      const incomeRecords: IncomeRecord[] = incomes.map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        interval: i.interval,
        booking_day: i.booking_day,
        effective_from: i.effective_from,
        effective_to: i.effective_to,
      }));

      const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount,
        interval_months: e.interval_months,
        booking_day: e.booking_day,
        effective_from: e.effective_from,
        effective_to: e.effective_to,
      }));

      const cashflow = calcDailyCashflow(incomeRecords, expenseRecords, year, month);
      const transformed = cashflow.map(d => ({
        day: d.day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
        income_bookings: d.bookings.filter(b => b.type === 'income').map(b => ({ name: b.name, amount: b.amount })),
        expense_bookings: d.bookings.filter(b => b.type === 'expense').map(b => ({ name: b.name, amount: b.amount })),
        projected_balance: d.balance,
      }));
      res.json(transformed);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
