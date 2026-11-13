import { handle, HttpError, createWithSeq } from '@/lib/api';
import { isValidDate, round2 } from '@/lib/calc';
import { Transaction, Repayment } from '@/lib/models';

export const POST = handle(async (req, _c, uid) => {
  const b = await req.json();
  const amount = round2(Number(b.amount));
  if (!(amount > 0)) throw new HttpError('Amount must be greater than 0');
  if (!isValidDate(b.date)) throw new HttpError('Repayment date is required');
  const t = await Transaction.findOne({ userId: uid, tid: b.tid });
  if (!t) throw new HttpError('Choose a transaction');
  if (b.date < t.date) throw new HttpError('Repayment date cannot be before the transaction date');
  const paid = round2((await Repayment.find({ userId: uid, tid: t.tid }).lean()).reduce((a, r) => a + r.amount, 0));
  const balance = round2(t.amount - paid);
  if (amount > balance) throw new HttpError(`More than the remaining balance (₹${balance})`);
  const r = await createWithSeq(Repayment, uid, 'R', 'rid', {
    tid: t.tid, amount, date: b.date, time: /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '', notes: String(b.notes || '').trim(),
  });
  return r.toObject();
});
