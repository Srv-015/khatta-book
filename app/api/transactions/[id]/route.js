import { handle, HttpError, cleanTx, ensurePerson } from '@/lib/api';
import { round2 } from '@/lib/calc';
import { Transaction, Repayment, Person } from '@/lib/models';

export const PUT = handle(async (req, { params }, uid) => {
  const t = await Transaction.findOne({ _id: params.id, userId: uid });
  if (!t) throw new HttpError('Transaction not found', 404);
  const b = cleanTx(await req.json());
  const paid = round2((await Repayment.find({ userId: uid, tid: t.tid }).lean()).reduce((a, r) => a + r.amount, 0));
  if (b.amount < paid) throw new HttpError(`Amount cannot be less than what is already repaid (₹${paid})`);
  const old = t.name;
  t.set(b);
  await t.save();
  // Renaming: carry the contact over instead of leaving an empty person behind.
  if (old !== b.name) {
    const stillUsed = await Transaction.exists({ userId: uid, name: old });
    const newExists = await Person.exists({ userId: uid, name: b.name });
    if (!stillUsed && !newExists) await Person.updateOne({ userId: uid, name: old }, { $set: { name: b.name } });
    else if (!stillUsed) await Person.deleteOne({ userId: uid, name: old });
  }
  await ensurePerson(uid, b.name);
  return { ok: true };
});

export const DELETE = handle(async (_req, { params }, uid) => {
  const t = await Transaction.findOneAndDelete({ _id: params.id, userId: uid });
  if (!t) throw new HttpError('Transaction not found', 404);
  await Repayment.deleteMany({ userId: uid, tid: t.tid });
  return { ok: true };
});
