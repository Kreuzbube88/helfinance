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
  category: string
  effective_from: string
  effective_to: string | null
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
  created_at: string
}

export interface AmortizationRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface SavingsGoal {
  id: number
  user_id: number
  name: string
  target_amount: number
  current_amount: number
  contribution_mode: 'fixed' | 'dynamic' | 'both'
  fixed_amount: number | null
  buffer_amount: number | null
  created_at: string
}

export interface Category {
  id: number
  name: string
  user_id: number | null
  icon: string
  color: string
  budget_limit: number | null
}

export interface Transaction {
  id: number
  user_id: number
  name: string
  amount: number
  type: 'income' | 'expense'
  category_id: number | null
  date: string
  note: string | null
}

export interface HouseholdLink {
  id: number
  user_a_id: number
  user_b_id: number
  status: 'pending' | 'active'
  invited_by: number
  created_at: string
  partner_username?: string
  partner_email?: string
}

export interface SharedExpense {
  id: number
  household_id: number
  name: string
  amount: number
  split_pct_a: number
  split_pct_b: number
  paid_by: number
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
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
  savings_goals: SavingsGoal[]
  liquidity_warning: boolean
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

export interface CashflowDay {
  date: string
  day: number
  income_bookings: { name: string; amount: number }[]
  expense_bookings: { name: string; amount: number }[]
  projected_balance: number
}

export interface MonthlyReport {
  year: number
  month: number
  income_breakdown: { name: string; amount: number; interval: string }[]
  expense_breakdown: { category: string; items: { name: string; amount: number }[]; total: number }[]
  total_income: number
  total_expenses: number
  net: number
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
  }[]
  totals: {
    income: number
    fixed_expenses: number
    provisions: number
    loans: number
    net_savings: number
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
