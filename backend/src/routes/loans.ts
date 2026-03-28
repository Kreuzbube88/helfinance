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
      const { name, principal, interest_rate_pct, start_date, term_months, category_id, loan_type, interest_rate_dynamic } =
        req.body as {
          name: string;
          principal: number;
          interest_rate_pct: number;
          start_date: string;
          term_months: number;
          category_id?: number;
          loan_type?: 'annuity' | 'real_estate';
          interest_rate_dynamic?: boolean;
        };

      if (!name || principal == null || interest_rate_pct == null || !start_date || !term_months) {
        res.status(400).json({ error: 'name, principal, interest_rate_pct, start_date, term_months are required' });
        return;
      }

      const monthly_rate = calcLoanMonthlyRate(principal, interest_rate_pct, term_months);

      const result = db
        .prepare(
          'INSERT INTO loans (user_id, name, principal, interest_rate_pct, start_date, term_months, monthly_rate, category_id, loan_type, interest_rate_dynamic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.user!.id,
          name,
          principal,
          interest_rate_pct,
          start_date,
          term_months,
          monthly_rate,
          category_id ?? null,
          loan_type ?? 'annuity',
          interest_rate_dynamic ? 1 : 0
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

      const { name, principal, interest_rate_pct, start_date, term_months, category_id, loan_type, interest_rate_dynamic } =
        req.body as {
          name?: string;
          principal?: number;
          interest_rate_pct?: number;
          start_date?: string;
          term_months?: number;
          category_id?: number;
          loan_type?: 'annuity' | 'real_estate';
          interest_rate_dynamic?: boolean;
        };

      const newPrincipal = principal ?? existing.principal;
      const newRate = interest_rate_pct ?? existing.interest_rate_pct;
      const newTerm = term_months ?? existing.term_months;
      const monthly_rate = calcLoanMonthlyRate(newPrincipal, newRate, newTerm);

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
          interest_rate_dynamic = COALESCE(?, interest_rate_dynamic)
        WHERE id = ?`
      ).run(
        name ?? null,
        newPrincipal,
        newRate,
        start_date ?? null,
        newTerm,
        monthly_rate,
        category_id ?? null,
        loan_type ?? null,
        interest_rate_dynamic != null ? (interest_rate_dynamic ? 1 : 0) : null,
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
