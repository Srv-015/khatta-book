import { describe, it, expect } from 'vitest';

import {
  money,
  round2,
  isValidDate,
  addDays,
  addMonths,
  daysBetween,
  DURATIONS,
  dueRange,
  computeDue,
  durationLabel,
  dueText,
  statusOf,
  enrich,
  countdown,
  todayStr,
} from '../lib/calc.js';

describe('Money calculations', () => {
  it('rounds amounts to two decimal places', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(10.456)).toBe(10.46);
    expect(round2(100)).toBe(100);
  });

  it('formats money in Indian currency style', () => {
    expect(money(1000)).toContain('₹');
    expect(money(1000)).toContain('1,000');
  });
});

describe('Date validation', () => {
  it('accepts valid dates', () => {
    expect(isValidDate('2026-11-13')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidDate('2025-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-04-31')).toBe(false);
    expect(isValidDate('invalid')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('Date calculations', () => {
  it('adds days correctly', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('handles calendar months and month-end dates', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('calculates days between dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-10')).toBe(9);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });
});

describe('Expected repayment durations', () => {
  it('contains all eight repayment options', () => {
    expect(DURATIONS).toHaveLength(8);
  });

  it('calculates day-based repayment ranges', () => {
    expect(dueRange('2-4d', '2026-11-13')).toEqual({
      min: '2026-11-15',
      max: '2026-11-17',
    });
  });

  it('calculates month-based repayment ranges', () => {
    expect(dueRange('1-2m', '2026-01-31')).toEqual({
      min: '2026-02-28',
      max: '2026-03-31',
    });
  });

  it('returns null for invalid duration or date', () => {
    expect(dueRange('unknown', '2026-11-13')).toBeNull();
    expect(dueRange('2-4d', 'invalid')).toBeNull();
  });
});

describe('Compute expected repayment', () => {
  it('calculates and stores repayment dates', () => {
    expect(computeDue({
      duration: '2-4d',
      date: '2026-11-13',
    })).toEqual({
      repayDuration: '2-4d',
      dueMin: '2026-11-15',
      dueMax: '2026-11-17',
      dueDate: '2026-11-17',
      dueNotes: '',
    });
  });

  it('handles custom repayment dates and notes', () => {
    expect(computeDue({
      duration: 'others',
      date: '2026-11-13',
      custom: '2026-12-15',
      notes: 'Payment after salary',
    })).toEqual({
      repayDuration: 'others',
      dueMin: '2026-12-15',
      dueMax: '2026-12-15',
      dueDate: '2026-12-15',
      dueNotes: 'Payment after salary',
    });
  });

  it('rejects invalid custom dates', () => {
    expect(() => computeDue({
      duration: 'others',
      custom: '2026-02-30',
    })).toThrow('Custom repayment date is not valid');
  });

  it('rejects invalid repayment options', () => {
    expect(() => computeDue({
      duration: 'unknown',
      date: '2026-11-13',
    })).toThrow('Choose a valid expected repayment option');
  });
});

describe('Repayment labels', () => {
  it('returns the correct duration label', () => {
    expect(durationLabel({ repayDuration: '2-4d' })).toBe('2–4 Days');
  });

  it('formats repayment date ranges', () => {
    expect(dueText({
      dueMin: '2026-11-15',
      dueMax: '2026-11-17',
    })).toContain('–');
  });
});

describe('Transaction status', () => {
  it('identifies pending transactions', () => {
    expect(statusOf({
      amount: 1000,
      dueMax: '',
    }, 0)).toBe('Pending');
  });

  it('identifies partially paid transactions', () => {
    expect(statusOf({
      amount: 1000,
      dueMax: '',
    }, 300)).toBe('Partial');
  });

  it('identifies fully settled transactions', () => {
    expect(statusOf({
      amount: 1000,
      dueMax: '',
    }, 1000)).toBe('Settled');
  });

  it('identifies overdue transactions', () => {
    const yesterday = addDays(todayStr(), -1);

    expect(statusOf({
      amount: 1000,
      dueMax: yesterday,
    }, 0)).toBe('Overdue');
  });

  it('does not mark fully paid transactions overdue', () => {
    const yesterday = addDays(todayStr(), -1);

    expect(statusOf({
      amount: 1000,
      dueMax: yesterday,
    }, 1000)).toBe('Settled');
  });
});

describe('Transaction enrichment', () => {
  it('calculates paid amount and outstanding balance', () => {
    const result = enrich(
      [{ tid: 'T1', amount: 1000, dueMax: '' }],
      [
        { tid: 'T1', amount: 300 },
        { tid: 'T1', amount: 200 },
      ]
    );

    expect(result[0].paid).toBe(500);
    expect(result[0].balance).toBe(500);
    expect(result[0].status).toBe('Partial');
  });

  it('supports transactions without repayments', () => {
    const result = enrich(
      [{ tid: 'T2', amount: 500, dueMax: '' }],
      []
    );

    expect(result[0].paid).toBe(0);
    expect(result[0].balance).toBe(500);
    expect(result[0].status).toBe('Pending');
  });
});

describe('Repayment countdown', () => {
  it('returns completed for settled transactions', () => {
    expect(countdown({ status: 'Settled' })).toBe('Completed');
  });

  it('returns no due date when no date exists', () => {
    expect(countdown({ status: 'Pending' })).toBe('No due date');
  });

  it('identifies a transaction due today', () => {
    expect(countdown({
      status: 'Pending',
      dueMin: todayStr(),
      dueMax: todayStr(),
    })).toBe('Due today');
  });
});
