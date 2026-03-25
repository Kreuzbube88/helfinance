import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import {
  calcHealthScore,
  calcDailyCashflow,
  IncomeRecord,
  ExpenseRecord,
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
}

interface LoanRow {
  monthly_rate: number | null;
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

      const incomes = db
        .prepare('SELECT * FROM income WHERE user_id = ?')
        .all(userId) as IncomeRow[];

      const expenses = db
        .prepare('SELECT * FROM expenses WHERE user_id = ?')
        .all(userId) as ExpenseRow[];

      const loans = db
        .prepare('SELECT monthly_rate FROM loans WHERE user_id = ?')
        .all(userId) as LoanRow[];

      const savingsGoals = db
        .prepare('SELECT * FROM savings_goals WHERE user_id = ?')
        .all(userId) as SavingsGoalRow[];

      // Monthly income (monthly interval only for simple calc)
      const monthlyIncome = incomes.reduce((sum, inc) => {
        if (inc.interval === 'monthly') return sum + inc.amount;
        if (inc.interval === 'yearly') return sum + inc.amount / 12;
        return sum;
      }, 0);

      // Monthly expenses (normalized)
      const monthlyExpenses = expenses.reduce((sum, exp) => {
        return sum + exp.amount / exp.interval_months;
      }, 0);

      // Total loan payments
      const totalLoanPayments = loans.reduce((sum, l) => sum + (l.monthly_rate ?? 0), 0);

      const freeMoney = monthlyIncome - monthlyExpenses - totalLoanPayments;

      // Savings rate %
      const savingsRate = monthlyIncome > 0 ? (freeMoney / monthlyIncome) * 100 : 0;

      // Emergency reserve: rough estimate — free money * 3 months / monthly expenses
      const emergencyReserveMonths = monthlyExpenses > 0 ? (freeMoney * 3) / monthlyExpenses : 0;

      // Debt-to-income ratio
      const debtToIncome = monthlyIncome > 0 ? totalLoanPayments / monthlyIncome : 0;

      const healthScore = calcHealthScore(savingsRate, emergencyReserveMonths, debtToIncome);

      // Next 3 upcoming bookings by booking_day >= today
      interface Booking {
        name: string;
        amount: number;
        type: 'income' | 'expense';
        booking_day: number;
      }

      const allBookings: Booking[] = [
        ...incomes
          .filter((i) => i.interval === 'monthly' && i.booking_day >= today)
          .map((i) => ({ name: i.name, amount: i.amount, type: 'income' as const, booking_day: i.booking_day })),
        ...expenses
          .filter((e) => e.booking_day >= today)
          .map((e) => ({ name: e.name, amount: e.amount, type: 'expense' as const, booking_day: e.booking_day })),
      ];
      allBookings.sort((a, b) => a.booking_day - b.booking_day);
      const nextBookings = allBookings.slice(0, 3);

      // Savings goals progress
      const goalsProgress = savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        target_amount: g.target_amount,
        current_amount: g.current_amount,
        progress_pct: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
        color: g.color,
      }));

      // Liquidity warning: check if daily balance goes negative this month
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

      const dailyCashflow = calcDailyCashflow(incomeRecords, expenseRecords, year, month);
      const liquidityWarning = dailyCashflow.some((d) => d.balance < 0);

      res.json({
        health_score: healthScore,
        monthly_income: Math.round(monthlyIncome * 100) / 100,
        monthly_expenses: Math.round(monthlyExpenses * 100) / 100,
        free_money: Math.round(freeMoney * 100) / 100,
        next_bookings: nextBookings,
        savings_goals: goalsProgress,
        liquidity_warning: liquidityWarning,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
