import { addDays, todayStr } from '../../lib/calc';

export const TODAY = todayStr();
export const day = (n) => addDays(TODAY, -n); // n days ago

export const loan = (n, amount, date, extra = {}) => ({
  _id: `loan${n}`, userId: 'u1', tid: `T-${String(n).padStart(4, '0')}`, seq: n, name: 'Ravi', amount, date, time: '10:00', reason: `Loan ${n}`, ...extra,
});

// ₹1,300 owed over five loans, oldest first (100 + 200 + 300 + 400 + 300)
export const fiveLoans = () => [loan(1, 100, day(50)), loan(2, 200, day(40)), loan(3, 300, day(30)), loan(4, 400, day(20)), loan(5, 300, day(10))];

export const payment = (extra = {}) => ({ uid: 'u1', person: 'Ravi', date: TODAY, time: '12:00', ...extra });
