# Managing Income & Expenses

Bookings are the heart of HELFINANCE. Here you record everything that regularly comes in or goes out.

---

## Navigation

Under **Bookings** you'll find two tabs:

- **Income** — salary, freelance income, child benefits, rental income…
- **Expenses** — rent, electricity, groceries, insurance…

![Bookings Tabs](../images/bookings-tabs.png)

---

## Income

### Add New Income

Click **+ Add Income** and fill out the form:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Label for this income | "Salary" |
| Amount | Monthly amount in your currency | 3,500 |
| Interval | How often the income recurs | Monthly |
| Booking Day | Day of the month the income arrives (advanced) | 15 |
| Valid From | From what date does this apply (advanced) | 01/01/2025 |
| Valid Until | Optional end date (advanced) | leave blank |

> ℹ️ **Note:** Income entries do not have a category.

> ✅ The **live preview** on the right side of the form immediately shows how your financial overview changes with this booking.

### Edit Income

Click on an existing income entry to open the detail panel. There you can:

- Change the amount and name
- Add a **scheduled change** (e.g. salary raise starting March)
- Set an end date (e.g. temporary job)

### Scheduled Change (Salary Raise)

If your salary changes, don't delete the old booking — use a **scheduled change** instead:

1. Click on the income → detail panel opens
2. Select "Schedule Change"
3. Enter the new amount and **Valid From** date

✅ Example: Salary rises from $3,500 to $3,800 starting 04/01/2025

HELFINANCE shows the old amount through March, the new amount from April — history is preserved.

---

## Expenses

### Add New Expense

Expenses have the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Label for this expense | "Rent" |
| Amount | Amount in your currency | 1,200 |
| Interval | Booking interval | Monthly |
| Category | Thematic classification (basic field) | "Housing" |
| Booking Day | Day of the debit (advanced) | 1 |
| Valid From / Until | Validity period (advanced) | 01/01/2025 |

> ℹ️ **Note:** The category is directly visible in the basic form — no need to expand advanced options.

### Expense Categories

Categories help with analysis in [Reports](./07-reports.md). Recommended categories:

| Category | Typical bookings |
|----------|-----------------|
| Housing | Rent, utilities, internet |
| Transportation | Car loan, gas, public transit, insurance |
| Groceries | Supermarket, farmers market |
| Leisure | Streaming, hobbies, restaurants |
| Insurance | Liability, home contents, health |
| Health | Doctor, medication, gym |
| Savings | Regular savings transfers |

**Create a custom category:** In the Admin Panel under *Manage Categories* or directly when adding an expense.

---

## Intervals Explained

HELFINANCE converts all expenses to monthly amounts. This is important for correct dashboard values.

| Interval | Booking Frequency | Example | Monthly Portion |
|----------|------------------|---------|----------------|
| Monthly | Every month | Rent $1,200 | $1,200 |
| Quarterly | Every 3 months | Insurance $180 | $60 |
| Semi-annual | Every 6 months | License fee $66 | $11 |
| Yearly | Once a year | Car registration $240 | $20 |

> ✅ **Correct:** Car registration $240 entered as **yearly**
> ❌ **Wrong:** Car registration $20 entered as **monthly** (loses context)

---

## Live Preview

When you add or edit a booking, you'll see a live preview on the right side of the form:

- Updates with every input
- Shows the new free money after this booking
- Shows the new Health Score

So you can see the impact of an expense immediately before saving.

---

## Advanced Options (Progressive Disclosure)

The form initially shows only the most important fields. Click **Advanced Options** to see more:

- Valid until (end date)
- Budget limit
- Booking day
- Notes

---

## Quick Add (Mobile / FAB Button)

On mobile, a **+** button appears at the bottom right of the screen. This opens a simplified form for quick entries — ideal when on the go.

---

## Tips

**Fixed vs. variable expenses**

- **Fixed costs:** Same amount every month → monthly, same booking day
  - Examples: Rent, internet, phone plan, Netflix
- **Variable expenses:** Fluctuate → monthly with average amount
  - Examples: Groceries, gas, restaurants

**Entering annual expenses correctly**

| Expense | Amount | Interval | Booking Day | Month |
|---------|--------|----------|-------------|-------|
| Car registration | $240 | Yearly | 15 | March |
| Home insurance | $120 | Yearly | 1 | January |

**Category best practices**

- Max. 8–10 categories for clear reports
- Group similar expenses together (e.g. all insurance in one category)
- Avoid a "Miscellaneous" category — choose a proper category instead

---

Continue with: [Loans →](./05-loans.md)
