import { handle } from '@/lib/api';
import { Person, Transaction, Repayment } from '@/lib/models';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req, _ctx, uid) => {
  const [transactions, repayments, people] = await Promise.all([
    Transaction.find({ userId: uid }).sort({ seq: 1 }).lean(),
    Repayment.find({ userId: uid }).sort({ seq: 1 }).lean(),
    Person.find({ userId: uid }).sort({ name: 1 }).lean(),
  ]);
  return { transactions, repayments, people };
});
