# Loans

HELFINANCE helps you keep track of loans and understand how long you have left to pay.

---

## What is an Annuity Loan?

An **annuity loan** is the most common type of loan — for example, for cars or home improvements. You pay the same amount every month (the "installment"). At the beginning more of your payment goes toward interest, and at the end more goes toward principal repayment.

**Simple example:**

- Loan amount: $10,000
- Interest rate: 5% per year
- Term: 3 years
- Monthly payment: ~$299.71

---

## Adding a Loan

Click **+ Add Loan** and fill out the form:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Label for the loan | "Car Loan - Honda Civic" |
| Principal | The original borrowed amount | $15,000 |
| Interest Rate | Annual interest rate in percent | 4.5 |
| Term | Total term in months | 48 (= 4 years) |
| Start Date | When did the loan begin? | 03/01/2024 |

> ✅ After saving, HELFINANCE automatically calculates your monthly payment and creates the full amortization schedule.

---

## Amortization Schedule

The amortization schedule shows for every month of the loan term:

| Column | Meaning |
|--------|---------|
| Month | Month of the payment |
| Payment | Total payment amount |
| Interest | Interest portion of this payment |
| Principal | Repayment portion |
| Remaining Balance | Remaining debt after this payment |

**Why does the remaining balance decrease slowly at the start?**

At the beginning of a loan, the outstanding balance is high → more interest accrues → less of your payment goes to principal. With each payment the balance decreases, so interest decreases → more principal repayment. This is called **amortization**.

![Amortization Schedule](../images/loan-amortization.png)

---

## Dashboard Integration

Loan payments are automatically included in the dashboard:

```
Free Money = Income − Expenses − Loan Payments
```

Every active loan counts as a monthly obligation and affects the Health Score.

> ✅ You do **not** need to add loan payments separately under "Expenses" — they are calculated directly from the Loans section.

---

## Loans in Reports

In the [Monthly Reports](./07-reports.md), loan payments appear as their own line in the expenses overview. This clearly shows what portion of your monthly spending goes toward loans.

---

## Extra Payments

Have a larger sum available and want to pay off the loan faster? Enter an **extra payment**:

1. Click the loan → detail view
2. Select "Add Extra Payment"
3. Enter amount and date

HELFINANCE recalculates the amortization schedule and shows you how many months you save and how much interest you avoid paying.

---

## Avalanche Hint

If you have multiple loans, HELFINANCE shows an **avalanche hint**: which loan should you pay off first to pay the least interest overall?

**Strategy:** Pay off the loan with the highest interest rate first — this saves the most money in the long run.

---

Continue with: [Savings & Emergency Fund →](./06-savings.md)
