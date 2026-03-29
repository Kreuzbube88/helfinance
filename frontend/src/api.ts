import type {
  User,
  Income,
  IncomeChange,
  Expense,
  Loan,
  LoanSpecialPayment,
  AmortizationRow,
  SavingsGoal,
  SavingsAccount,
  SavingsTransaction,
  BookingOverride,
  Notification,
  MonthlySnapshot,
  DashboardData,
  CashflowDay,
  MonthlyReport,
  YearlyReport,
  LoginResponse,
  HouseholdLink,
  SharedExpense,
  Category,
  Transaction
} from './types'

const BASE = '/api/v1'

export function setToken(t: string): void {
  localStorage.setItem('helfinance_token', t)
}

export function getToken(): string | null {
  return localStorage.getItem('helfinance_token')
}

export function clearToken(): void {
  localStorage.removeItem('helfinance_token')
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || `HTTP ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as unknown as T
  }

  return res.json() as Promise<T>
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body)
}

export function del(path: string): Promise<void> {
  return request<void>('DELETE', path)
}

// Setup
export function getSetupStatus(): Promise<{ setupRequired: boolean }> {
  return get('/setup/status')
}

export function setupInit(data: {
  username: string
  email: string
  password: string
  language: string
  currency: string
}): Promise<LoginResponse> {
  return post<LoginResponse>('/setup/init', data)
}

// Auth
export function login(username: string, password: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/login', { username, password })
}

export function register(username: string, email: string, password: string): Promise<LoginResponse> {
  return post<LoginResponse>('/auth/register', { username, email, password })
}

export function getOidcConfig(): Promise<{ enabled: boolean; display_name: string; url: string }> {
  return get('/auth/oidc/config')
}

// Dashboard
export function getDashboard(): Promise<DashboardData> {
  return get<DashboardData>('/dashboard')
}

// Income
export function getIncome(): Promise<Income[]> {
  return get<Income[]>('/income')
}

export function createIncome(data: Omit<Income, 'id' | 'user_id' | 'created_at'>): Promise<Income> {
  return post<Income>('/income', data)
}

export function updateIncome(id: number, data: Partial<Income>): Promise<Income> {
  return put<Income>(`/income/${id}`, data)
}

export function deleteIncome(id: number): Promise<void> {
  return del(`/income/${id}`)
}

export function scheduleIncomeChange(id: number, data: { new_amount: number; effective_from: string }): Promise<IncomeChange> {
  return post<IncomeChange>(`/income/${id}/changes`, data)
}

export function getIncomeChanges(id: number): Promise<IncomeChange[]> {
  return get<IncomeChange[]>(`/income/${id}/changes`)
}

export function deleteIncomeChange(incomeId: number, changeId: number): Promise<void> {
  return del(`/income/${incomeId}/changes/${changeId}`)
}

// Expenses
export function getExpenses(): Promise<Expense[]> {
  return get<Expense[]>('/expenses')
}

export function createExpense(data: Omit<Expense, 'id' | 'user_id' | 'created_at'>): Promise<Expense> {
  return post<Expense>('/expenses', data)
}

export function updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
  return put<Expense>(`/expenses/${id}`, data)
}

export function deleteExpense(id: number): Promise<void> {
  return del(`/expenses/${id}`)
}

export function scheduleExpenseChange(id: number, data: { new_amount: number; effective_from: string }): Promise<void> {
  return post<void>(`/expenses/${id}/changes`, data)
}

export function getExpenseChanges(id: number): Promise<{ id: number; expense_id: number; new_amount: number; effective_from: string }[]> {
  return get(`/expenses/${id}/changes`)
}

export function deleteExpenseChange(expenseId: number, changeId: number): Promise<void> {
  return del(`/expenses/${expenseId}/changes/${changeId}`)
}

// Loans
export function getLoans(): Promise<Loan[]> {
  return get<Loan[]>('/loans')
}

type CreateLoanPayload = Partial<Omit<Loan, 'id' | 'user_id' | 'created_at' | 'monthly_rate' | 'interest_rate_dynamic'>> & {
  name: string
  principal: number
  term_months: number
  start_date: string
  monthly_rate_input?: number
}

export function createLoan(data: CreateLoanPayload): Promise<Loan> {
  return post<Loan>('/loans', data)
}

export function updateLoan(id: number, data: Partial<Loan>): Promise<Loan> {
  return put<Loan>(`/loans/${id}`, data)
}

export function deleteLoan(id: number): Promise<void> {
  return del(`/loans/${id}`)
}

export function getLoanAmortization(id: number): Promise<AmortizationRow[]> {
  return get<AmortizationRow[]>(`/loans/${id}/amortization`)
}

// Savings Goals
export function getSavingsGoals(): Promise<SavingsGoal[]> {
  return get<SavingsGoal[]>('/savings')
}

export function createSavingsGoal(data: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'required_monthly_saving'>): Promise<SavingsGoal> {
  return post<SavingsGoal>('/savings', data)
}

export function updateSavingsGoal(id: number, data: Partial<SavingsGoal>): Promise<SavingsGoal> {
  return put<SavingsGoal>(`/savings/${id}`, data)
}

export function deleteSavingsGoal(id: number): Promise<void> {
  return del(`/savings/${id}`)
}

// Cashflow
export function getCashflow(year: number, month: number): Promise<CashflowDay[]> {
  return get<CashflowDay[]>(`/reports/cashflow?year=${year}&month=${month}`)
}

// Reports
export function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  return get<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`)
}

export function getYearlyReport(year: number): Promise<YearlyReport> {
  return get<YearlyReport>(`/reports/yearly?year=${year}`)
}

export function getSnapshots(): Promise<MonthlySnapshot[]> {
  return get<MonthlySnapshot[]>('/reports/snapshots')
}

// Household
export function getHousehold(): Promise<HouseholdLink | null> {
  return get<HouseholdLink | null>('/household')
}

export function inviteHousehold(usernameOrEmail: string): Promise<HouseholdLink> {
  return post<HouseholdLink>('/household/invite', { usernameOrEmail })
}

export function acceptHousehold(id: number): Promise<HouseholdLink> {
  return post<HouseholdLink>(`/household/confirm/${id}`, {})
}

export function cancelHousehold(_id?: number): Promise<void> {
  return del('/household')
}

export function getHouseholdBalance(): Promise<{ userAOwes: number; userBOwes: number; net: number }> {
  return get('/household/balance')
}

export function getSharedExpenses(): Promise<SharedExpense[]> {
  return get<SharedExpense[]>('/household/shared-expenses')
}

export function createSharedExpense(data: Omit<SharedExpense, 'id' | 'household_id' | 'created_at'>): Promise<SharedExpense> {
  return post<SharedExpense>('/household/shared-expenses', data)
}

// Notifications
export function getNotifications(): Promise<Notification[]> {
  return get<Notification[]>('/notifications')
}

export function markNotificationRead(id: number): Promise<void> {
  return put<void>(`/notifications/${id}/read`, {})
}

export function deleteNotification(id: number): Promise<void> {
  return del(`/notifications/${id}`)
}

// Profile
export function getProfile(): Promise<User> {
  return get<User>('/users/profile')
}

export function updateProfile(data: Partial<Pick<User, 'username' | 'email' | 'language' | 'currency'>>): Promise<User> {
  return put<User>('/users/profile', data)
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return put<void>('/users/password', { old_password: oldPassword, new_password: newPassword })
}

// Admin
export function getAdminUsers(): Promise<User[]> {
  return get<User[]>('/admin/users')
}

export function deleteAdminUser(id: number): Promise<void> {
  return del(`/admin/users/${id}`)
}

export function updateAdminUser(id: number, data: { toggle_admin?: boolean; reset_password?: string }): Promise<void> {
  return put<void>(`/admin/users/${id}`, data)
}

export function getAdminSettings(): Promise<Record<string, string>> {
  return get<Record<string, string>>('/admin/settings')
}

export function updateAdminSettings(data: Record<string, string>): Promise<void> {
  return put<void>('/admin/settings', data)
}

export function sendTestEmail(): Promise<void> {
  return post<void>('/admin/settings/test-email', {})
}

// Categories
export function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories')
}

export function updateCategory(id: number, data: Partial<Category>): Promise<Category> {
  return put<Category>(`/categories/${id}`, data)
}

// Transactions (V1)
export function getTransactions(): Promise<Transaction[]> {
  return get<Transaction[]>('/transactions')
}

export function createTransaction(data: Omit<Transaction, 'id' | 'user_id' | 'income_id' | 'expense_id' | 'is_auto'>): Promise<Transaction> {
  return post<Transaction>('/transactions', data)
}

export function updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction> {
  return put<Transaction>(`/transactions/${id}`, data)
}

export function deleteTransaction(id: number): Promise<void> {
  return del(`/transactions/${id}`)
}

export function importTransactionsCsv(csv: string): Promise<{ imported: number; errors: string[] }> {
  return post('/transactions/import', { csv })
}

// Loan Special Payments
export function getLoanSpecialPayments(loanId: number): Promise<LoanSpecialPayment[]> {
  return get<LoanSpecialPayment[]>(`/loans/${loanId}/special-payments`)
}

export function createLoanSpecialPayment(loanId: number, data: { amount: number; date: string }): Promise<LoanSpecialPayment> {
  return post<LoanSpecialPayment>(`/loans/${loanId}/special-payments`, data)
}

export function deleteLoanSpecialPayment(loanId: number, spId: number): Promise<void> {
  return del(`/loans/${loanId}/special-payments/${spId}`)
}

// Savings Account & Transactions
export function getSavingsBalance(): Promise<SavingsAccount> {
  return get<SavingsAccount>('/savings/balance')
}

export function setSavingsInitialBalance(initial_balance: number): Promise<{ initial_balance: number }> {
  return put<{ initial_balance: number }>('/savings/balance/initial', { initial_balance })
}

export function getSavingsTransactions(): Promise<SavingsTransaction[]> {
  return get<SavingsTransaction[]>('/savings/transactions')
}

export function createSavingsTransaction(data: { amount: number; date: string; description?: string }): Promise<SavingsTransaction> {
  return post<SavingsTransaction>('/savings/transactions', data)
}

export function deleteSavingsTransaction(id: number): Promise<void> {
  return del(`/savings/transactions/${id}`)
}

// Booking Overrides
export function getOverrides(params?: { booking_type?: string; booking_id?: number }): Promise<BookingOverride[]> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : ''
  return get<BookingOverride[]>(`/overrides${qs}`)
}

export function upsertOverride(data: Omit<BookingOverride, 'id' | 'user_id'>): Promise<BookingOverride> {
  return post<BookingOverride>('/overrides', data)
}

export function deleteOverride(id: number): Promise<void> {
  return del(`/overrides/${id}`)
}

// Widget preferences (V6)
export function getWidgetPrefs(): Promise<Record<string, boolean>> {
  return get<Record<string, boolean>>('/widgets')
}

export function updateWidgetPref(key: string, visible: boolean): Promise<void> {
  return put<void>(`/widgets/${key}`, { visible })
}

// Onboarding
export function completeOnboarding(): Promise<void> {
  return put<void>('/users/onboarding-done', {})
}

// Export (browser download helpers)
export function downloadPdf(year: number, month?: number): void {
  const token = getToken()
  const params = month !== undefined ? `year=${year}&month=${month}` : `year=${year}`
  const url = `${BASE}/export/pdf?${params}`
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', '')
  // Pass token via URL param since download links can't set headers
  a.href = `${url}&token=${token ?? ''}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function downloadCsv(year: number, month?: number): void {
  const token = getToken()
  const params = month !== undefined ? `year=${year}&month=${month}` : `year=${year}`
  const url = `${BASE}/export/csv?${params}`
  const a = document.createElement('a')
  a.href = `${url}&token=${token ?? ''}`
  a.setAttribute('download', '')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
