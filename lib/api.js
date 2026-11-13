import dbConnect from './db';
import { currentUserId } from './auth';
import { Person } from './models';
import { computeDue, isValidDate, round2 } from './calc';

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Wraps a route: connects to the DB, requires login, turns thrown errors into JSON.
export const handle = (fn) => async (req, ctx) => {
  try {
    await dbConnect();
    const uid = await currentUserId();
    if (!uid) throw new HttpError('Unauthorized', 401);
    const out = await fn(req, ctx, uid);
    return out instanceof Response ? out : Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message || 'Server error' }, { status: e.status || 500 });
  }
};

export async function nextSeq(Model, uid) {
  const last = await Model.findOne({ userId: uid }).sort({ seq: -1 }).select('seq').lean();
  return (last?.seq || 0) + 1;
}
export const pad = (p, n) => `${p}-${String(n).padStart(4, '0')}`;
export const ensurePerson = (uid, name) =>
  Person.updateOne({ userId: uid, name }, { $setOnInsert: { phone: '' } }, { upsert: true });

// Creates a record with the next sequence number; retries if two requests picked the same one.
export async function createWithSeq(Model, uid, prefix, field, data) {
  for (let i = 0; ; i++) {
    const seq = await nextSeq(Model, uid);
    try {
      return await Model.create({ ...data, userId: uid, seq, [field]: pad(prefix, seq) });
    } catch (e) {
      if (e.code !== 11000 || i >= 4) throw e;
    }
  }
}

export function cleanTx(b) {
  const name = String(b.name || '').trim();
  const amount = round2(Number(b.amount));
  if (!name) throw new HttpError('Person’s name is required');
  if (!(amount > 0)) throw new HttpError('Amount must be greater than 0');
  if (!isValidDate(b.date)) throw new HttpError('Transaction date is required');
  let due;
  try {
    due = computeDue({
      duration: b.repayDuration ?? (b.dueDate ? 'others' : ''), // old clients sent only dueDate
      date: b.date, custom: b.dueCustom ?? b.dueDate, notes: b.dueNotes,
    });
  } catch (e) { throw new HttpError(e.message); }
  return {
    name, amount, date: b.date, time: /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '',
    reason: String(b.reason || '').trim(), notes: String(b.notes || '').trim(), ...due,
  };
}
