export interface User {
  id: number
  username: string
  email: string
  is_admin: boolean
  language: string
  currency: string
  onboarding_done: boolean
  created_at: string
}

export interface Income {
  id: number
  user_id: number
  name: string
  amount: number
  interval: 'monthly' | 'yearly' | 'once'
  booking_day: number
  effective_from: string
  effective_to: string | null
  category_id?: number | null
  is_active?: number
  created_at: string
}

export interface IncomeChange {
  id: number
  income_id: number
  new_amount: number
  effective_from: string
  created_at: string
}

export interface Expense {
  id: number
  user_id: number
  name: string
  amount: number
  interval_months: number
  booking_day: number
  category?: string
  category_id: number | null
  effective_from: string
  effective_to: string | null
  is_active?: number
  created_at: string
}

export interface ExpenseChange {
  id: number
  expense_id: number
  new_amount: number
  effective_from: string
  created_at: string
}

export interface Loan {
  id: number
  user_id: number
  name: string
  principal: number
  interest_rate_pct: number
  term_months: number
  monthly_rate: number
  start_date: string
  loan_type: 'annuity' | 'real_estate'
  interest_rate_dynamic: number
  final_payment: number | null
  created_at: string
}

export interface LoanSpecialPayment {
  id: number
  loan_id: number
  amount: number
  date: string
}

export interface AmortizationRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface SavingsAccount {
  initial_balance: number
  initial_balance_date: string | null
  current_balance: number
}

export interface SavingsExpense {
  id: number
  name: string
  amount: number
  interval_months: number
}

export interface SavingsSummary {
  initial_balance: number
  initial_balance_date: string | null
  monthly_contribution: number
  total_contributions: number
  adjustments_sum: number
  current_balance: number
  sparen_expenses: SavingsExpense[]
  transactions: SavingsTransaction[]
  projection: Array<{ year: number; month: number; balance: number }>
}

export interface SavingsTransaction {
  id: number
  user_id: number
  amount: number
  date: string
  description: string | null
  created_at: string
}

export interface Category {
  id: number
  name: string
  user_id: number | null
  icon: string
  color: string
  budget_limit: number | null
  type: 'income' | 'expense' | 'both'
}

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  read: boolean
  created_at: string
}

export interface MonthlySnapshot {
  id: number
  user_id: number
  year: number
  month: number
  total_income: number
  total_expenses: number
  total_savings: number
  net: number
  created_at: string
}

export interface DashboardData {
  health_score: number
  free_money: number
  upcoming_bookings: UpcomingBooking[]
  liquidity_warning: boolean
  reserve_warning: boolean
  required_reserve_monthly: number
  savings_balance: number
  budget_status: 'green' | 'yellow' | 'red'
  total_income: number
  total_expenses: number
}

export interface UpcomingBooking {
  name: string
  amount: number
  type: 'income' | 'expense'
  booking_day: number
  date: string
}

export interface RequiredSavingsItem {
  name: string
  amount: number
  interval_months: number
  monthly_reserve: number
}

export interface MonthlyReport {
  year: number
  month: number
  income_breakdown: { name: string; amount: number; interval: string; monthly_amount: number }[]
  expense_breakdown: { category: string; items: { name: string; amount: number }[]; total: number }[]
  total_income: number
  total_expenses: number
  net: number
  required_savings: number
  loan_monthly_total: number
  effective_net: number
  required_savings_breakdown: RequiredSavingsItem[]
  snapshots: MonthlySnapshot[]
}

export interface YearlyReport {
  year: number
  months: {
    month: number
    income: number
    fixed_expenses: number
    provisions: number
    loans: number
    net_savings: number
    effective_net: number
  }[]
  totals: {
    income: number
    fixed_expenses: number
    provisions: number
    loans: number
    net_savings: number
    effective_net: number
  }
}

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export interface OidcConfig {
  discovery_url: string
  client_id: string
  client_secret: string
  display_name: string
  enabled: boolean
}

export interface AdminSettings {
  default_language: string
  default_currency: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface ApiError {
  error: string
  message?: string
}
