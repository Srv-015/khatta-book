import { handle, HttpError } from '@/lib/api';
import { Repayment } from '@/lib/models';

export const DELETE = handle(async (_req, { params }, uid) => {
  const r = await Repayment.findOneAndDelete({ _id: params.id, userId: uid });
  if (!r) throw new HttpError('Repayment not found', 404);
  return { ok: true };
});
