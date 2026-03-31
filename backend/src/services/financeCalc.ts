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
  loan_payments: number;
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

export interface SpecialPayment {
  amount: number;
  date: string; // YYYY-MM
}

export interface MonthlyTotalsResult {
  totalIncome: number;
  totalExpenses: number;
  totalLoanPayments: number;
  freeMoney: number;
  requiredSavings: number;
  effectiveNet: number;
}

export function normalizeToMonthly(amount: number, intervalMonths: number): number {
  return amount / intervalMonths;
}

/** Convert income interval string to number of months between occurrences. */
export function incomeIntervalToMonths(interval: string): number {
  if (interval === 'yearly') return 12;
  if (interval === 'once') return 0;
  return 1;
}

export function calcProvisionBuffer(
  expenses: Array<{ amount: number; interval_months: number }>
): number {
  return expenses
    .filter((e) => e.interval_months > 1)
    .reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.interval_months), 0);
}

/** Monthly reserve required for non-monthly expenses (interval > 1 month). */
export function calcRequiredReserveMonthly(
  expenses: Array<{ id: number; amount: number; interval_months: number }>
): number {
  return expenses
    .filter((e) => e.interval_months > 1)
    .reduce((sum, e) => sum + e.amount / e.interval_months, 0);
}

/** Resolve effective base amount applying most recent change effective on or before dateStr. */
function resolveBaseAmount(
  baseAmount: number,
  id: number,
  idField: 'income_id' | 'expense_id',
  changes: ChangeRecord[],
  dateStr: string
): number {
  const applicable = changes
    .filter((c) => c[idField] === id && c.effective_from <= dateStr)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return applicable.length > 0 ? applicable[0].new_amount : baseAmount;
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

/** Single source of truth for all monthly financial totals. */
export function calcMonthlyTotals(params: {
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  incomeChanges: ChangeRecord[];
  expenseChanges: ChangeRecord[];
  loans: Array<{ monthly_rate: number | null; start_date: string; term_months: number }>;
  year: number;
  month: number;
}): MonthlyTotalsResult {
  const { incomes, expenses, incomeChanges, expenseChanges, loans, year, month } = params;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const dateStr = `${monthStr}-01`;

  let totalIncome = 0;
  for (const inc of incomes) {
    if (inc.effective_from && inc.effective_from > dateStr) continue;
    if (inc.effective_to && inc.effective_to < dateStr) continue;

    const amount = resolveBaseAmount(inc.amount, inc.id, 'income_id', incomeChanges, dateStr);

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

    const amount = resolveBaseAmount(exp.amount, exp.id, 'expense_id', expenseChanges, dateStr);

    if (exp.interval_months === 1) {
      totalExpenses += amount;
    } else {
      const startDate = exp.effective_from ?? `${year}-01-01`;
      const fromDate = new Date(startDate);
      const monthsElapsed = (year - fromDate.getFullYear()) * 12 + (month - (fromDate.getMonth() + 1));
      if (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0) {
        totalExpenses += amount;
      }
    }
  }

  // Active loans only
  const currentDate = new Date(year, month - 1, 1);
  const totalLoanPayments = loans.reduce((sum, l) => {
    const end = new Date(l.start_date);
    end.setMonth(end.getMonth() + l.term_months);
    if (currentDate < end) {
      return sum + (l.monthly_rate ?? 0);
    }
    return sum;
  }, 0);

  const freeMoney = totalIncome - totalExpenses - totalLoanPayments;

  const requiredSavings = calcRequiredReserveMonthly(
    expenses
      .filter((e) => {
        if (e.effective_from && e.effective_from > dateStr) return false;
        if (e.effective_to && e.effective_to < dateStr) return false;
        return true;
      })
      .map((e) => ({
        id: e.id,
        amount: resolveBaseAmount(e.amount, e.id, 'expense_id', expenseChanges, dateStr),
        interval_months: e.interval_months,
      }))
  );

  const effectiveNet = totalIncome - totalExpenses - requiredSavings - totalLoanPayments;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalLoanPayments: Math.round(totalLoanPayments * 100) / 100,
    freeMoney: Math.round(freeMoney * 100) / 100,
    requiredSavings: Math.round(requiredSavings * 100) / 100,
    effectiveNet: Math.round(effectiveNet * 100) / 100,
  };
}

export function calcYearlyProjection(
  year: number,
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  incomeChanges: ChangeRecord[],
  expenseChanges: ChangeRecord[],
  loans: Array<{ monthly_rate: number | null; start_date: string; term_months: number }> = []
): ProjectionMonth[] {
  const result: ProjectionMonth[] = [];

  for (let month = 1; month <= 12; month++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;

    let totalIncome = 0;
    for (const inc of incomes) {
      if (inc.effective_from && inc.effective_from > dateStr) continue;
      if (inc.effective_to && inc.effective_to < dateStr) continue;

      const amount = resolveBaseAmount(inc.amount, inc.id, 'income_id', incomeChanges, dateStr);

      if (inc.interval === 'monthly') {
        totalIncome += amount;
      } else if (inc.interval === 'yearly') {
        totalIncome += amount / 12;
      } else if (inc.interval === 'once') {
        const monthStr = dateStr.slice(0, 7);
        if (inc.effective_from && inc.effective_from.startsWith(monthStr)) {
          totalIncome += amount;
        }
      }
    }

    let totalExpenses = 0;
    for (const exp of expenses) {
      if (exp.effective_from && exp.effective_from > dateStr) continue;
      if (exp.effective_to && exp.effective_to < dateStr) continue;

      const amount = resolveBaseAmount(exp.amount, exp.id, 'expense_id', expenseChanges, dateStr);

      if (exp.interval_months === 1) {
        totalExpenses += amount;
      } else {
        const startDate = exp.effective_from ?? `${year}-01-01`;
        const fromDate = new Date(startDate);
        const monthsElapsed = (year - fromDate.getFullYear()) * 12 + (month - (fromDate.getMonth() + 1));
        if (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0) {
          totalExpenses += amount;
        }
      }
    }

    // Active loans for this month
    const currentDate = new Date(year, month - 1, 1);
    const activeLoanTotal = loans.reduce((sum, l) => {
      const end = new Date(l.start_date);
      end.setMonth(end.getMonth() + l.term_months);
      if (currentDate < end) return sum + (l.monthly_rate ?? 0);
      return sum;
    }, 0);

    const normalizedNet = totalIncome - totalExpenses;
    const requiredSavings = calcRequiredReserveMonthly(
      expenses
        .filter((e) => {
          if (e.effective_from && e.effective_from > dateStr) return false;
          if (e.effective_to && e.effective_to < dateStr) return false;
          return true;
        })
        .map((e) => ({
          id: e.id,
          amount: resolveBaseAmount(e.amount, e.id, 'expense_id', expenseChanges, dateStr),
          interval_months: e.interval_months,
        }))
    );
    const effectiveNet = normalizedNet - requiredSavings - activeLoanTotal;

    result.push({
      month,
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      savings: Math.round(normalizedNet * 100) / 100,
      required_savings: Math.round(requiredSavings * 100) / 100,
      loan_payments: Math.round(activeLoanTotal * 100) / 100,
      effective_net: Math.round(effectiveNet * 100) / 100,
    });
  }

  return result;
}

export function calcDailyCashflow(
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  year: number,
  month: number,
  options: {
    incomeChanges?: ChangeRecord[];
    expenseChanges?: ChangeRecord[];
    startingBalance?: number;
  } = {}
): DailyCashflowRow[] {
  const { incomeChanges = [], expenseChanges = [], startingBalance = 0 } = options;
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DailyCashflowRow[] = [];
  let runningBalance = startingBalance;

  const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthStr = dateStr.slice(0, 7);

  for (let day = 1; day <= daysInMonth; day++) {
    const bookings: DailyBooking[] = [];

    for (const inc of incomes) {
      if (inc.effective_from && inc.effective_from > dateStr) continue;
      if (inc.effective_to && inc.effective_to < dateStr) continue;

      if (inc.interval === 'monthly' && inc.booking_day === day) {
        const amount = resolveBaseAmount(inc.amount, inc.id, 'income_id', incomeChanges, dateStr);
        bookings.push({ id: inc.id, name: inc.name, amount, type: 'income' });
        runningBalance += amount;
      } else if (inc.interval === 'yearly' && inc.booking_day === day) {
        const bookMonth = inc.effective_from ? new Date(inc.effective_from).getMonth() + 1 : 1;
        if (month === bookMonth) {
          const amount = resolveBaseAmount(inc.amount, inc.id, 'income_id', incomeChanges, dateStr);
          bookings.push({ id: inc.id, name: inc.name, amount, type: 'income' });
          runningBalance += amount;
        }
      } else if (inc.interval === 'once' && inc.booking_day === day) {
        if (inc.effective_from && inc.effective_from.startsWith(monthStr)) {
          const amount = resolveBaseAmount(inc.amount, inc.id, 'income_id', incomeChanges, dateStr);
          bookings.push({ id: inc.id, name: inc.name, amount, type: 'income' });
          runningBalance += amount;
        }
      }
    }

    for (const exp of expenses) {
      if (exp.effective_from && exp.effective_from > dateStr) continue;
      if (exp.effective_to && exp.effective_to < dateStr) continue;
      if (exp.booking_day === day) {
        const fromDate = new Date(exp.effective_from ?? `${year}-01-01`);
        const monthsElapsed = (year - fromDate.getFullYear()) * 12 + (month - (fromDate.getMonth() + 1));

        if (exp.interval_months === 1 || (monthsElapsed >= 0 && monthsElapsed % exp.interval_months === 0)) {
          const amount = resolveBaseAmount(exp.amount, exp.id, 'expense_id', expenseChanges, dateStr);
          bookings.push({ id: exp.id, name: exp.name, amount, type: 'expense' });
          runningBalance -= amount;
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
