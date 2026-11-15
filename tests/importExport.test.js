import { describe, it, expect } from 'vitest';
import { paymentTotals, planImportedPayIds, remapImportedPayIds } from '../lib/payments';

const row = (rid, tid, extra = {}) => ({ rid, tid, amount: 100, date: '2026-05-01', time: '10:00', notes: '', payId: '', ...extra });
const names = { 'T-0001': 'Ravi', 'T-0002': 'Ravi', 'T-0003': 'Ravi', 'T-0004': 'Meena' };

describe('partial export', () => {
  it('keeps the full payment total even when only some loans are exported', () => {
    const all = [row('R-0002', 'T-0001', { amount: 100, payId: 'R-0002' }), row('R-0003', 'T-0002', { amount: 200, payId: 'R-0002' }), row('R-0004', 'T-0003', { amount: 300, payId: 'R-0002' }), row('R-0001', 'T-0004', { amount: 50 })];
    const whole = paymentTotals(all);
    const exported = all.filter((r) => r.tid === 'T-0001'); // user exported only the first loan
    expect(exported).toHaveLength(1);
    expect(whole.get(exported[0].payId || exported[0].rid)).toEqual({ total: 600, count: 3 });
    expect(whole.get('R-0001')).toEqual({ total: 50, count: 1 }); // older single repayment: its own payment
  });
});

describe('Payment ID collisions on import', () => {
  it('leaves ids alone when nothing in this database uses them', () => {
    const rows = [row('R-0010', 'T-0001', { payId: 'R-0010' }), row('R-0011', 'T-0002', { payId: 'R-0010' })];
    const plan = planImportedPayIds(rows, [], names);
    expect(plan.collisions).toEqual([]);
    expect([...remapImportedPayIds(plan, [])]).toEqual([['R-0010', 'R-0010'], ['R-0011', 'R-0010']]);
  });

  it('keeps the first row of a split payment in its payment (its Payment ID equals its own id)', () => {
    const rows = [row('R-0002', 'T-0001', { payId: 'R-0002' }), row('R-0003', 'T-0002', { payId: 'R-0002' }), row('R-0004', 'T-0003', { payId: 'R-0002' })];
    const plan = planImportedPayIds(rows, [], names);
    expect(plan.collisions).toEqual([]);
    expect([...plan.keep.values()]).toEqual(['R-0002', 'R-0002', 'R-0002']);
  });

  it('keeps a lone first row grouped when its Payment Total shows the payment was bigger (partial export)', () => {
    const plan = planImportedPayIds([row('R-0002', 'T-0001', { payId: 'R-0002', amount: 100, payTotal: 600 })], [], names);
    expect(plan.keep.get('R-0002')).toBe('R-0002');
  });

  it('turns a Payment ID equal to the repayment id into "not a split payment"', () => {
    const plan = planImportedPayIds([row('R-0010', 'T-0001', { payId: 'R-0010' })], [], names);
    expect(plan.keep.get('R-0010')).toBe('');
  });

  it('gives a fresh id when the Payment ID belongs to a different payment already stored', () => {
    const stored = [row('R-0002', 'T-0004', { payId: 'R-0002', date: '2026-03-03', notes: 'other' })];
    const incoming = [row('R-0020', 'T-0001', { payId: 'R-0002' }), row('R-0021', 'T-0002', { payId: 'R-0002' })];
    const plan = planImportedPayIds(incoming, stored, names);
    expect(plan.collisions).toEqual(['R-0002']);
    const map = remapImportedPayIds(plan, ['R-0090']);
    expect(map.get('R-0020')).toBe('R-0090');
    expect(map.get('R-0021')).toBe('R-0090'); // both rows of the incoming payment stay together
  });

  it('gives a fresh id when the Payment ID equals the id of an older single repayment', () => {
    const stored = [row('R-0002', 'T-0004')]; // older style: no payId
    const plan = planImportedPayIds([row('R-0020', 'T-0001', { payId: 'R-0002' }), row('R-0021', 'T-0002', { payId: 'R-0002' })], stored, names);
    expect(plan.collisions).toEqual(['R-0002']);
  });

  it('gives a fresh id when another imported single repayment has that id', () => {
    const incoming = [row('R-0002', 'T-0004'), row('R-0020', 'T-0001', { payId: 'R-0002' }), row('R-0021', 'T-0002', { payId: 'R-0002' })];
    expect(planImportedPayIds(incoming, [], names).collisions).toEqual(['R-0002']);
  });

  it('merges rows into the stored payment when they are the same payment (same person, date, time, notes)', () => {
    const stored = [row('R-0002', 'T-0001', { payId: 'R-0002', notes: 'cash' })];
    const incoming = [row('R-0003', 'T-0002', { payId: 'R-0002', notes: 'cash' })]; // the rest of a payment imported earlier in part
    expect(planImportedPayIds(incoming, stored, names).collisions).toEqual([]);
  });

  it('assigns each colliding payment its own fresh id', () => {
    const stored = [row('R-0002', 'T-0004', { payId: 'R-0002', notes: 'x' }), row('R-0005', 'T-0004', { payId: 'R-0005', notes: 'y' })];
    const incoming = [row('R-0020', 'T-0001', { payId: 'R-0002' }), row('R-0021', 'T-0002', { payId: 'R-0002' }), row('R-0030', 'T-0003', { payId: 'R-0005' }), row('R-0031', 'T-0001', { payId: 'R-0005' })];
    const plan = planImportedPayIds(incoming, stored, names);
    expect(plan.collisions).toEqual(['R-0002', 'R-0005']);
    const map = remapImportedPayIds(plan, ['R-0100', 'R-0101']);
    expect(map.get('R-0020')).toBe('R-0100');
    expect(map.get('R-0030')).toBe('R-0101');
  });
});
