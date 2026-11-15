import { handle } from '@/lib/api';
import { applyLoanPayment, applyPayment } from '@/lib/payments';
import { paymentsDb } from '@/lib/paymentsDb';

// New: { person, amount, date, time, notes, requestId } -> spread over the person's loans, oldest first.
// Older app versions (a phone with a cached page) still send { tid, ... } one loan at a time: kept working.
export const POST = handle(async (req, _c, uid) => {
  const b = await req.json();
  if (b.person !== undefined || b.tid === undefined) return applyPayment(paymentsDb, { uid, ...b });
  return applyLoanPayment(paymentsDb, { uid, ...b });
});
