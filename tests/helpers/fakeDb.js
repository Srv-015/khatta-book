// A stand-in for MongoDB used ONLY by the tests (never a real database). It mimics what the payment
// code relies on from a replica set: snapshot reads inside a transaction, all-or-nothing commits,
// write conflicts between overlapping transactions with automatic retry (like session.withTransaction),
// unique indexes on rid and (reqId, tid), and injectable failures.
const clone = (x) => JSON.parse(JSON.stringify(x));

export class TransientError extends Error {
  constructor(message) { super(message); this.name = 'TransientTransactionError'; this.transient = true; }
}
const dupError = (index) => {
  const e = new Error(`E11000 duplicate key error collection: khatta.repayments index: ${index} dup key`);
  e.code = 11000;
  return e;
};

export function mulberry32(seed) { // small seeded random generator: a failing race can be replayed
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createFakeDb({ loans = [], repayments = [], counters = {}, rng = Math.random } = {}) {
  const db = {
    committed: { loans: clone(loans), rps: clone(repayments), counters: clone(counters), version: 0, counterVer: {}, rowVer: {}, loanVer: {} },
    failures: {},               // insertAfter: n | commit: true | afterCommit: true
    stats: { commits: 0, conflicts: 0, aborts: 0 },
    idSeq: 0,
  };
  const jitter = async () => { for (let i = Math.floor(rng() * 4); i > 0; i--) await new Promise((r) => setImmediate(r)); };

  function makeTx(snap, w) {
    const mine = (uid) => (r) => r.userId === uid;
    return {
      async findByRequest(uid, reqId) { await jitter(); return clone(snap.rps.filter((r) => r.userId === uid && r.reqId === reqId)); },
      async loadPerson(uid, person) {
        await jitter();
        const txs = snap.loans.filter((l) => l.userId === uid && l.name === person);
        const ids = new Set(txs.map((l) => l.tid));
        return clone({ txs, rps: snap.rps.filter((r) => r.userId === uid && ids.has(r.tid)) });
      },
      async loadLoan(uid, tid) {
        await jitter();
        const tx = snap.loans.find((l) => l.userId === uid && l.tid === tid) || null;
        return clone({ tx, rps: snap.rps.filter((r) => r.userId === uid && r.tid === tid) });
      },
      async reserveSeq(uid, n) {
        await jitter();
        const key = `rp:${uid}`;
        const floor = Math.max(0, ...snap.rps.filter(mine(uid)).map((r) => r.seq || 0));
        const value = Math.max(snap.counters[key] || 0, floor) + n;
        snap.counters[key] = value;
        w.counters.add(key); // this write is what makes overlapping payments conflict
        return value - n + 1;
      },
      async insertRows(rows) {
        await jitter();
        let done = 0;
        for (const r of rows) {
          if (db.failures.insertAfter !== undefined && done >= db.failures.insertAfter) throw new Error('connection lost');
          if (snap.rps.some((x) => x.userId === r.userId && x.rid === r.rid)) throw dupError('userId_1_rid_1');
          if (r.reqId && snap.rps.some((x) => x.userId === r.userId && x.reqId === r.reqId && x.tid === r.tid)) throw dupError('userId_1_reqId_1_tid_1');
          const row = { ...clone(r), _id: `row${++db.idSeq}` };
          snap.rps.push(row);
          w.inserted.push(row);
          done++;
        }
      },
      async findRepaymentById(uid, id) { await jitter(); return clone(snap.rps.find((r) => r.userId === uid && r._id === id) || null); },
      async findByPayId(uid, payId) { await jitter(); return clone(snap.rps.filter((r) => r.userId === uid && r.payId === payId)); },
      async loanNames(uid, tids) { await jitter(); return Object.fromEntries(snap.loans.filter((l) => l.userId === uid && tids.includes(l.tid)).map((l) => [l.tid, l.name])); },
      async deleteRepayments(uid, ids) {
        await jitter();
        for (const id of ids) { w.deletedRows.add(id); }
        snap.rps = snap.rps.filter((r) => !(r.userId === uid && ids.includes(r._id)));
      },
      async findLoanById(uid, id) { await jitter(); return clone(snap.loans.find((l) => l.userId === uid && l._id === id) || null); },
      async deleteLoan(uid, id) { await jitter(); w.deletedLoans.add(id); snap.loans = snap.loans.filter((l) => !(l.userId === uid && l._id === id)); },
      async deleteRepaymentsForLoan(uid, tid) {
        await jitter();
        for (const r of snap.rps.filter((x) => x.userId === uid && x.tid === tid)) w.deletedRows.add(r._id);
        snap.rps = snap.rps.filter((r) => !(r.userId === uid && r.tid === tid));
      },
    };
  }

  function commit(snap, w, start) {
    const c = db.committed;
    if (db.failures.commit) throw new Error('commit failed'); // nothing applied
    for (const k of w.counters) if ((c.counterVer[k] || 0) > start) throw new TransientError('WriteConflict');
    for (const id of w.deletedRows) if ((c.rowVer[id] || 0) > start) throw new TransientError('WriteConflict');
    for (const id of w.deletedLoans) if ((c.loanVer[id] || 0) > start) throw new TransientError('WriteConflict');
    for (const r of w.inserted) {
      if (c.rps.some((x) => x.userId === r.userId && (x.rid === r.rid || (r.reqId && x.reqId === r.reqId && x.tid === r.tid)))) throw new TransientError('WriteConflict');
    }
    const version = ++c.version;
    for (const k of w.counters) { c.counters[k] = snap.counters[k]; c.counterVer[k] = version; }
    for (const id of w.deletedRows) { c.rps = c.rps.filter((r) => r._id !== id); c.rowVer[id] = version; }
    for (const id of w.deletedLoans) { c.loans = c.loans.filter((l) => l._id !== id); c.loanVer[id] = version; }
    for (const r of w.inserted) { c.rps.push(clone(r)); c.rowVer[r._id] = version; }
    db.stats.commits++;
    if (db.failures.afterCommit) throw new Error('connection lost after commit'); // applied, but the caller never hears
  }

  // Like session.withTransaction: re-runs the callback on transient conflicts, aborts (drops everything) on other errors.
  db.transaction = async (fn) => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const c = db.committed;
      const snap = { loans: clone(c.loans), rps: clone(c.rps), counters: clone(c.counters) };
      const start = c.version;
      const w = { inserted: [], deletedRows: new Set(), deletedLoans: new Set(), counters: new Set() };
      try {
        const out = await fn(makeTx(snap, w));
        commit(snap, w, start);
        return out;
      } catch (e) {
        if (e.transient) { db.stats.conflicts++; await jitter(); continue; }
        db.stats.aborts++;
        throw e;
      }
    }
    throw new Error('too many transaction retries');
  };

  db.rows = () => clone(db.committed.rps);
  db.loans = () => clone(db.committed.loans);
  return db;
}
