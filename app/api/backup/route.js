import { handle, HttpError } from '@/lib/api';
import { Person, Transaction, Repayment } from '@/lib/models';

const strip = ({ _id, userId, __v, createdAt, updatedAt, ...r }) => r;

export const GET = handle(async (_req, _ctx, uid) => {
  const [people, transactions, repayments] = await Promise.all([
    Person.find({ userId: uid }).lean(),
    Transaction.find({ userId: uid }).sort({ seq: 1 }).lean(),
    Repayment.find({ userId: uid }).sort({ seq: 1 }).lean(),
  ]);
  const body = JSON.stringify({
    app: 'khatta-book', version: 1, exportedAt: new Date().toISOString(),
    people: people.map(strip), transactions: transactions.map(strip), repayments: repayments.map(strip),
  }, null, 1);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="khatta-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

// Restore: replaces this user's data with the backup file's contents.
export const POST = handle(async (req, _c, uid) => {
  const b = await req.json();
  if (b.app !== 'khatta-book' || !Array.isArray(b.transactions) || !Array.isArray(b.repayments))
    throw new HttpError('This is not a Khatta Book backup file');
  const add = (a) => (a || []).map((x) => ({ ...x, userId: uid }));
  await Promise.all([Person.deleteMany({ userId: uid }), Transaction.deleteMany({ userId: uid }), Repayment.deleteMany({ userId: uid })]);
  await Person.insertMany(add(b.people));
  await Transaction.insertMany(add(b.transactions));
  await Repayment.insertMany(add(b.repayments));
  return { ok: true };
});
