import Database from 'better-sqlite3';
import { sendEmail } from './emailService';

interface UserRow {
  id: number;
  email: string;
  username: string;
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
}

interface NotificationCheckRow {
  id: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
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

export async function checkAndCreateNotifications(
  db: Database.Database,
  userId: number
): Promise<void> {
  const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(userId) as
    | UserRow
    | undefined;
  if (!user) return;

  const now = new Date();
  const today = now.getDate();
  const sevenDaysLater = today + 7;

  // 1. Upcoming expenses >= 100 booking within 7 days
  const expenses = db
    .prepare(
      'SELECT id, name, amount, booking_day, interval_months FROM expenses WHERE user_id = ? AND amount >= 100'
    )
    .all(userId) as ExpenseRow[];

  for (const exp of expenses) {
    if (exp.booking_day >= today && exp.booking_day <= sevenDaysLater) {
      if (!alreadyNotifiedToday(db, userId, 'upcoming_expense', exp.id)) {
        const daysUntil = exp.booking_day - today;
        const msg = `${exp.name} of ${exp.amount.toFixed(2)} EUR is due in ${daysUntil} day(s) (day ${exp.booking_day}). [ref:upcoming_expense_${exp.id}]`;
        createNotification(db, userId, 'upcoming_expense', 'Upcoming Expense', msg);
        await sendEmail(db, user.email, 'Upcoming Expense Reminder', `<p>${msg}</p>`);
      }
    }
  }

  // 2. Liquidity warning: check if daily balance goes negative this month
  const incomes = db
    .prepare('SELECT amount, interval FROM income WHERE user_id = ?')
    .all(userId) as IncomeRow[];

  const monthlyIncome = incomes.reduce((sum, inc) => {
    if (inc.interval === 'monthly') return sum + inc.amount;
    if (inc.interval === 'yearly') return sum + inc.amount / 12;
    return sum;
  }, 0);

  const monthlyExpenses = expenses.reduce((sum, exp) => {
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
      const msg = `Your projected expenses exceed income by ${deficit} EUR this month. You may run into a negative balance.`;
      createNotification(db, userId, type, 'Liquidity Warning', msg);
      await sendEmail(db, user.email, 'Liquidity Warning', `<p>${msg}</p>`);
    }
  }

  // 3. Savings goals at 100%
  const savingsGoals = db
    .prepare('SELECT id, name, target_amount, current_amount FROM savings_goals WHERE user_id = ?')
    .all(userId) as SavingsGoalRow[];

  for (const goal of savingsGoals) {
    if (goal.target_amount > 0 && goal.current_amount >= goal.target_amount) {
      if (!alreadyNotifiedToday(db, userId, 'goal_reached', goal.id)) {
        const msg = `Congratulations! You have reached your savings goal "${goal.name}" of ${goal.target_amount.toFixed(2)} EUR. [ref:goal_reached_${goal.id}]`;
        createNotification(db, userId, 'goal_reached', 'Savings Goal Reached', msg);
        await sendEmail(db, user.email, 'Savings Goal Reached!', `<p>${msg}</p>`);
      }
    }
  }
}
