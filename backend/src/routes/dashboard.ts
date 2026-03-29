import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import {
  calcHealthScore,
  calcDailyCashflow,
  calcRequiredReserveMonthly,
  calcMonthlyTotals,
  IncomeRecord,
  ExpenseRecord,
  OverrideRecord,
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
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface SavingsGoalRow {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  contribution_mode: string;
  fixed_amount: number | null;
}

interface LoanRow {
  id: number;
  name: string;
  monthly_rate: number | null;
  start_date: string;
  term_months: number;
  booking_day: number | null;
}

interface OverrideRow {
  booking_type: 'income' | 'expense';
  booking_id: number;
  month: string;
  override_amount: number;
}

interface SavingsAccountRow {
  initial_balance: number;
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

interface ManualTxRow {
  type: 'income' | 'expense';
  total: number;
}

export function createDashboardRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const today = now.getDate();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const dateStr = `${monthStr}-01`;

      const incomes = db
        .prepare('SELECT * FROM income WHERE user_id = ?')
        .all(userId) as IncomeRow[];

      const expenses = db
        .prepare('SELECT * FROM expenses WHERE user_id = ?')
        .all(userId) as ExpenseRow[];

      const loans = db
        .prepare('SELECT id, name, monthly_rate, start_date, term_months, booking_day FROM loans WHERE user_id = ?')
        .all(userId) as LoanRow[];

      const savingsGoals = db
        .prepare('SELECT * FROM savings_goals WHERE user_id = ?')
        .all(userId) as SavingsGoalRow[];

      const overrideRows = db
        .prepare('SELECT * FROM booking_overrides WHERE user_id = ?')
        .all(userId) as OverrideRow[];
      const overrides: OverrideRecord[] = overrideRows.map((o) => ({
        booking_type: o.booking_type,
        booking_id: o.booking_id,
        month: o.month,
        override_amount: o.override_amount,
      }));

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

      // Manual transactions only (no source linkage)
      const monthStart = dateStr;
      const monthEnd = `${monthStr}-31`;
      const manualTxRows = db
        .prepare(
          `SELECT type, COALESCE(SUM(amount), 0) as total
           FROM transactions
           WHERE user_id = ? AND is_auto = 0 AND income_id IS NULL AND expense_id IS NULL
             AND date >= ? AND date <= ?
           GROUP BY type`
        )
        .all(userId, monthStart, monthEnd) as ManualTxRow[];
      const manualTransactions: Array<{ type: 'income' | 'expense'; amount: number }> = manualTxRows.map((r) => ({
        type: r.type,
        amount: r.total,
      }));

      const savingsAccount = db
        .prepare('SELECT initial_balance FROM savings_accounts WHERE user_id = ?')
        .get(userId) as SavingsAccountRow | undefined;
      const savingsTxSum = (
        db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM savings_transactions WHERE user_id = ?')
          .get(userId) as { total: number }
      ).total;
      const currentSavingsBalance = (savingsAccount?.initial_balance ?? 0) + savingsTxSum;

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

      const loanRecords = loans.map((l) => ({
        monthly_rate: l.monthly_rate,
        start_date: l.start_date,
        term_months: l.term_months,
      }));

      // Use calcMonthlyTotals as single source of truth
      const totals = calcMonthlyTotals({
        incomes: incomeRecords,
        expenses: expenseRecords,
        incomeChanges,
        expenseChanges,
        overrides,
        loans: loanRecords,
        savingsGoals: savingsGoals.map((g) => ({
          contribution_mode: g.contribution_mode,
          fixed_amount: g.fixed_amount,
        })),
        manualTransactions,
        year,
        month,
      });

      const { totalIncome: monthlyIncome, totalExpenses: monthlyExpenses, totalLoanPayments, freeMoney } = totals;

      // Savings rate %
      const savingsRate = monthlyIncome > 0 ? (freeMoney / monthlyIncome) * 100 : 0;

      // Bug 22: emergency reserve = actual savings balance / monthly expenses
      const emergencyReserveMonths = monthlyExpenses > 0 ? currentSavingsBalance / monthlyExpenses : 0;

      // Debt-to-income ratio
      const debtToIncome = monthlyIncome > 0 ? totalLoanPayments / monthlyIncome : 0;

      const healthScore = calcHealthScore(savingsRate, emergencyReserveMonths, debtToIncome);

      // Upcoming bookings — include monthly income, all active expenses, active loan payments, non-monthly expenses due this month
      interface Booking {
        name: string;
        amount: number;
        type: 'income' | 'expense';
        booking_day: number;
      }

      const allBookings: Booking[] = [];

      // Monthly income due today or later
      for (const inc of incomes) {
        if (inc.interval !== 'monthly') continue;
        if (inc.effective_from && inc.effective_from > dateStr) continue;
        if (inc.effective_to && inc.effective_to < dateStr) continue;
        if (inc.booking_day >= today) {
          allBookings.push({ name: inc.name, amount: inc.amount, type: 'income', booking_day: inc.booking_day });
        }
      }

      // All active expenses due today or later
      for (const exp of expenses) {
        if (exp.effective_from && exp.effective_from > dateStr) continue;
        if (exp.effective_to && exp.effective_to < dateStr) continue;
        if (exp.booking_day < today) continue;

        if (exp.interval_months === 1) {
          allBookings.push({ name: exp.name, amount: exp.amount, type: 'expense', booking_day: exp.booking_day });
        } else {
          // Non-monthly: check if this month is a due month
          const fromDate = new Date(exp.effective_from ?? `${year}-01-01`);
          const monthsElapsed = (year - fromDate.getFullYear()) * 12 + (month - (fromDate.getMonth() + 1));
          if (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0) {
            allBookings.push({ name: exp.name, amount: exp.amount, type: 'expense', booking_day: exp.booking_day });
          }
        }
      }

      // Active loans
      for (const loan of loans) {
        const end = new Date(loan.start_date);
        end.setMonth(end.getMonth() + loan.term_months);
        if (now < end) {
          const bookDay = loan.booking_day ?? 1;
          if (bookDay >= today) {
            allBookings.push({
              name: loan.name,
              amount: loan.monthly_rate ?? 0,
              type: 'expense',
              booking_day: bookDay,
            });
          }
        }
      }

      allBookings.sort((a, b) => a.booking_day - b.booking_day);
      const nextBookings = allBookings.slice(0, 3);

      // Savings goals — use actual savings balance for progress
      const goalsProgress = savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        target_amount: g.target_amount,
        current_amount: currentSavingsBalance,
        progress_pct: g.target_amount > 0 ? Math.min(100, Math.round((currentSavingsBalance / g.target_amount) * 100)) : 0,
        color: g.color,
      }));

      // Liquidity warning
      const dailyCashflow = calcDailyCashflow(incomeRecords, expenseRecords, year, month, {
        overrides,
        incomeChanges,
        expenseChanges,
        startingBalance: currentSavingsBalance,
      });
      const liquidityWarning = dailyCashflow.some((d) => d.balance < 0);

      // Reserve warning
      const requiredReserve = calcRequiredReserveMonthly(
        expenses.map((e) => ({ id: e.id, amount: e.amount, interval_months: e.interval_months })),
        overrides,
        monthStr
      );
      const reserveWarning = currentSavingsBalance < requiredReserve * 3;

      res.json({
        health_score: healthScore,
        total_income: Math.round(monthlyIncome * 100) / 100,
        total_expenses: Math.round(monthlyExpenses * 100) / 100,
        free_money: Math.round(freeMoney * 100) / 100,
        upcoming_bookings: nextBookings.map((b) => ({
          ...b,
          date: new Date(year, month - 1, b.booking_day).toISOString().slice(0, 10),
        })),
        savings_goals: goalsProgress,
        liquidity_warning: liquidityWarning,
        reserve_warning: reserveWarning,
        required_reserve_monthly: Math.round(requiredReserve * 100) / 100,
        savings_balance: Math.round(currentSavingsBalance * 100) / 100,
        budget_status: savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'yellow' : 'red',
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
