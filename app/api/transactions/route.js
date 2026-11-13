import { handle, cleanTx, createWithSeq, ensurePerson } from '@/lib/api';
import { Transaction } from '@/lib/models';

export const POST = handle(async (req, _c, uid) => {
  const b = cleanTx(await req.json());
  const t = await createWithSeq(Transaction, uid, 'T', 'tid', b);
  await ensurePerson(uid, b.name);
  return t.toObject();
});
