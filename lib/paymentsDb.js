// MongoDB side of the payment logic in lib/payments.js. Server only.
// Every payment / delete runs inside one MongoDB transaction (needs a replica set: MongoDB Atlas, or a
// local replica set). The driver retries the whole callback on transient conflicts, so overlapping
// payments are serialised and each retry sees the other one's committed result.
import mongoose from 'mongoose';
import { PaymentError } from './payments';
import { Transaction, Repayment, RepayCounter } from './models';

const TX_OPTIONS = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
const counterKey = (uid) => `rp:${uid}`;

// First of `n` consecutive repayment numbers for this user. The counter is raised to the highest
// number already stored (older rows, imports) before incrementing, so a number is never handed out twice.
// With a session, the counter write also makes concurrent payment transactions conflict, which serialises them.
export async function reserveRepaymentSeq(uid, n, session) {
  const last = await Repayment.findOne({ userId: uid }).sort({ seq: -1 }).select('seq').session(session || null).lean();
  await RepayCounter.updateOne({ _id: counterKey(uid) }, { $max: { value: last?.seq || 0 } }, { upsert: true, session });
  const c = await RepayCounter.findOneAndUpdate({ _id: counterKey(uid) }, { $inc: { value: n } }, { new: true, session });
  return c.value - n + 1;
}

// Keeps the counter ahead of rows that were stored with their own numbers (import).
export const bumpRepaymentCounter = (uid, floor) =>
  RepayCounter.updateOne({ _id: counterKey(uid) }, { $max: { value: floor } }, { upsert: true });

function tx(session) {
  const find = (Model, filter) => Model.find(filter).session(session);
  return {
    findByRequest: (uid, reqId) => find(Repayment, { userId: uid, reqId }).sort({ seq: 1 }).lean(),
    async loadPerson(uid, person) {
      const txs = await find(Transaction, { userId: uid, name: person }).lean();
      const rps = txs.length ? await find(Repayment, { userId: uid, tid: { $in: txs.map((t) => t.tid) } }).lean() : [];
      return { txs, rps };
    },
    async loadLoan(uid, tid) {
      const loan = await Transaction.findOne({ userId: uid, tid }).session(session).lean();
      return { tx: loan, rps: loan ? await find(Repayment, { userId: uid, tid }).lean() : [] };
    },
    reserveSeq: (uid, n) => reserveRepaymentSeq(uid, n, session),
    insertRows: (rows) => Repayment.insertMany(rows, { session }),
    findRepaymentById: (uid, id) => Repayment.findOne({ _id: id, userId: uid }).session(session).lean(),
    findByPayId: (uid, payId) => find(Repayment, { userId: uid, payId }).lean(),
    async loanNames(uid, tids) {
      const loans = await find(Transaction, { userId: uid, tid: { $in: tids } }).lean();
      return Object.fromEntries(loans.map((l) => [l.tid, l.name]));
    },
    deleteRepayments: (uid, ids) => Repayment.deleteMany({ userId: uid, _id: { $in: ids } }, { session }),
    findLoanById: (uid, id) => Transaction.findOne({ _id: id, userId: uid }).session(session).lean(),
    deleteLoan: (uid, id) => Transaction.deleteOne({ _id: id, userId: uid }, { session }),
    deleteRepaymentsForLoan: (uid, tid) => Repayment.deleteMany({ userId: uid, tid }, { session }),
  };
}

export const paymentsDb = {
  async transaction(fn) {
    const session = await mongoose.startSession();
    try {
      let out;
      await session.withTransaction(async () => { out = await fn(tx(session)); }, TX_OPTIONS); // result captured: the driver may re-run fn
      return out;
    } catch (e) {
      if (e?.code === 20 || /replica set|Transaction numbers are only allowed/i.test(String(e?.message || ''))) {
        throw new PaymentError('Saving payments safely needs MongoDB with transactions (MongoDB Atlas or a replica set).', 503);
      }
      throw e;
    } finally {
      await session.endSession();
    }
  },
};
