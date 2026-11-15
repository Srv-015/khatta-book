import { describe, it, expect } from 'vitest';
import { enrich } from '../lib/calc';
import { applyLoanPayment, applyPayment, removeLoan, removePayment } from '../lib/payments';
import { createFakeDb, mulberry32 } from './helpers/fakeDb';
import { TODAY, day, fiveLoans, loan, payment } from './helpers/fixtures';

const newDb = (extra = {}) => createFakeDb({ loans: fiveLoans(), ...extra });
const balances = (db) => Object.fromEntries(enrich(db.loans(), db.rows()).map((l) => [l.tid, l.balance]));
const statuses = (db) => Object.fromEntries(enrich(db.loans(), db.rows()).map((l) => [l.tid, l.status]));
const totalPaid = (db) => db.rows().reduce((s, r) => s + r.amount, 0);
const dupError = (index) => Object.assign(new Error(`E11000 duplicate key error index: ${index} dup key`), { code: 11000 });

describe('person payment, FIFO across loans', () => {
  it('accepts ₹700 on ₹1,300, allocates oldest first and leaves ₹600', async () => {
    const db = newDb();
    const res = await applyPayment(db, payment({ amount: 700, requestId: 'q1', notes: ' cash ' }));
    expect(res.remaining).toBe(600);
    expect(res.duplicate).toBe(false);
    expect(res.allocations.map((a) => [a.tid, a.amount])).toEqual([['T-0001', 100], ['T-0002', 200], ['T-0003', 300], ['T-0004', 100]]);
    expect(balances(db)).toEqual({ 'T-0001': 0, 'T-0002': 0, 'T-0003': 0, 'T-0004': 300, 'T-0005': 300 });
    expect(statuses(db)['T-0004']).toBe('Partial');
    const rows = db.rows();
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.payId)).size).toBe(1);
    expect(rows.map((r) => r.rid)).toEqual(['R-0001', 'R-0002', 'R-0003', 'R-0004']);
    expect(rows.every((r) => r.date === TODAY && r.time === '12:00' && r.notes === 'cash' && r.reqId === 'q1')).toBe(true);
  });

  it('continues where the previous payment stopped and can settle everything', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700 }));
    const second = await applyPayment(db, payment({ amount: 450 }));
    expect(second.allocations.map((a) => [a.tid, a.amount, a.settles])).toEqual([['T-0004', 300, true], ['T-0005', 150, false]]);
    expect(second.remaining).toBe(150);
    expect((await applyPayment(db, payment({ amount: 150 }))).remaining).toBe(0);
    expect(Object.values(statuses(db)).every((s) => s === 'Settled')).toBe(true);
    await expect(applyPayment(db, payment({ amount: 1 }))).rejects.toThrow(/nothing outstanding/);
  });

  it('accepts exactly the total outstanding', async () => {
    const db = newDb();
    expect((await applyPayment(db, payment({ amount: 1300 }))).remaining).toBe(0);
    expect(db.rows()).toHaveLength(5);
  });

  it('respects older single-row repayments and leaves them untouched', async () => {
    const legacy = { _id: 'old1', userId: 'u1', rid: 'R-0001', seq: 1, tid: 'T-0001', amount: 40, date: day(45), time: '', notes: '' };
    const db = newDb({ repayments: [legacy] });
    const res = await applyPayment(db, payment({ amount: 100 }));
    expect(res.allocations.map((a) => [a.tid, a.amount])).toEqual([['T-0001', 60], ['T-0002', 40]]);
    expect(db.rows()[0]).toEqual(legacy);
    expect(db.rows().slice(1).map((r) => r.rid)).toEqual(['R-0002', 'R-0003']);
  });

  it('skips settled loans and never touches another person', async () => {
    const db = createFakeDb({ loans: [loan(1, 100, day(9)), loan(2, 100, day(8)), loan(3, 100, day(7), { name: 'Meena' })], repayments: [{ _id: 'o', userId: 'u1', rid: 'R-0001', seq: 1, tid: 'T-0001', amount: 100, date: day(5) }] });
    const res = await applyPayment(db, payment({ amount: 100 }));
    expect(res.allocations.map((a) => a.tid)).toEqual(['T-0002']);
    expect(balances(db)['T-0003']).toBe(100);
    await expect(applyPayment(db, payment({ amount: 1 }))).rejects.toThrow(/nothing outstanding/);
  });

  it('handles decimals exactly', async () => {
    const db = createFakeDb({ loans: [loan(1, 0.1, day(9)), loan(2, 0.2, day(8))] });
    expect((await applyPayment(db, payment({ amount: 0.3 }))).remaining).toBe(0);
    expect(Object.values(statuses(db))).toEqual(['Settled', 'Settled']);
  });

  it('refuses a payment dated before a loan it would be applied to, but allows older loans only', async () => {
    const db = createFakeDb({ loans: [loan(1, 100, day(1)), loan(2, 100, day(0))] });
    expect((await applyPayment(db, payment({ amount: 50, date: day(1) }))).allocations.map((a) => a.tid)).toEqual(['T-0001']);
    await expect(applyPayment(db, payment({ amount: 150, date: day(1) }))).rejects.toThrow(/cannot be before the loan date/);
  });
});

describe('overpayment and validation', () => {
  it('rejects anything above the total outstanding and writes nothing', async () => {
    const db = newDb();
    await expect(applyPayment(db, payment({ amount: 1301 }))).rejects.toThrow(/More than the total outstanding balance \(₹1300\)/);
    await expect(applyPayment(db, payment({ amount: 99999 }))).rejects.toThrow(/More than the total outstanding/);
    expect(db.rows()).toHaveLength(0);
    expect(db.committed.counters).toEqual({});
    expect(db.stats.commits).toBe(0);
  });

  it('rejects bad input before touching the database', async () => {
    const db = newDb();
    await expect(applyPayment(db, payment({ amount: 0 }))).rejects.toThrow(/greater than 0/);
    await expect(applyPayment(db, payment({ amount: -5 }))).rejects.toThrow(/greater than 0/);
    await expect(applyPayment(db, payment({ amount: 'abc' }))).rejects.toThrow(/greater than 0/);
    await expect(applyPayment(db, payment({ amount: 5, person: '  ' }))).rejects.toThrow(/Choose a person/);
    await expect(applyPayment(db, payment({ amount: 5, date: '2026-02-30' }))).rejects.toThrow(/date is required/);
    await expect(applyPayment(db, payment({ amount: 5, person: 'Nobody' }))).rejects.toMatchObject({ status: 404 });
    expect(db.stats.commits).toBe(0);
  });
});

describe('duplicate requests', () => {
  it('returns the original payment for a repeated request id and writes nothing new', async () => {
    const db = newDb();
    const first = await applyPayment(db, payment({ amount: 700, requestId: 'same' }));
    const again = await applyPayment(db, payment({ amount: 700, requestId: 'same' }));
    expect(again.duplicate).toBe(true);
    expect(again.payId).toBe(first.payId);
    expect(again.total).toBe(700);
    expect(again.remaining).toBe(600);
    expect(db.rows()).toHaveLength(4);
    expect(balances(db)['T-0004']).toBe(300);
  });

  it('refuses a request id that is reused for a different payment', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700, requestId: 'same' }));
    await expect(applyPayment(db, payment({ amount: 100, requestId: 'same' }))).rejects.toMatchObject({ status: 409 });
    expect(db.rows()).toHaveLength(4);
  });

  it('records ONE payment when the same request arrives twice at the same time', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const db = newDb({ rng: mulberry32(seed) });
      const [a, b] = await Promise.all([applyPayment(db, payment({ amount: 700, requestId: 'dbl' })), applyPayment(db, payment({ amount: 700, requestId: 'dbl' }))]);
      expect(db.rows()).toHaveLength(4);
      expect(a.payId).toBe(b.payId);
      expect([a.duplicate, b.duplicate].filter(Boolean)).toHaveLength(1);
    }
  });

  it('recovers when the unique index catches a twin request', async () => {
    const real = newDb();
    let first = true;
    const db = {
      transaction: async (fn) => {
        if (first) { // the twin commits while we are working, then the index rejects our write
          first = false;
          await applyPayment(real, payment({ amount: 700, requestId: 'x' }));
          throw dupError('userId_1_reqId_1_tid_1');
        }
        return real.transaction(fn);
      },
    };
    const res = await applyPayment(db, payment({ amount: 700, requestId: 'x' }));
    expect(res.duplicate).toBe(true);
    expect(real.rows()).toHaveLength(4);
  });
});

describe('failures leave nothing behind', () => {
  it('a write that dies halfway saves nothing and does not use up numbers', async () => {
    const db = newDb();
    db.failures.insertAfter = 2;
    await expect(applyPayment(db, payment({ amount: 700 }))).rejects.toThrow(/connection lost/);
    expect(db.rows()).toHaveLength(0);
    expect(db.committed.counters).toEqual({});
    expect(balances(db)['T-0004']).toBe(400);
    db.failures = {};
    const ok = await applyPayment(db, payment({ amount: 700 }));
    expect(ok.remaining).toBe(600);
    expect(db.rows().map((r) => r.rid)).toEqual(['R-0001', 'R-0002', 'R-0003', 'R-0004']);
  });

  it('a failed commit saves nothing and older records survive', async () => {
    const legacy = { _id: 'old1', userId: 'u1', rid: 'R-0001', seq: 1, tid: 'T-0001', amount: 40, date: day(45) };
    const db = newDb({ repayments: [legacy] });
    db.failures.commit = true;
    await expect(applyPayment(db, payment({ amount: 700 }))).rejects.toThrow(/commit failed/);
    expect(db.rows()).toEqual([legacy]);
  });

  it('after a lost acknowledgement, retrying with the same request id never pays twice', async () => {
    const db = newDb();
    db.failures.afterCommit = true;
    await expect(applyPayment(db, payment({ amount: 700, requestId: 'lost-ack' }))).rejects.toThrow(/lost after commit/);
    expect(db.rows()).toHaveLength(4); // it did commit
    db.failures = {};
    const retry = await applyPayment(db, payment({ amount: 700, requestId: 'lost-ack' }));
    expect(retry.duplicate).toBe(true);
    expect(retry.remaining).toBe(600);
    expect(db.rows()).toHaveLength(4);
    expect(balances(db)['T-0004']).toBe(300);
  });
});

describe('concurrent payments', () => {
  it('two ₹700 payments on ₹1,300: exactly one wins, nobody is over-paid', async () => {
    let conflicts = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const db = newDb({ rng: mulberry32(seed) });
      const results = await Promise.allSettled([applyPayment(db, payment({ amount: 700, requestId: `a${seed}` })), applyPayment(db, payment({ amount: 700, requestId: `b${seed}` }))]);
      conflicts += db.stats.conflicts;
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const loser = results.find((r) => r.status === 'rejected');
      expect(loser.reason.message).toMatch(/More than the total outstanding balance \(₹600\)/);
      expect(totalPaid(db)).toBe(700);
      expect(Object.values(balances(db)).every((b) => b >= 0)).toBe(true);
    }
    expect(conflicts).toBeGreaterThan(0); // the overlap really happened and was resolved by retry
  });

  it('two ₹600 payments both succeed one after the other', async () => {
    for (let seed = 1; seed <= 150; seed++) {
      const db = newDb({ rng: mulberry32(seed) });
      await Promise.all([applyPayment(db, payment({ amount: 600, requestId: `a${seed}` })), applyPayment(db, payment({ amount: 600, requestId: `b${seed}` }))]);
      expect(totalPaid(db)).toBe(1200);
      expect(Object.values(balances(db)).every((b) => b >= 0)).toBe(true);
      expect(Object.values(balances(db)).reduce((s, b) => s + b, 0)).toBe(100);
    }
  });

  it('many parallel payments get unique, gap-free repayment numbers', async () => {
    const db = createFakeDb({ loans: [loan(1, 400, day(9)), loan(2, 400, day(8)), loan(3, 400, day(7))], rng: mulberry32(7) });
    await Promise.all(Array.from({ length: 30 }, (_, i) => applyPayment(db, payment({ amount: 40, requestId: `p${i}` }))));
    const rows = db.rows();
    const rids = rows.map((r) => r.rid);
    expect(new Set(rids).size).toBe(rids.length);
    expect(new Set(rows.map((r) => r.seq)).size).toBe(rows.length);
    expect(rows.map((r) => r.seq).sort((a, b) => a - b)).toEqual(rows.map((_, i) => i + 1));
    expect(rows.every((r) => r.rid === `R-${String(r.seq).padStart(4, '0')}`)).toBe(true);
    expect(totalPaid(db)).toBe(1200);
    expect(Object.values(balances(db)).every((b) => b === 0)).toBe(true);
  });

  it('keeps counting after imported rows with higher numbers', async () => {
    const db = createFakeDb({ loans: fiveLoans(), repayments: [{ _id: 'imp', userId: 'u1', rid: 'R-0042', seq: 42, tid: 'T-0001', amount: 10, date: day(5) }] });
    await applyPayment(db, payment({ amount: 20 }));
    expect(db.rows().map((r) => r.rid)).toEqual(['R-0042', 'R-0043']);
  });
});

describe('payments from older app versions (one loan)', () => {
  it('records a single-loan payment with the shared numbering and the loan balance limit', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700 }));
    const row = await applyLoanPayment(db, { uid: 'u1', tid: 'T-0005', amount: 100, date: TODAY });
    expect(row.rid).toBe('R-0005');
    expect(row.payId).toBeUndefined();
    await expect(applyLoanPayment(db, { uid: 'u1', tid: 'T-0005', amount: 201, date: TODAY })).rejects.toThrow(/remaining balance \(₹200\)/);
    await expect(applyLoanPayment(db, { uid: 'u1', tid: 'T-0099', amount: 1, date: TODAY })).rejects.toThrow(/Choose a transaction/);
    expect(db.rows()).toHaveLength(5);
  });
});

describe('deleting', () => {
  it('removes a multi-loan payment as a whole, and balances return', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700 }));
    await applyPayment(db, payment({ amount: 100 }));
    const anyRow = db.rows()[2];
    expect(await removePayment(db, { uid: 'u1', id: anyRow._id })).toEqual({ ok: true, removed: 4 });
    expect(db.rows()).toHaveLength(1); // the second payment is untouched
    expect(Object.values(balances(db)).reduce((s, b) => s + b, 0)).toBe(1200);
  });

  it('removes an older single repayment on its own', async () => {
    const db = newDb({ repayments: [{ _id: 'o1', userId: 'u1', rid: 'R-0001', seq: 1, tid: 'T-0001', amount: 40, date: day(5) }, { _id: 'o2', userId: 'u1', rid: 'R-0002', seq: 2, tid: 'T-0002', amount: 40, date: day(5) }] });
    expect(await removePayment(db, { uid: 'u1', id: 'o1' })).toEqual({ ok: true, removed: 1 });
    expect(db.rows().map((r) => r._id)).toEqual(['o2']);
  });

  it('only removes the rows of the same person if loans were renamed afterwards', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700 }));
    db.committed.loans.find((l) => l.tid === 'T-0003').name = 'Meena';
    const ravi = db.rows().find((r) => r.tid === 'T-0001');
    expect((await removePayment(db, { uid: 'u1', id: ravi._id })).removed).toBe(3);
    expect(db.rows().map((r) => r.tid)).toEqual(['T-0003']);
  });

  it('reports an unknown repayment and changes nothing', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 100 }));
    await expect(removePayment(db, { uid: 'u1', id: 'nope' })).rejects.toMatchObject({ status: 404 });
    expect(db.rows()).toHaveLength(1);
  });

  it('deletes a loan together with its repayment rows, leaving the rest of a split payment', async () => {
    const db = newDb();
    await applyPayment(db, payment({ amount: 700 }));
    await removeLoan(db, { uid: 'u1', id: 'loan2' });
    expect(db.loans().map((l) => l.tid)).toEqual(['T-0001', 'T-0003', 'T-0004', 'T-0005']);
    expect(db.rows().map((r) => r.tid)).toEqual(['T-0001', 'T-0003', 'T-0004']);
    await expect(removeLoan(db, { uid: 'u1', id: 'loan2' })).rejects.toMatchObject({ status: 404 });
  });
});
