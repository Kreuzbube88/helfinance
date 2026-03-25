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
  category_id: number | null;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface CategoryRow {
  id: number;
  name: string;
  color: string;
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
      const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId) as CategoryRow[];

      const monthlyIncome = incomes.reduce((sum, inc) => {
        if (inc.effective_from && inc.effective_from > `${datePrefix}-01`) return sum;
        if (inc.effective_to && inc.effective_to < `${datePrefix}-01`) return sum;
        if (inc.interval === 'monthly') return sum + inc.amount;
        if (inc.interval === 'yearly') return sum + inc.amount / 12;
        return sum;
      }, 0);

      const expenseBreakdown = expenses.map((exp) => ({
        id: exp.id,
        name: exp.name,
        amount: exp.amount,
        monthly_amount: normalizeToMonthly(exp.amount, exp.interval_months),
        category_id: exp.category_id,
        interval_months: exp.interval_months,
      }));

      // Category totals
      const categoryTotals = categories.map((cat) => {
        const catExpenses = expenseBreakdown.filter((e) => e.category_id === cat.id);
        const total = catExpenses.reduce((sum, e) => sum + e.monthly_amount, 0);
        return { category_id: cat.id, name: cat.name, color: cat.color, total: Math.round(total * 100) / 100 };
      });

      const uncategorizedTotal = expenseBreakdown
        .filter((e) => !e.category_id)
        .reduce((sum, e) => sum + e.monthly_amount, 0);

      if (uncategorizedTotal > 0) {
        categoryTotals.push({ category_id: 0, name: 'Uncategorized', color: '#9ca3af', total: Math.round(uncategorizedTotal * 100) / 100 });
      }

      const totalExpenses = expenseBreakdown.reduce((sum, e) => sum + e.monthly_amount, 0);

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
        JSON.stringify({ category_totals: categoryTotals })
      );

      res.json({
        year,
        month,
        income_total: Math.round(monthlyIncome * 100) / 100,
        expense_total: Math.round(totalExpenses * 100) / 100,
        savings_total: Math.round((monthlyIncome - totalExpenses) * 100) / 100,
        income_breakdown: incomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount, interval: i.interval })),
        expense_breakdown: expenseBreakdown,
        category_totals: categoryTotals,
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
      res.json({ year, months: projection });
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
      res.json({ year, month, days: cashflow });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
