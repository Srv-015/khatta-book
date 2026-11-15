import { describe, it, expect } from 'vitest';
import { enrich } from '../lib/calc';
import { allocateFifo, fifoOrder, openLoans, outstandingOf } from '../lib/payments';
import { day, fiveLoans, loan } from './helpers/fixtures';

const open = () => enrich(fiveLoans(), []);

describe('FIFO allocation', () => {
  it('spreads ₹700 over ₹1,300 oldest loan first and leaves ₹600', () => {
    const { allocations, unallocated } = allocateFifo(open(), 700);
    expect(allocations.map((a) => [a.tid, a.amount, a.settles])).toEqual([
      ['T-0001', 100, true], ['T-0002', 200, true], ['T-0003', 300, true], ['T-0004', 100, false],
    ]);
    expect(unallocated).toBe(0);
    expect(allocations.reduce((s, a) => s + a.amount, 0)).toBe(700);
    expect(allocations[3].balanceAfter).toBe(300);
    expect(outstandingOf(open())).toBe(1300);
  });

  it('settles every loan when the full amount is paid', () => {
    const { allocations } = allocateFifo(open(), 1300);
    expect(allocations).toHaveLength(5);
    expect(allocations.every((a) => a.settles)).toBe(true);
  });

  it('reports what cannot be placed when the amount is above the total', () => {
    expect(allocateFifo(open(), 1400).unallocated).toBe(100);
  });

  it('works in paise, so 0.1 + 0.2 settles exactly 0.3', () => {
    const { allocations, unallocated } = allocateFifo([{ tid: 'A', balance: 0.1, date: '2026-01-01' }, { tid: 'B', balance: 0.2, date: '2026-01-02' }], 0.3);
    expect(allocations.map((a) => a.settles)).toEqual([true, true]);
    expect(unallocated).toBe(0);
  });

  it('skips loans that are already settled and loans of other people', () => {
    const enriched = enrich([loan(1, 100, day(9)), loan(2, 100, day(8)), loan(3, 100, day(7), { name: 'Meena' })], [{ tid: 'T-0001', amount: 100 }]);
    expect(openLoans(enriched, 'Ravi').map((l) => l.tid)).toEqual(['T-0002']);
  });

  it('counts a partly paid loan by what is left', () => {
    const enriched = enrich(fiveLoans(), [{ tid: 'T-0001', amount: 40 }]);
    const { allocations } = allocateFifo(openLoans(enriched, 'Ravi'), 100);
    expect(allocations.map((a) => [a.tid, a.amount])).toEqual([['T-0001', 60], ['T-0002', 40]]);
  });
});

describe('oldest-first order', () => {
  it('uses the loan date, not the order the loans were entered', () => {
    expect(fifoOrder([loan(1, 5, '2026-05-02'), loan(2, 5, '2026-05-01')]).map((l) => l.tid)).toEqual(['T-0002', 'T-0001']);
  });
  it('uses the loan time on the same day', () => {
    expect(fifoOrder([loan(1, 5, '2026-05-01', { time: '15:00' }), loan(2, 5, '2026-05-01', { time: '09:00' })]).map((l) => l.tid)).toEqual(['T-0002', 'T-0001']);
  });
  it('falls back to entry order for identical timestamps', () => {
    expect(fifoOrder([loan(2, 5, '2026-05-01'), loan(1, 5, '2026-05-01')]).map((l) => l.tid)).toEqual(['T-0001', 'T-0002']);
  });
});
