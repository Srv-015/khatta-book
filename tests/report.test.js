import { describe, it, expect } from 'vitest';
import { enrich } from '../lib/calc';
import { groupPayments, paymentRows } from '../lib/payments';
import { buildEntries, nextNavState, personTotals } from '../lib/report';
import { applyPayment } from '../lib/payments';
import { createFakeDb } from './helpers/fakeDb';
import { day, fiveLoans, payment } from './helpers/fixtures';

describe('payments in reports', () => {
  it('shows a split payment as one received entry and older repayments as their own', async () => {
    const legacy = { _id: 'old', userId: 'u1', rid: 'R-0001', seq: 1, tid: 'T-0001', amount: 40, date: day(45), time: '09:30', notes: 'first part' };
    const db = createFakeDb({ loans: fiveLoans(), repayments: [legacy] });
    await applyPayment(db, payment({ amount: 700, notes: 'cash handed over' }));
    const rows = db.rows();
    expect(groupPayments(rows, db.loans()).map((g) => [g.id, g.amount, g.allocations.length])).toEqual([['R-0002', 700, 4], ['R-0001', 40, 1]]);
    expect(paymentRows(rows, rows[3])).toHaveLength(4);
    expect(paymentRows(rows, rows[0])).toHaveLength(1);
    const enriched = enrich(db.loans(), rows);
    const entries = buildEntries(enriched, rows, 'Ravi');
    const card = entries.find((e) => e.id === 'R-0002');
    expect([card.kind, card.amount, card.ref, card.notes, card.allocations.length]).toEqual(['received', 700, '4 loans', 'cash handed over', 4]);
    expect(entries.filter((e) => e.kind === 'given')).toHaveLength(5);
    expect(personTotals(enriched, 'Ravi')).toEqual({ given: 1300, received: 740, outstanding: 560, loans: 5 });
  });
});

describe('bottom bar scroll rule', () => {
  it('hides while scrolling down, shows while scrolling up, ignores small moves', () => {
    let s = { hidden: false, last: 0 };
    const at = (y) => { s = nextNavState(s, y, 3000); return s.hidden; };
    expect(at(0)).toBe(false);
    expect(at(300)).toBe(true);
    expect(at(296)).toBe(true);
    expect(at(280)).toBe(false);
    expect(at(284)).toBe(false);
    expect(at(2995)).toBe(false);
  });
});
