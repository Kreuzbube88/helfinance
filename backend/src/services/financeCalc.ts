export interface AmortizationRow {
  month: number;
  date: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface ProjectionMonth {
  month: number;
  income: number;
  expenses: number;
  savings: number;
  required_savings: number;
  effective_net: number;
}

export interface DailyBooking {
  id: number;
  name: string;
  amount: number;
  type: 'income' | 'expense';
}

export interface DailyCashflowRow {
  day: number;
  bookings: DailyBooking[];
  balance: number;
}

export interface IncomeRecord {
  id: number;
  name: string;
  amount: number;
  interval: string;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

export interface ExpenseRecord {
  id: number;
  name: string;
  amount: number;
  interval_months: number;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

export interface ChangeRecord {
  income_id?: number;
  expense_id?: number;
  new_amount: number;
  effective_from: string;
}

export interface SharedExpenseRecord {
  expense_id: number;
  split_ratio_a: number;
  split_ratio_b: number;
  paid_by_user_id: number;
  amount: number;
  user_a_id: number;
}

export interface OverrideRecord {
  booking_type: 'income' | 'expense';
  booking_id: number;
  month: string; // YYYY-MM
  override_amount: number;
}

export interface SpecialPayment {
  amount: number;
  date: string; // YYYY-MM
}

export function normalizeToMonthly(amount: number, intervalMonths: number): number {
  return amount / intervalMonths;
}

export function calcProvisionBuffer(
  expenses: Array<{ amount: number; interval_months: number }>
): number {
  return expenses
    .filter((e) => e.interval_months > 1)
    .reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.interval_months), 0);
}

/** Total monthly reserve required across all recurring bookings (overrides take precedence). */
export function calcRequiredReserveMonthly(
  expenses: Array<{ id: number; amount: number; interval_months: number }>,
  overrides: OverrideRecord[],
  month: string
): number {
  return expenses.reduce((sum, e) => {
    const ov = overrides.find((o) => o.booking_type === 'expense' && o.booking_id === e.id && o.month === month);
    const base = ov ? ov.override_amount : e.amount;
    return sum + base / e.interval_months;
  }, 0);
}

/** Resolve effective amount for a booking in a given month (override > base). */
export function resolveAmount(
  bookingType: 'income' | 'expense',
  bookingId: number,
  baseAmount: number,
  month: string,
  overrides: OverrideRecord[]
): number {
  const ov = overrides.find(
    (o) => o.booking_type === bookingType && o.booking_id === bookingId && o.month === month
  );
  return ov ? ov.override_amount : baseAmount;
}

export function calcDynamicSavings(
  monthlyIncome: number,
  monthlyExpenses: number,
  bufferAmount: number
): number {
  return monthlyIncome - monthlyExpenses - bufferAmount;
}

export function calcLoanMonthlyRate(
  principal: number,
  annualRatePct: number,
  termMonths: number
): number {
  if (annualRatePct === 0) {
    return principal / termMonths;
  }
  const r = annualRatePct / 12 / 100;
  const n = termMonths;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function generateAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  startDate: string,
  specialPayments: SpecialPayment[] = []
): AmortizationRow[] {
  const monthlyPayment = calcLoanMonthlyRate(principal, annualRatePct, termMonths);
  const r = annualRatePct / 12 / 100;
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  const start = new Date(startDate);

  for (let i = 1; i <= termMonths; i++) {
    if (balance <= 0) break;

    const date = new Date(start);
    date.setMonth(date.getMonth() + i - 1);
    const monthStr = date.toISOString().slice(0, 7);

    const interest = annualRatePct === 0 ? 0 : balance * r;
    const principalPaid = Math.min(monthlyPayment - interest, balance);
    balance -= principalPaid;

    // Apply special payments for this month
    const specialTotal = specialPayments
      .filter((sp) => sp.date === monthStr)
      .reduce((sum, sp) => sum + sp.amount, 0);
    balance = Math.max(0, balance - specialTotal);

    schedule.push({
      month: i,
      date: monthStr,
      payment: Math.round((monthlyPayment + specialTotal) * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round((principalPaid + specialTotal) * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return schedule;
}

export function calcYearlyProjection(
  year: number,
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  incomeChanges: ChangeRecord[],
  expenseChanges: ChangeRecord[],
  overrides: OverrideRecord[] = [],
  loanMonthlyTotal = 0
): ProjectionMonth[] {
  const result: ProjectionMonth[] = [];

  for (let month = 1; month <= 12; month++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthStr = dateStr.slice(0, 7);

    let totalIncome = 0;
    for (const inc of incomes) {
      if (inc.effective_from && inc.effective_from > dateStr) continue;
      if (inc.effective_to && inc.effective_to < dateStr) continue;

      // Apply most recent change effective before/on this month
      const applicableChanges = incomeChanges
        .filter((c) => c.income_id === inc.id && c.effective_from <= dateStr)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

      const baseAmount = applicableChanges.length > 0 ? applicableChanges[0].new_amount : inc.amount;
      const amount = resolveAmount('income', inc.id, baseAmount, monthStr, overrides);

      if (inc.interval === 'monthly') {
        totalIncome += amount;
      } else if (inc.interval === 'yearly') {
        totalIncome += amount / 12;
      } else if (inc.interval === 'once') {
        if (inc.effective_from && inc.effective_from.startsWith(monthStr)) {
          totalIncome += amount;
        }
      }
    }

    let totalExpenses = 0;
    for (const exp of expenses) {
      if (exp.effective_from && exp.effective_from > dateStr) continue;
      if (exp.effective_to && exp.effective_to < dateStr) continue;

      const applicableChanges = expenseChanges
        .filter((c) => c.expense_id === exp.id && c.effective_from <= dateStr)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

      const baseAmount = applicableChanges.length > 0 ? applicableChanges[0].new_amount : exp.amount;
      const amount = resolveAmount('expense', exp.id, baseAmount, monthStr, overrides);

      const startDate = exp.effective_from || `${year}-01-01`;
      const startMonth = new Date(startDate).getMonth() + 1;
      const monthsElapsed = (year - new Date(startDate).getFullYear()) * 12 + month - startMonth;

      if (exp.interval_months === 1) {
        totalExpenses += amount;
      } else if (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0) {
        totalExpenses += amount;
      }
    }

    const normalizedNet = totalIncome - totalExpenses;
    const requiredSavings = calcRequiredReserveMonthly(
      expenses.map((e) => ({ id: e.id, amount: e.amount, interval_months: e.interval_months })),
      overrides,
      monthStr
    );
    const effectiveNet = normalizedNet - requiredSavings - loanMonthlyTotal;

    result.push({
      month,
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      savings: Math.round(normalizedNet * 100) / 100,
      required_savings: Math.round(requiredSavings * 100) / 100,
      effective_net: Math.round(effectiveNet * 100) / 100,
    });
  }

  return result;
}

export function calcDailyCashflow(
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  year: number,
  month: number
): DailyCashflowRow[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DailyCashflowRow[] = [];
  let runningBalance = 0;

  const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;

  for (let day = 1; day <= daysInMonth; day++) {
    const bookings: DailyBooking[] = [];

    for (const inc of incomes) {
      if (inc.effective_from && inc.effective_from > dateStr) continue;
      if (inc.effective_to && inc.effective_to < dateStr) continue;
      if (inc.booking_day === day && inc.interval === 'monthly') {
        bookings.push({ id: inc.id, name: inc.name, amount: inc.amount, type: 'income' });
        runningBalance += inc.amount;
      }
    }

    for (const exp of expenses) {
      if (exp.effective_from && exp.effective_from > dateStr) continue;
      if (exp.effective_to && exp.effective_to < dateStr) continue;
      if (exp.booking_day === day) {
        const startDate = exp.effective_from || `${year}-01-01`;
        const startMonth = new Date(startDate).getMonth() + 1;
        const monthsElapsed = (year - new Date(startDate).getFullYear()) * 12 + month - startMonth;

        if (exp.interval_months === 1 || (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0)) {
          bookings.push({ id: exp.id, name: exp.name, amount: exp.amount, type: 'expense' });
          runningBalance -= exp.amount;
        }
      }
    }

    result.push({
      day,
      bookings,
      balance: Math.round(runningBalance * 100) / 100,
    });
  }

  return result;
}

export function calcHealthScore(
  monthlySavingsRate: number,
  emergencyReserveMonths: number,
  debtToIncomeRatio: number
): number {
  const savingsScore = Math.min(monthlySavingsRate / 20, 1) * 40;
  const emergencyScore = Math.min(emergencyReserveMonths / 6, 1) * 30;
  const debtScore = Math.max(0, Math.min(1 - debtToIncomeRatio / 0.4, 1)) * 30;
  return Math.round(savingsScore + emergencyScore + debtScore);
}

export function calcHouseholdBalance(
  sharedExpenses: SharedExpenseRecord[]
): { userAOwes: number; userBOwes: number; net: number } {
  let userAOwes = 0;
  let userBOwes = 0;

  for (const se of sharedExpenses) {
    const totalAmount = se.amount;
    const aShare = totalAmount * se.split_ratio_a;
    const bShare = totalAmount * se.split_ratio_b;

    if (se.paid_by_user_id === se.user_a_id) {
      // A paid, B owes A their share
      userBOwes += bShare;
    } else {
      // B paid, A owes B their share
      userAOwes += aShare;
    }
  }

  return {
    userAOwes: Math.round(userAOwes * 100) / 100,
    userBOwes: Math.round(userBOwes * 100) / 100,
    net: Math.round((userBOwes - userAOwes) * 100) / 100,
  };
}
