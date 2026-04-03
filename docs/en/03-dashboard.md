# Dashboard

The dashboard is your financial command center. At a glance, you can see how your finances are doing.

![Dashboard Overview](../images/dashboard-overview.png)

---

## The Four Widgets

### 🩺 Health Score

The Health Score is a number between 0 and 100 that summarizes your financial health.

**Calculation (simplified):**

```
Health Score = (Free Money / Income) × 100
```

A score of 30 means: you save/keep 30% of your income after all expenses.

**Scale:**

| Score | Rating | What it means |
|-------|--------|--------------|
| 90–100 | 🌟 Excellent | You live well within your means |
| 70–89 | ✅ Good | Solid finances, good buffer |
| 50–69 | 🟡 Fair | Expenses should be monitored |
| 30–49 | 🟠 Low | Little room to maneuver, review expenses |
| 0–29 | 🔴 Critical | Expenses exceed income |

> ✅ Tip: Aim for a score above 70. Anything below 50 should motivate you to reconsider your spending.

---

### 🚦 Traffic Light

The traffic light gives you an immediate sense of your budget situation — without having to read numbers.

| Color | Meaning | Threshold |
|-------|---------|-----------|
| 🟢 Green | Everything is fine | Free money > 20% of income |
| 🟡 Yellow | Tight budget | Free money 5–20% of income |
| 🔴 Red | Expenses too high | Free money < 5% or negative |

---

### 💰 Free Money

Shows how much money you have left over this month after all obligations.

**Calculation:**

```
Free Money = Monthly Income
           − Monthly Expenses
           − Monthly Loan Payments
```

**Example:**

| Item | Amount |
|------|--------|
| Salary | $3,500 |
| − Rent | −$1,200 |
| − Electricity/Gas | −$150 |
| − Internet | −$60 |
| − Groceries | −$500 |
| − Car loan | −$350 |
| **= Free Money** | **$1,240** |

> ⚠️ **Note:** Annual or quarterly expenses are calculated proportionally. A car registration of $240/year counts as $20/month.

---

### 📅 Upcoming Bookings

Lists all bookings for the coming days and weeks, sorted by date. So you can see at a glance when money moves.

Displayed:
- Name of the booking
- Date (booking day this month)
- Amount (income in green, expense in red)
- Category (for expenses)

---

## Warnings

The dashboard automatically shows warning messages when something needs attention:

### Liquidity Warning

Appears when free money is negative or the traffic light is red.

> ⚠️ "Your monthly expenses exceed your income."

**What to do?** Check under [Bookings](./04-bookings.md) which expenses can be reduced.

### Savings Warning

Appears when your savings balance is below the recommended emergency fund amount.

> ⚠️ "Your savings are below the recommended minimum (3 months of expenses)."

**What to do?** More details in the [Savings Guide](./06-savings.md).

---

## Mobile View (PWA)

HELFINANCE is installable as a PWA (Progressive Web App) — like a native app on your phone.

**Installation on Android/iOS:**
1. Open HELFINANCE in the browser
2. Select "Add to Home Screen"
3. App icon appears on the home screen

**FAB Button (Floating Action Button)**

On mobile, a `+` button appears at the bottom right. Use it to quickly add new bookings without navigating through menus.

---

Continue with: [Income & Expenses →](./04-bookings.md)
