import { handle, HttpError } from '@/lib/api';
import { Person } from '@/lib/models';

export const PUT = handle(async (req, _c, uid) => {
  const b = await req.json();
  const name = String(b.name || '').trim();
  if (!name) throw new HttpError('Name is required');
  await Person.updateOne({ userId: uid, name }, { $set: { phone: String(b.phone || '').trim() } }, { upsert: true });
  return { ok: true };
});
