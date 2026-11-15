// Person-level repayments: one payment is spread over the person's open loans, oldest first (FIFO).
// Pure logic (no database imports) so the browser and the server use exactly the same rules.
// Storage stays backward compatible: every allocation is an ordinary repayment row linked to one
// loan (tid), so balances, exports, backups and older records keep working unchanged. Rows created
// by one payment share a payId; older rows have no payId and count as a payment of their own.
import { enrich, isValidDate, round2 } from './calc';

export class PaymentError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'PaymentError'; this.status = status; }
}

const paise = (n) => Math.round((Number(n) + Number.EPSILON) * 100); // integer maths: no float drift
const rupees = (p) => p / 100;
const pad = (p, n) => `${p}-${String(n).padStart(4, '0')}`;
const stampOf = (t) => `${t.date || ''} ${t.time || ''}`;

// Oldest loan first: loan date + time, then the order it was entered.
export const fifoOrder = (loans) =>
  [...loans].sort((a, b) => stampOf(a).localeCompare(stampOf(b)) || (a.seq || 0) - (b.seq || 0) || String(a.tid).localeCompare(String(b.tid)));

// Loans of one person that still owe money (pending, partially paid or overdue), oldest first.
export const openLoans = (enriched, name) => fifoOrder(enriched.filter((t) => t.name === name && t.balance > 0));
export const outstandingOf = (loans) => rupees(loans.reduce((a, t) => a + (t.balance > 0 ? paise(t.balance) : 0), 0));

// Spreads `amount` over the loans, oldest first. Returns the rows to write and anything left over.
export function allocateFifo(loans, amount) {
  let left = paise(amount);
  const allocations = [];
  for (const l of fifoOrder(loans)) {
    if (left <= 0) break;
    const bal = paise(l.balance);
    if (bal <= 0) continue;
    const take = Math.min(bal, left);
    allocations.push({ tid: l.tid, amount: rupees(take), settles: take === bal, balanceAfter: rupees(bal - take) });
    left -= take;
  }
  return { allocations, unallocated: rupees(left) };
}

// Repayment rows -> payments (newest first). Rows of one payId are one payment; rows without a
// payId (saved before this feature) are payments of their own. Split per person for safety.
export function groupPayments(rp, tx) {
  const nameOf = Object.fromEntries(tx.map((t) => [t.tid, t.name]));
  const map = new Map();
  for (const r of rp) {
    const person = nameOf[r.tid] || '';
    const key = `${r.payId || r.rid}|${person}`;
    let g = map.get(key);
    if (!g) {
      g = { key, id: r.payId || r.rid, person, amount: 0, date: r.date, time: r.time || '', notes: '', rows: [], allocations: [] };
      map.set(key, g);
    }
    g.amount = round2(g.amount + r.amount);
    g.rows.push(r);
    g.allocations.push({ tid: r.tid, amount: r.amount });
    if (!g.notes && r.notes) g.notes = String(r.notes).trim();
  }
  return [...map.values()].sort((a, b) => stampOf(b).localeCompare(stampOf(a)) || String(b.id).localeCompare(String(a.id)));
}

// Every row that belongs to the same payment as `row`.
export const paymentRows = (rp, row) => (row.payId ? rp.filter((r) => r.payId === row.payId) : [row]);

function dupKind(e) {
  const codes = [e?.code, ...(e?.writeErrors || []).map((w) => w.code ?? w.err?.code)];
  if (!codes.includes(11000)) return '';
  const text = [e.message, e.errmsg, ...(e.writeErrors || []).map((w) => w.errmsg || w.err?.errmsg)].join(' ');
  if (/reqId/.test(text)) return 'reqId';
  if (/rid/.test(text)) return 'rid';
  return 'other';
}

// What a repeated request gets back: the original payment, but only if it really is the same payment.
async function replay(t, uid, prior, person, amount) {
  const { txs, rps } = await t.loadPerson(uid, person);
  const tids = new Set(txs.map((x) => x.tid));
  const total = round2(prior.reduce((a, r) => a + r.amount, 0));
  if (paise(total) !== paise(amount) || !prior.every((r) => tids.has(r.tid))) {
    throw new PaymentError('This request id was already used for a different payment. Please try again.', 409);
  }
  return {
    payId: prior[0].payId || prior[0].rid, total, duplicate: true,
    remaining: outstandingOf(openLoans(enrich(txs, rps), person)),
    allocations: prior.map((r) => ({ tid: r.tid, amount: r.amount })),
  };
}

/**
 * Records one payment for a person, spread over their open loans oldest first.
 *
 * Everything (duplicate check, reading balances, reserving numbers, writing every row) happens inside
 * ONE database transaction, so a payment is saved completely or not at all. Concurrent payments are
 * serialised: reserveSeq() updates a shared counter document, so two overlapping transactions
 * conflict and the database retries the loser against the winner's committed data.
 *
 *  db = { transaction(fn) }                       fn receives t = {
 *    findByRequest(uid, reqId), loadPerson(uid, person) -> {txs, rps},
 *    reserveSeq(uid, n) -> first of n consecutive numbers, insertRows(rows) }
 */
export async function applyPayment(db, input) {
  const uid = input.uid;
  const person = String(input.person || '').trim();
  const amount = round2(Number(input.amount));
  const date = input.date;
  const time = /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : '';
  const notes = String(input.notes || '').trim().slice(0, 1000);
  const requestId = input.requestId ? String(input.requestId).slice(0, 100) : '';

  if (!person) throw new PaymentError('Choose a person');
  if (!(amount > 0)) throw new PaymentError('Amount must be greater than 0');
  if (!isValidDate(date)) throw new PaymentError('Repayment date is required');

  for (let pass = 0; ; pass++) {
    try {
      return await db.transaction(async (t) => {
        if (requestId) {
          const prior = await t.findByRequest(uid, requestId);
          if (prior.length) return replay(t, uid, prior, person, amount);
        }
        const { txs, rps } = await t.loadPerson(uid, person);
        if (!txs.length) throw new PaymentError('No loans found for this person', 404);
        const loans = openLoans(enrich(txs, rps), person);
        const outstanding = outstandingOf(loans);
        if (outstanding <= 0) throw new PaymentError('This person has nothing outstanding');
        if (paise(amount) > paise(outstanding)) throw new PaymentError(`More than the total outstanding balance (₹${outstanding})`);

        const { allocations } = allocateFifo(loans, amount);
        const byTid = Object.fromEntries(loans.map((l) => [l.tid, l]));
        for (const a of allocations) {
          if (date < byTid[a.tid].date) throw new PaymentError(`Repayment date cannot be before the loan date (${a.tid} was given on ${byTid[a.tid].date})`);
        }

        const seq0 = await t.reserveSeq(uid, allocations.length);
        const payId = pad('R', seq0);
        await t.insertRows(allocations.map((a, i) => ({
          userId: uid, seq: seq0 + i, rid: pad('R', seq0 + i), payId, tid: a.tid, amount: a.amount, date, time, notes,
          ...(requestId ? { reqId: requestId } : {}),
        })));
        return {
          payId, total: amount, duplicate: false, remaining: rupees(paise(outstanding) - paise(amount)),
          allocations: allocations.map(({ tid, amount: x, settles }) => ({ tid, amount: x, settles })),
        };
      });
    } catch (e) {
      // the unique index caught a twin of this request: run once more, the duplicate check will now find it
      if (requestId && dupKind(e) === 'reqId' && pass === 0) continue;
      throw e;
    }
  }
}

/** Older app versions send one loan at a time ({ tid, amount, ... }). Same safety rules, single loan. */
export async function applyLoanPayment(db, input) {
  const uid = input.uid;
  const amount = round2(Number(input.amount));
  const time = /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : '';
  if (!(amount > 0)) throw new PaymentError('Amount must be greater than 0');
  if (!isValidDate(input.date)) throw new PaymentError('Repayment date is required');
  return db.transaction(async (t) => {
    const { tx, rps } = await t.loadLoan(uid, input.tid);
    if (!tx) throw new PaymentError('Choose a transaction');
    if (input.date < tx.date) throw new PaymentError('Repayment date cannot be before the transaction date');
    const balance = enrich([tx], rps)[0].balance;
    if (paise(amount) > paise(balance)) throw new PaymentError(`More than the remaining balance (₹${balance})`);
    const seq = await t.reserveSeq(uid, 1);
    const row = { userId: uid, seq, rid: pad('R', seq), tid: tx.tid, amount, date: input.date, time, notes: String(input.notes || '').trim() };
    await t.insertRows([row]);
    return row;
  });
}

/**
 * Deletes a payment. A multi-loan payment is removed as a whole (all its rows, for the person the row
 * belongs to), in one transaction, so a payment is never left half-applied.
 *  t = { findRepaymentById(uid, id), findByPayId(uid, payId), loanNames(uid, tids) -> {tid: name}, deleteRepayments(uid, ids) }
 */
export async function removePayment(db, { uid, id }) {
  return db.transaction(async (t) => {
    const row = await t.findRepaymentById(uid, id);
    if (!row) throw new PaymentError('Repayment not found', 404);
    if (!row.payId) {
      await t.deleteRepayments(uid, [row._id]);
      return { ok: true, removed: 1 };
    }
    const rows = await t.findByPayId(uid, row.payId);
    const names = await t.loanNames(uid, rows.map((r) => r.tid));
    const person = names[row.tid];
    const doomed = rows.filter((r) => names[r.tid] === person);
    await t.deleteRepayments(uid, doomed.map((r) => r._id));
    return { ok: true, removed: doomed.length };
  });
}

/** Deletes a loan together with the repayment rows applied to it, atomically. t = { findLoanById, deleteLoan, deleteRepaymentsForLoan } */
export async function removeLoan(db, { uid, id }) {
  return db.transaction(async (t) => {
    const loan = await t.findLoanById(uid, id);
    if (!loan) throw new PaymentError('Transaction not found', 404);
    await t.deleteLoan(uid, loan._id);
    await t.deleteRepaymentsForLoan(uid, loan.tid);
    return { ok: true };
  });
}

/* ---------- export / import helpers ---------- */

// Full total and row count of every payment (keyed by payId, or by rid for older rows). Used so a
// partial export (selected loans, date range) can still show what the whole payment was.
export function paymentTotals(rp) {
  const m = new Map();
  for (const r of rp) {
    const k = r.payId || r.rid;
    const g = m.get(k) || { total: 0, count: 0 };
    g.total = round2(g.total + r.amount);
    g.count++;
    m.set(k, g);
  }
  return m;
}

const sigOf = (r, nameOf) => `${nameOf[r.tid] || ''}|${r.date || ''}|${r.time || ''}|${String(r.notes || '').trim()}`;

/**
 * Imported rows may carry a Payment ID that already means something else in this database
 * (another payment's id, or the rid of a single older repayment). Such rows would silently merge into
 * that payment and be deleted with it. rows = rows about to be created, existing = rows already stored,
 * nameOf = { tid: person }. Returns { keep: Map rid -> payId ('' = not a split payment), collisions: [payId] }.
 * A payId that matches stored rows of the SAME payment (same person, date, time, notes) is not a collision.
 */
export function planImportedPayIds(rows, existing, nameOf) {
  const inFile = new Map(); // payId -> rows carrying it
  for (const r of rows) if (r.payId) inFile.set(r.payId, [...(inFile.get(r.payId) || []), r]);
  // The FIRST row of a split payment has a Payment ID equal to its own repayment id, exactly like an older
  // single repayment in an export. It is part of a split payment only if something shows it is: other rows
  // in the file, stored rows, or a Payment Total bigger than its own amount.
  const grouped = (r) => {
    if (!r.payId) return false;
    if (r.payId !== r.rid) return true;
    return inFile.get(r.payId).length > 1 || Number(r.payTotal) > r.amount + 0.001 || existing.some((x) => x.payId === r.payId && x.rid !== r.rid);
  };
  const keep = new Map();
  const groups = new Map();
  for (const r of rows) {
    const pid = grouped(r) ? r.payId : '';
    keep.set(r.rid, pid);
    if (pid) groups.set(pid, [...(groups.get(pid) || []), r]);
  }
  const collisions = [];
  for (const [pid, g] of groups) {
    const groupRids = new Set(g.map((r) => r.rid));
    const stored = existing.filter((x) => (x.payId === pid || (!x.payId && x.rid === pid)) && !groupRids.has(x.rid));
    const sibling = rows.some((x) => x.rid === pid && !groupRids.has(x.rid)); // another imported repayment owns that id
    if (!stored.length && !sibling) continue;
    const sig = new Set(g.map((r) => sigOf(r, nameOf)));
    const same = !sibling && sig.size === 1 && stored.every((x) => sig.has(sigOf(x, nameOf)));
    if (!same) collisions.push(pid);
  }
  return { keep, collisions };
}

// freshIds[i] replaces plan.collisions[i]. Returns Map rid -> final payId.
export function remapImportedPayIds(plan, freshIds) {
  const swap = new Map(plan.collisions.map((p, i) => [p, freshIds[i]]));
  const out = new Map();
  for (const [rid, pid] of plan.keep) out.set(rid, swap.get(pid) ?? pid);
  return out;
}
