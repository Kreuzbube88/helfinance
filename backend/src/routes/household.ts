import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import { sendEmail } from '../services/emailService';
import { calcHouseholdBalance, SharedExpenseRecord } from '../services/financeCalc';

interface HouseholdLinkRow {
  id: number;
  user_a_id: number;
  user_b_id: number;
  status: string;
  invited_by: number;
}

interface SharedExpenseRow {
  id: number;
  household_link_id: number;
  expense_id: number;
  split_ratio_a: number;
  split_ratio_b: number;
  paid_by_user_id: number;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
}

interface ExpenseRow {
  id: number;
  amount: number;
}

export function createHouseholdRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  function getUserLink(userId: number): HouseholdLinkRow | undefined {
    return db
      .prepare(
        'SELECT * FROM household_links WHERE (user_a_id = ? OR user_b_id = ?) AND status IN (\'pending\',\'active\')'
      )
      .get(userId, userId) as HouseholdLinkRow | undefined;
  }

  router.get('/', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link) {
        res.json({ linked: false });
        return;
      }
      const partnerId = link.user_a_id === req.user!.id ? link.user_b_id : link.user_a_id;
      const partner = db
        .prepare('SELECT id, username, email FROM users WHERE id = ?')
        .get(partnerId) as UserRow | undefined;
      res.json({ linked: true, link, partner });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/invite', async (req: Request, res: Response) => {
    try {
      const { username, email } = req.body as { username?: string; email?: string };
      if (!username && !email) {
        res.status(400).json({ error: 'username or email required' });
        return;
      }

      const existingLink = getUserLink(req.user!.id);
      if (existingLink) {
        res.status(409).json({ error: 'Already linked to a household' });
        return;
      }

      let target: UserRow | undefined;
      if (username) {
        target = db.prepare('SELECT id, username, email FROM users WHERE username = ?').get(username) as UserRow | undefined;
      } else if (email) {
        target = db.prepare('SELECT id, username, email FROM users WHERE email = ?').get(email) as UserRow | undefined;
      }

      if (!target) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (target.id === req.user!.id) {
        res.status(400).json({ error: 'Cannot invite yourself' });
        return;
      }

      const result = db
        .prepare(
          'INSERT INTO household_links (user_a_id, user_b_id, status, invited_by) VALUES (?, ?, \'pending\', ?)'
        )
        .run(req.user!.id, target.id, req.user!.id);

      const linkId = result.lastInsertRowid as number;

      db.prepare(
        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)'
      ).run(
        target.id,
        'household_invite',
        'Household Invitation',
        `${req.user!.username} has invited you to join their household. Link ID: ${linkId}`
      );

      await sendEmail(
        db,
        target.email,
        'HELFINANCE Household Invitation',
        `<p>${req.user!.username} has invited you to join their household on HELFINANCE.</p>`
      );

      res.status(201).json({ message: 'Invitation sent', link_id: linkId });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/confirm/:id', (req: Request, res: Response) => {
    try {
      const linkId = parseInt(req.params.id, 10);
      const link = db
        .prepare('SELECT * FROM household_links WHERE id = ? AND user_b_id = ? AND status = \'pending\'')
        .get(linkId, req.user!.id) as HouseholdLinkRow | undefined;
      if (!link) {
        res.status(404).json({ error: 'Pending invitation not found' });
        return;
      }
      db.prepare('UPDATE household_links SET status = \'active\' WHERE id = ?').run(linkId);
      res.json({ message: 'Household link confirmed' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link) {
        res.status(404).json({ error: 'No household link found' });
        return;
      }
      db.prepare('DELETE FROM household_links WHERE id = ?').run(link.id);
      res.json({ message: 'Household link removed' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/shared-expenses', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link || link.status !== 'active') {
        res.status(400).json({ error: 'No active household link' });
        return;
      }
      const rows = db
        .prepare('SELECT * FROM shared_expenses WHERE household_link_id = ?')
        .all(link.id) as SharedExpenseRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/shared-expenses', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link || link.status !== 'active') {
        res.status(400).json({ error: 'No active household link' });
        return;
      }
      const { expense_id, split_ratio_a, split_ratio_b, paid_by_user_id } = req.body as {
        expense_id: number;
        split_ratio_a?: number;
        split_ratio_b?: number;
        paid_by_user_id: number;
      };
      if (!expense_id || !paid_by_user_id) {
        res.status(400).json({ error: 'expense_id and paid_by_user_id are required' });
        return;
      }
      const result = db
        .prepare(
          'INSERT INTO shared_expenses (household_link_id, expense_id, split_ratio_a, split_ratio_b, paid_by_user_id) VALUES (?, ?, ?, ?, ?)'
        )
        .run(link.id, expense_id, split_ratio_a ?? 0.5, split_ratio_b ?? 0.5, paid_by_user_id);
      const row = db
        .prepare('SELECT * FROM shared_expenses WHERE id = ?')
        .get(result.lastInsertRowid) as SharedExpenseRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/shared-expenses/:id', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link || link.status !== 'active') {
        res.status(400).json({ error: 'No active household link' });
        return;
      }
      const seId = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM shared_expenses WHERE id = ? AND household_link_id = ?')
        .get(seId, link.id) as SharedExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Shared expense not found' });
        return;
      }
      const { split_ratio_a, split_ratio_b, paid_by_user_id } = req.body as {
        split_ratio_a?: number;
        split_ratio_b?: number;
        paid_by_user_id?: number;
      };
      db.prepare(
        `UPDATE shared_expenses SET
          split_ratio_a = COALESCE(?, split_ratio_a),
          split_ratio_b = COALESCE(?, split_ratio_b),
          paid_by_user_id = COALESCE(?, paid_by_user_id)
        WHERE id = ?`
      ).run(split_ratio_a ?? null, split_ratio_b ?? null, paid_by_user_id ?? null, seId);
      const updated = db.prepare('SELECT * FROM shared_expenses WHERE id = ?').get(seId) as SharedExpenseRow;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/shared-expenses/:id', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link || link.status !== 'active') {
        res.status(400).json({ error: 'No active household link' });
        return;
      }
      const seId = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM shared_expenses WHERE id = ? AND household_link_id = ?')
        .get(seId, link.id) as SharedExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Shared expense not found' });
        return;
      }
      db.prepare('DELETE FROM shared_expenses WHERE id = ?').run(seId);
      res.json({ message: 'Shared expense removed' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/balance', (req: Request, res: Response) => {
    try {
      const link = getUserLink(req.user!.id);
      if (!link || link.status !== 'active') {
        res.status(400).json({ error: 'No active household link' });
        return;
      }

      const sharedRows = db
        .prepare('SELECT * FROM shared_expenses WHERE household_link_id = ?')
        .all(link.id) as SharedExpenseRow[];

      const enriched: SharedExpenseRecord[] = sharedRows.map((se) => {
        const expense = db
          .prepare('SELECT amount FROM expenses WHERE id = ?')
          .get(se.expense_id) as ExpenseRow | undefined;
        return {
          expense_id: se.expense_id,
          split_ratio_a: se.split_ratio_a,
          split_ratio_b: se.split_ratio_b,
          paid_by_user_id: se.paid_by_user_id,
          amount: expense?.amount ?? 0,
          user_a_id: link.user_a_id,
        };
      });

      const balance = calcHouseholdBalance(enriched);
      res.json(balance);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
