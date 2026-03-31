import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import {
  calcYearlyProjection,
  calcDailyCashflow,
  normalizeToMonthly,
  calcMonthlyTotals,
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
  cat_name: string | null;
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

interface LoanRow {
  monthly_rate: number | null;
  start_date: string;
  term_months: number;
}

interface CashflowLoanRow {
  id: number;
  name: string;
  monthly_rate: number | null;
  start_date: string;
  term_months: number;
  booking_day: number;
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
      const dateStr = `${datePrefix}-01`;

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db
        .prepare('SELECT e.*, c.name as cat_name FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.user_id = ?')
        .all(userId) as ExpenseRow[];

      const loanRows = db
        .prepare('SELECT monthly_rate, start_date, term_months FROM loans WHERE user_id = ?')
        .all(userId) as LoanRow[];

      const incomeChangeRows = db
        .prepare('SELECT ic.* FROM income_changes ic JOIN income i ON ic.income_id = i.id WHERE i.user_id = ?')
        .all(userId) as IncomeChangeRow[];
      const incomeChanges: ChangeRecord[] = incomeChangeRows.map((c) => ({
        income_id: c.income_id,
        new_amount: c.new_amount,
        effective_from: c.effective_from,
      }));

      const expenseChangeRows = db
        .prepare('SELECT ec.* FROM expense_changes ec JOIN expenses e ON ec.expense_id = e.id WHERE e.user_id = ?')
        .all(userId) as ExpenseChangeRow[];
      const expenseChanges: ChangeRecord[] = expenseChangeRows.map((c) => ({
        expense_id: c.expense_id,
        new_amount: c.new_amount,
        effective_from: c.effective_from,
      }));

      const incomeRecords: IncomeRecord[] = incomes.map((i) => ({
        id: i.id, name: i.name, amount: i.amount, interval: i.interval,
        booking_day: i.booking_day, effective_from: i.effective_from, effective_to: i.effective_to,
      }));
      const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
        id: e.id, name: e.name, amount: e.amount, interval_months: e.interval_months,
        booking_day: e.booking_day, effective_from: e.effective_from, effective_to: e.effective_to,
      }));

      const totals = calcMonthlyTotals({
        incomes: incomeRecords,
        expenses: expenseRecords,
        incomeChanges,
        expenseChanges,
        loans: loanRows,
        year,
        month,
      });

      // Bug 27: Filter expenses by effective dates for breakdown
      const activeExpenses = expenses.filter((e) => {
        if (e.effective_from && e.effective_from > dateStr) return false;
        if (e.effective_to && e.effective_to < dateStr) return false;
        return true;
      });

      // Bug 3: Group by canonical category name (FK > text > 'Uncategorized')
      const categoryNames = [
        ...new Set(activeExpenses.map((e) => e.cat_name ?? e.category ?? 'Uncategorized')),
      ];
      const expenseBreakdown = categoryNames
        .map((catName) => {
          const catExpenses = activeExpenses.filter(
            (e) => (e.cat_name ?? e.category ?? 'Uncategorized') === catName
          );
          const items = catExpenses.map((e) => {
            const applicable = expenseChanges
              .filter((c) => c.expense_id === e.id && c.effective_from <= dateStr)
              .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
            const effectiveAmount = applicable.length > 0 ? applicable[0].new_amount : e.amount;
            return {
              name: e.name,
              amount: Math.round(normalizeToMonthly(effectiveAmount, e.interval_months) * 100) / 100,
            };
          });
          const total = items.reduce((s, i) => s + i.amount, 0);
          return { category: catName, items, total: Math.round(total * 100) / 100 };
        })
        .filter((g) => g.items.length > 0);

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
        userId, year, month,
        totals.totalIncome,
        Math.round((totals.totalExpenses + totals.totalLoanPayments) * 100) / 100,
        Math.round(totals.freeMoney * 100) / 100,
        JSON.stringify({ expense_breakdown: expenseBreakdown })
      );

      const snapshots = db
        .prepare('SELECT rowid as id, * FROM monthly_snapshots WHERE user_id = ? ORDER BY year DESC, month DESC')
        .all(userId) as SnapshotRow[];

      // Bug 26: income_breakdown with monthly_amount; apply income_changes for effective amount
      const incomeBreakdown = incomes
        .filter((i) => {
          if (i.effective_from && i.effective_from > dateStr) return false;
          if (i.effective_to && i.effective_to < dateStr) return false;
          return true;
        })
        .map((i) => {
          const applicable = incomeChanges
            .filter((c) => c.income_id === i.id && c.effective_from <= dateStr)
            .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
          const effectiveAmount = applicable.length > 0 ? applicable[0].new_amount : i.amount;
          const monthly_amount =
            i.interval === 'yearly' ? effectiveAmount / 12 :
            i.interval === 'once' ? 0 :
            effectiveAmount;
          return { name: i.name, amount: effectiveAmount, interval: i.interval, monthly_amount: Math.round(monthly_amount * 100) / 100 };
        });

      res.json({
        year,
        month,
        total_income: totals.totalIncome,
        total_expenses: totals.totalExpenses,
        net: Math.round((totals.totalIncome - totals.totalExpenses) * 100) / 100,
        required_savings: totals.requiredSavings,
        loan_monthly_total: totals.totalLoanPayments,
        effective_net: totals.effectiveNet,
        income_breakdown: incomeBreakdown,
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
      const incomeChangeRows = db
        .prepare('SELECT ic.* FROM income_changes ic JOIN income i ON ic.income_id = i.id WHERE i.user_id = ?')
        .all(userId) as IncomeChangeRow[];
      const expenseChangeRows = db
        .prepare('SELECT ec.* FROM expense_changes ec JOIN expenses e ON ec.expense_id = e.id WHERE e.user_id = ?')
        .all(userId) as ExpenseChangeRow[];
      const loanRowsY = db
        .prepare('SELECT monthly_rate, start_date, term_months FROM loans WHERE user_id = ?')
        .all(userId) as LoanRow[];

      const incomeRecords: IncomeRecord[] = incomes.map((i) => ({
        id: i.id, name: i.name, amount: i.amount, interval: i.interval,
        booking_day: i.booking_day, effective_from: i.effective_from, effective_to: i.effective_to,
      }));
      const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
        id: e.id, name: e.name, amount: e.amount, interval_months: e.interval_months,
        booking_day: e.booking_day, effective_from: e.effective_from, effective_to: e.effective_to,
      }));
      const icChanges: ChangeRecord[] = incomeChangeRows.map((c) => ({
        income_id: c.income_id, new_amount: c.new_amount, effective_from: c.effective_from,
      }));
      const ecChanges: ChangeRecord[] = expenseChangeRows.map((c) => ({
        expense_id: c.expense_id, new_amount: c.new_amount, effective_from: c.effective_from,
      }));

      const projection = calcYearlyProjection(
        year, incomeRecords, expenseRecords, icChanges, ecChanges, loanRowsY
      );

      const months = projection.map((m) => ({
        month: m.month,
        income: Math.round(m.income * 100) / 100,
        fixed_expenses: Math.round(m.expenses * 100) / 100,
        provisions: Math.round(m.required_savings * 100) / 100,
        loans: Math.round(m.loan_payments * 100) / 100,
        net_savings: Math.round(m.savings * 100) / 100,
        effective_net: Math.round(m.effective_net * 100) / 100,
      }));

      const totals = months.reduce(
        (acc, m) => ({
          income: acc.income + m.income,
          fixed_expenses: acc.fixed_expenses + m.fixed_expenses,
          provisions: acc.provisions + m.provisions,
          loans: acc.loans + m.loans,
          net_savings: acc.net_savings + m.net_savings,
          effective_net: acc.effective_net + m.effective_net,
        }),
        { income: 0, fixed_expenses: 0, provisions: 0, loans: 0, net_savings: 0, effective_net: 0 }
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
      const incomeChangeRows = db
        .prepare('SELECT ic.* FROM income_changes ic JOIN income i ON ic.income_id = i.id WHERE i.user_id = ?')
        .all(userId) as IncomeChangeRow[];
      const expenseChangeRows = db
        .prepare('SELECT ec.* FROM expense_changes ec JOIN expenses e ON ec.expense_id = e.id WHERE e.user_id = ?')
        .all(userId) as ExpenseChangeRow[];

      const savingsAccount = db
        .prepare('SELECT initial_balance FROM savings_accounts WHERE user_id = ?')
        .get(userId) as { initial_balance: number } | undefined;
      const savingsTxSum = (
        db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM savings_transactions WHERE user_id = ?')
          .get(userId) as { total: number }
      ).total;
      const startingBalance = (savingsAccount?.initial_balance ?? 0) + savingsTxSum;

      const cashflowLoanRows = db
        .prepare('SELECT id, name, monthly_rate, start_date, term_months, COALESCE(booking_day, 1) as booking_day FROM loans WHERE user_id = ?')
        .all(userId) as CashflowLoanRow[];

      const incomeRecords: IncomeRecord[] = incomes.map((i) => ({
        id: i.id, name: i.name, amount: i.amount, interval: i.interval,
        booking_day: i.booking_day, effective_from: i.effective_from, effective_to: i.effective_to,
      }));
      const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
        id: e.id, name: e.name, amount: e.amount, interval_months: e.interval_months,
        booking_day: e.booking_day, effective_from: e.effective_from, effective_to: e.effective_to,
      }));

      const loanExpenseRecords: ExpenseRecord[] = cashflowLoanRows
        .filter((l) => {
          const end = new Date(l.start_date);
          end.setMonth(end.getMonth() + l.term_months);
          return new Date(year, month - 1, 1) < end;
        })
        .map((l) => {
          const end = new Date(l.start_date);
          end.setMonth(end.getMonth() + l.term_months);
          return {
            id: -(l.id),
            name: l.name,
            amount: l.monthly_rate ?? 0,
            interval_months: 1,
            booking_day: l.booking_day,
            effective_from: l.start_date,
            effective_to: end.toISOString().slice(0, 10),
          };
        });

      const cashflow = calcDailyCashflow(incomeRecords, [...expenseRecords, ...loanExpenseRecords], year, month, {
        incomeChanges: incomeChangeRows.map((c) => ({ income_id: c.income_id, new_amount: c.new_amount, effective_from: c.effective_from })),
        expenseChanges: expenseChangeRows.map((c) => ({ expense_id: c.expense_id, new_amount: c.new_amount, effective_from: c.effective_from })),
        startingBalance,
      });
      const transformed = cashflow.map((d) => ({
        day: d.day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
        income_bookings: d.bookings.filter((b) => b.type === 'income').map((b) => ({ name: b.name, amount: b.amount })),
        expense_bookings: d.bookings.filter((b) => b.type === 'expense').map((b) => ({ name: b.name, amount: b.amount })),
        projected_balance: d.balance,
      }));
      res.json(transformed);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
