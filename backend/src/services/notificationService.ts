import Database from 'better-sqlite3';
import { sendEmail } from './emailService';

interface UserRow {
  id: number;
  email: string;
  username: string;
  language: string;
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: number;
  booking_day: number;
  interval_months: number;
}

interface SavingsGoalRow {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
}

interface IncomeRow {
  amount: number;
  interval: string;
  effective_from: string | null;
}

interface NotificationCheckRow {
  id: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

function createNotification(
  db: Database.Database,
  userId: number,
  type: string,
  title: string,
  message: string
): number {
  const result = db
    .prepare(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
    )
    .run(userId, type, title, message);
  return result.lastInsertRowid as number;
}

function alreadyNotifiedToday(
  db: Database.Database,
  userId: number,
  type: string,
  referenceId: number
): boolean {
  const key = `${type}_${referenceId}`;
  const today = todayStr();
  const row = db
    .prepare(
      "SELECT id FROM notifications WHERE user_id = ? AND type = ? AND message LIKE ? AND date(created_at) = ?"
    )
    .get(userId, type, `%[ref:${key}]%`, today) as NotificationCheckRow | undefined;
  return !!row;
}

interface Messages {
  upcomingTitle: string;
  upcoming: (name: string, amount: string, days: number, day: number) => string;
  liquidityTitle: string;
  liquidity: (deficit: string) => string;
  goalTitle: string;
  goal: (name: string, amount: string) => string;
}

function getMessages(lang: string): Messages {
  if (lang === 'de') {
    return {
      upcomingTitle: 'Bevorstehende Ausgabe',
      upcoming: (name, amount, days, day) =>
        `${name} über ${amount} EUR wird in ${days} Tag(en) gebucht (Tag ${day}).`,
      liquidityTitle: 'Liquiditätswarnung',
      liquidity: (deficit) =>
        `Deine geplanten Ausgaben übersteigen die Einnahmen um ${deficit} EUR diesen Monat. Möglicherweise wird dein Konto negativ.`,
      goalTitle: 'Sparziel erreicht',
      goal: (name, amount) =>
        `Glückwunsch! Du hast dein Sparziel "${name}" von ${amount} EUR erreicht.`,
    };
  }
  return {
    upcomingTitle: 'Upcoming Expense',
    upcoming: (name, amount, days, day) =>
      `${name} of ${amount} EUR is due in ${days} day(s) (day ${day}).`,
    liquidityTitle: 'Liquidity Warning',
    liquidity: (deficit) =>
      `Your projected expenses exceed income by ${deficit} EUR this month. You may run into a negative balance.`,
    goalTitle: 'Savings Goal Reached',
    goal: (name, amount) =>
      `Congratulations! You have reached your savings goal "${name}" of ${amount} EUR.`,
  };
}

export async function checkAndCreateNotifications(
  db: Database.Database,
  userId: number
): Promise<void> {
  const user = db.prepare('SELECT id, email, username, language FROM users WHERE id = ?').get(userId) as
    | UserRow
    | undefined;
  if (!user) return;

  const m = getMessages(user.language ?? 'de');

  const now = new Date();
  const today = now.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. Upcoming expenses >= 100 booking within 7 days
  const upcomingExpenses = db
    .prepare(
      'SELECT id, name, amount, booking_day, interval_months, effective_from, effective_to FROM expenses WHERE user_id = ? AND amount >= 100'
    )
    .all(userId) as (ExpenseRow & { effective_from: string | null; effective_to: string | null })[];

  for (const exp of upcomingExpenses) {
    // Check if expense is due this month (interval filter)
    if (exp.interval_months > 1) {
      const fromDate = new Date(exp.effective_from ?? `${currentYear}-01-01`);
      const monthsElapsed = (currentYear - fromDate.getFullYear()) * 12 + (currentMonth - (fromDate.getMonth() + 1));
      if (monthsElapsed < 0 || monthsElapsed % exp.interval_months !== 0) continue;
    }

    // Calculate days until booking, handling cross-month boundaries
    const bookingDate = new Date(currentYear, currentMonth - 1, exp.booking_day);
    // If booking day already passed this month, check next month
    if (exp.booking_day < today) {
      bookingDate.setMonth(bookingDate.getMonth() + 1);
    }
    const diffMs = bookingDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntil >= 0 && daysUntil <= 7) {
      if (!alreadyNotifiedToday(db, userId, 'upcoming_expense', exp.id)) {
        const msg = `${m.upcoming(exp.name, exp.amount.toFixed(2), daysUntil, exp.booking_day)} [ref:upcoming_expense_${exp.id}]`;
        createNotification(db, userId, 'upcoming_expense', m.upcomingTitle, msg);
        await sendEmail(db, user.email, m.upcomingTitle, `<p>${msg}</p>`);
      }
    }
  }

  // 2. Liquidity warning: Bug 7 — fetch ALL expenses (no amount filter) for liquidity calc
  const allExpenses = db
    .prepare('SELECT id, name, amount, booking_day, interval_months FROM expenses WHERE user_id = ?')
    .all(userId) as ExpenseRow[];

  const incomes = db
    .prepare('SELECT amount, interval, effective_from FROM income WHERE user_id = ?')
    .all(userId) as IncomeRow[];

  const monthStr = currentMonthStr();

  const monthlyIncome = incomes.reduce((sum, inc) => {
    if (inc.interval === 'monthly') return sum + inc.amount;
    if (inc.interval === 'yearly') return sum + inc.amount / 12;
    // Bug 8: handle 'once' interval
    if (inc.interval === 'once' && inc.effective_from?.startsWith(monthStr)) return sum + inc.amount;
    return sum;
  }, 0);

  const monthlyExpenses = allExpenses.reduce((sum, exp) => {
    return sum + exp.amount / exp.interval_months;
  }, 0);

  if (monthlyExpenses > monthlyIncome) {
    const type = 'liquidity_warning';
    const existing = db
      .prepare(
        "SELECT id FROM notifications WHERE user_id = ? AND type = ? AND date(created_at) = ?"
      )
      .get(userId, type, todayStr()) as NotificationCheckRow | undefined;

    if (!existing) {
      const deficit = (monthlyExpenses - monthlyIncome).toFixed(2);
      const msg = m.liquidity(deficit);
      createNotification(db, userId, type, m.liquidityTitle, msg);
      await sendEmail(db, user.email, m.liquidityTitle, `<p>${msg}</p>`);
    }
  }

  // 3. Savings goals at 100% — use actual savings balance, not stale current_amount column
  const savingsGoals = db
    .prepare('SELECT id, name, target_amount, current_amount FROM savings_goals WHERE user_id = ?')
    .all(userId) as SavingsGoalRow[];

  const savingsAccount = db
    .prepare('SELECT initial_balance FROM savings_accounts WHERE user_id = ?')
    .get(userId) as { initial_balance: number } | undefined;
  const savingsTxSum = (
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM savings_transactions WHERE user_id = ?')
      .get(userId) as { total: number }
  ).total;
  const currentSavingsBalance = (savingsAccount?.initial_balance ?? 0) + savingsTxSum;

  for (const goal of savingsGoals) {
    if (goal.target_amount > 0 && currentSavingsBalance >= goal.target_amount) {
      if (!alreadyNotifiedToday(db, userId, 'goal_reached', goal.id)) {
        const msg = `${m.goal(goal.name, goal.target_amount.toFixed(2))} [ref:goal_reached_${goal.id}]`;
        createNotification(db, userId, 'goal_reached', m.goalTitle, msg);
        await sendEmail(db, user.email, m.goalTitle, `<p>${msg}</p>`);
      }
    }
  }
}
