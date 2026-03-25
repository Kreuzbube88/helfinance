import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import { calcLoanMonthlyRate, generateAmortization } from '../services/financeCalc';

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
      const { name, principal, interest_rate_pct, start_date, term_months, category_id } =
        req.body as {
          name: string;
          principal: number;
          interest_rate_pct: number;
          start_date: string;
          term_months: number;
          category_id?: number;
        };

      if (!name || principal == null || interest_rate_pct == null || !start_date || !term_months) {
        res.status(400).json({ error: 'name, principal, interest_rate_pct, start_date, term_months are required' });
        return;
      }

      const monthly_rate = calcLoanMonthlyRate(principal, interest_rate_pct, term_months);

      const result = db
        .prepare(
          'INSERT INTO loans (user_id, name, principal, interest_rate_pct, start_date, term_months, monthly_rate, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.user!.id,
          name,
          principal,
          interest_rate_pct,
          start_date,
          term_months,
          monthly_rate,
          category_id ?? null
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

      const { name, principal, interest_rate_pct, start_date, term_months, category_id } =
        req.body as {
          name?: string;
          principal?: number;
          interest_rate_pct?: number;
          start_date?: string;
          term_months?: number;
          category_id?: number;
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
          category_id = COALESCE(?, category_id)
        WHERE id = ?`
      ).run(name ?? null, newPrincipal, newRate, start_date ?? null, newTerm, monthly_rate, category_id ?? null, id);

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
      const schedule = generateAmortization(
        loan.principal,
        loan.interest_rate_pct,
        loan.term_months,
        loan.start_date
      );
      res.json(schedule);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
