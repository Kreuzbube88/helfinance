import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import { calcLoanMonthlyRate, generateAmortization, SpecialPayment } from '../services/financeCalc';

interface LoanRow {
  id: number;
  user_id: number;
  name: string;
  principal: number;
  interest_rate_pct: number;
  start_date: string;
  term_months: number;
  monthly_rate: number | null;
  category_id: number | null;
  loan_type: 'annuity' | 'real_estate';
  interest_rate_dynamic: number;
  final_payment: number | null;
}

/**
 * Reverse-calculates annual interest rate (%) from known monthly_rate, principal, and term.
 * Uses bisection. Returns null if no solution found.
 */
function calcInterestRateFromMonthlyRate(principal: number, monthly_rate: number, term_months: number, final_payment: number | null = null): number | null {
  // For balloon loans: monthly_rate = principal * r / (1 - (1+r)^-n) - final_payment * r / ((1+r)^n - 1)...
  // Simplification: use standard annuity formula for bisection target
  const target = (r: number) => {
    if (r === 0) {
      // zero-interest: payment = (principal - (final_payment ?? 0)) / term_months
      return (principal - (final_payment ?? 0)) / term_months;
    }
    const fp = final_payment ?? 0;
    // annuity with balloon: M = (P - FP*(1+r)^-n) * r / (1 - (1+r)^-n)
    const pow = Math.pow(1 + r, term_months);
    return (principal - fp / pow) * r / (1 - 1 / pow);
  };

  let lo = 0.000001;
  let hi = 1.0; // 100% monthly = absurd, but safe upper bound
  if (target(hi) < monthly_rate) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const val = target(mid);
    if (Math.abs(val - monthly_rate) < 0.000001) {
      return Math.round(mid * 12 * 100 * 10000) / 10000; // annual %
    }
    if (val < monthly_rate) lo = mid;
    else hi = mid;
  }
  const mid = (lo + hi) / 2;
  return Math.round(mid * 12 * 100 * 10000) / 10000;
}

interface SpecialPaymentRow {
  id: number;
  loan_id: number;
  amount: number;
  date: string;
}

export function createLoansRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM loans WHERE user_id = ? ORDER BY id ASC')
        .all(req.user!.id) as LoanRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, principal, interest_rate_pct, monthly_rate_input, final_payment, start_date, term_months, category_id, loan_type, interest_rate_dynamic } =
        req.body as {
          name: string;
          principal: number;
          interest_rate_pct?: number;
          monthly_rate_input?: number;
          final_payment?: number;
          start_date: string;
          term_months: number;
          category_id?: number;
          loan_type?: 'annuity' | 'real_estate';
          interest_rate_dynamic?: boolean;
        };

      if (!name || principal == null || !start_date || !term_months) {
        res.status(400).json({ error: 'name, principal, start_date, term_months are required' });
        return;
      }
      if (interest_rate_pct == null && monthly_rate_input == null) {
        res.status(400).json({ error: 'Either interest_rate_pct or monthly_rate_input is required' });
        return;
      }

      let resolvedRate = interest_rate_pct ?? 0;
      let resolvedMonthlyRate: number;

      if (monthly_rate_input != null) {
        const computed = calcInterestRateFromMonthlyRate(principal, monthly_rate_input, term_months, final_payment ?? null);
        if (computed === null) {
          res.status(400).json({ error: 'Could not compute interest rate from provided monthly rate' });
          return;
        }
        resolvedRate = computed;
        resolvedMonthlyRate = monthly_rate_input;
      } else {
        resolvedMonthlyRate = calcLoanMonthlyRate(principal, resolvedRate, term_months);
      }

      const result = db
        .prepare(
          'INSERT INTO loans (user_id, name, principal, interest_rate_pct, start_date, term_months, monthly_rate, category_id, loan_type, interest_rate_dynamic, final_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.user!.id,
          name,
          principal,
          resolvedRate,
          start_date,
          term_months,
          resolvedMonthlyRate,
          category_id ?? null,
          loan_type ?? 'annuity',
          interest_rate_dynamic ? 1 : 0,
          final_payment ?? null
        );
      const row = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid) as LoanRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as LoanRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Loan not found' });
        return;
      }

      const { name, principal, interest_rate_pct, monthly_rate_input, final_payment, start_date, term_months, category_id, loan_type, interest_rate_dynamic } =
        req.body as {
          name?: string;
          principal?: number;
          interest_rate_pct?: number;
          monthly_rate_input?: number;
          final_payment?: number | null;
          start_date?: string;
          term_months?: number;
          category_id?: number;
          loan_type?: 'annuity' | 'real_estate';
          interest_rate_dynamic?: boolean;
        };

      const newPrincipal = principal ?? existing.principal;
      const newTerm = term_months ?? existing.term_months;
      const newFinalPayment = final_payment !== undefined ? final_payment : existing.final_payment;

      let newRate: number;
      let newMonthlyRate: number;

      if (monthly_rate_input != null) {
        const computed = calcInterestRateFromMonthlyRate(newPrincipal, monthly_rate_input, newTerm, newFinalPayment);
        if (computed === null) {
          res.status(400).json({ error: 'Could not compute interest rate from provided monthly rate' });
          return;
        }
        newRate = computed;
        newMonthlyRate = monthly_rate_input;
      } else {
        newRate = interest_rate_pct ?? existing.interest_rate_pct;
        newMonthlyRate = calcLoanMonthlyRate(newPrincipal, newRate, newTerm);
      }

      db.prepare(
        `UPDATE loans SET
          name = COALESCE(?, name),
          principal = ?,
          interest_rate_pct = ?,
          start_date = COALESCE(?, start_date),
          term_months = ?,
          monthly_rate = ?,
          category_id = COALESCE(?, category_id),
          loan_type = COALESCE(?, loan_type),
          interest_rate_dynamic = COALESCE(?, interest_rate_dynamic),
          final_payment = ?
        WHERE id = ?`
      ).run(
        name ?? null,
        newPrincipal,
        newRate,
        start_date ?? null,
        newTerm,
        newMonthlyRate,
        category_id ?? null,
        loan_type ?? null,
        interest_rate_dynamic != null ? (interest_rate_dynamic ? 1 : 0) : null,
        newFinalPayment,
        id
      );

      const updated = db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as LoanRow;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as LoanRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Loan not found' });
        return;
      }
      db.prepare('DELETE FROM loans WHERE id = ?').run(id);
      res.json({ message: 'Loan deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/:id/amortization', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const loan = db
        .prepare('SELECT * FROM loans WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as LoanRow | undefined;
      if (!loan) {
        res.status(404).json({ error: 'Loan not found' });
        return;
      }
      const specialRows = db
        .prepare('SELECT * FROM loan_special_payments WHERE loan_id = ? ORDER BY date ASC')
        .all(id) as SpecialPaymentRow[];
      const specialPayments: SpecialPayment[] = specialRows.map((r) => ({ amount: r.amount, date: r.date }));
      const schedule = generateAmortization(
        loan.principal,
        loan.interest_rate_pct,
        loan.term_months,
        loan.start_date,
        specialPayments
      );
      res.json(schedule);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- Special Payments ---

  router.get('/:id/special-payments', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const loan = db
        .prepare('SELECT id FROM loans WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as { id: number } | undefined;
      if (!loan) { res.status(404).json({ error: 'Loan not found' }); return; }
      const rows = db
        .prepare('SELECT * FROM loan_special_payments WHERE loan_id = ? ORDER BY date ASC')
        .all(id) as SpecialPaymentRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/:id/special-payments', (req: Request, res: Response) => {
    try {
      const loanId = parseInt(req.params.id, 10);
      const loan = db
        .prepare('SELECT id FROM loans WHERE id = ? AND user_id = ?')
        .get(loanId, req.user!.id) as { id: number } | undefined;
      if (!loan) { res.status(404).json({ error: 'Loan not found' }); return; }
      const { amount, date } = req.body as { amount: number; date: string };
      if (amount == null || !date) {
        res.status(400).json({ error: 'amount and date are required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO loan_special_payments (loan_id, amount, date) VALUES (?, ?, ?)')
        .run(loanId, amount, date);
      const row = db
        .prepare('SELECT * FROM loan_special_payments WHERE id = ?')
        .get(result.lastInsertRowid) as SpecialPaymentRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:loanId/special-payments/:spId', (req: Request, res: Response) => {
    try {
      const loanId = parseInt(req.params.loanId, 10);
      const spId = parseInt(req.params.spId, 10);
      const loan = db
        .prepare('SELECT id FROM loans WHERE id = ? AND user_id = ?')
        .get(loanId, req.user!.id) as { id: number } | undefined;
      if (!loan) { res.status(404).json({ error: 'Loan not found' }); return; }
      const existing = db
        .prepare('SELECT id FROM loan_special_payments WHERE id = ? AND loan_id = ?')
        .get(spId, loanId) as { id: number } | undefined;
      if (!existing) { res.status(404).json({ error: 'Special payment not found' }); return; }
      db.prepare('DELETE FROM loan_special_payments WHERE id = ?').run(spId);
      res.json({ message: 'Special payment deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
