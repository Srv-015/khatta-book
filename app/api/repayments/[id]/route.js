import { handle } from '@/lib/api';
import { removePayment } from '@/lib/payments';
import { paymentsDb } from '@/lib/paymentsDb';

// Deleting one row of a multi-loan payment removes the whole payment, atomically.
export const DELETE = handle(async (_req, { params }, uid) => removePayment(paymentsDb, { uid, id: params.id }));
