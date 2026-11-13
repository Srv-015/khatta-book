export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const todayStr = () => new Date().toLocaleDateString('en-CA');
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const fmtDate = (s) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

// Rounds to paise so float noise (0.1 + 0.2) never leaks into balances or validation.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ---------- calendar maths on plain YYYY-MM-DD strings (no time-zone shifts) ---------- */
const ymd = (s) => s.split('-').map(Number);
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = ymd(s);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
export function addDays(s, n) {
  const [y, m, d] = ymd(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
// Calendar months; a day that does not exist in the target month is clamped to its last day
// (31 Jan + 1 month = 28 Feb, or 29 Feb in a leap year).
export function addMonths(s, n) {
  const [y, m, d] = ymd(s);
  const i = y * 12 + (m - 1) + n;
  const ny = Math.floor(i / 12), nm = i % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return iso(ny, nm + 1, Math.min(d, last));
}
export function daysBetween(a, b) {
  const [x, y, z] = ymd(a), [p, q, r] = ymd(b);
  return Math.round((Date.UTC(p, q - 1, r) - Date.UTC(x, y - 1, z)) / 864e5);
}

/* ---------- expected repayment ---------- */
export const DURATIONS = [
  { key: '2-4d', label: '2–4 Days', unit: 'd', min: 2, max: 4 },
  { key: '5-10d', label: '5–10 Days', unit: 'd', min: 5, max: 10 },
  { key: '10-20d', label: '10–20 Days', unit: 'd', min: 10, max: 20 },
  { key: '1-2m', label: '1–2 Months', unit: 'm', min: 1, max: 2 },
  { key: '3-4m', label: '3–4 Months', unit: 'm', min: 3, max: 4 },
  { key: '4-5m', label: '4–5 Months', unit: 'm', min: 4, max: 5 },
  { key: '5-6m', label: '5–6 Months', unit: 'm', min: 5, max: 6 },
  { key: 'others', label: 'Others' },
];

export function dueRange(key, start) {
  const d = DURATIONS.find((x) => x.key === key);
  if (!d || !d.unit || !isValidDate(start)) return null;
  const add = d.unit === 'd' ? addDays : addMonths;
  return { min: add(start, d.min), max: add(start, d.max) };
}

// Single source of truth for the stored repayment fields (used by the API and by import).
// dueDate mirrors dueMax so older code and old records keep working.
export function computeDue({ duration = '', date, custom = '', notes = '' }) {
  duration = String(duration || '');
  if (!duration) return { repayDuration: '', dueMin: '', dueMax: '', dueDate: '', dueNotes: '' };
  if (duration === 'others') {
    custom = String(custom || '').trim();
    if (custom && !isValidDate(custom)) throw new Error('Custom repayment date is not valid');
    return { repayDuration: 'others', dueMin: custom, dueMax: custom, dueDate: custom, dueNotes: String(notes || '').trim() };
  }
  const r = dueRange(duration, date);
  if (!r) throw new Error('Choose a valid expected repayment option');
  return { repayDuration: duration, dueMin: r.min, dueMax: r.max, dueDate: r.max, dueNotes: '' };
}

export const durationLabel = (t) => DURATIONS.find((d) => d.key === t.repayDuration)?.label || '';
export function dueText(t) {
  if (!t.dueMax) return '–';
  return t.dueMin && t.dueMin !== t.dueMax ? `${fmtDate(t.dueMin)} – ${fmtDate(t.dueMax)}` : fmtDate(t.dueMax);
}

/* ---------- balances, status, countdown ---------- */
// A loan is Overdue once today is after its latest expected date and something is still owed.
export function statusOf(t, paid) {
  if (round2(t.amount - paid) <= 0) return 'Settled';
  const max = t.dueMax || t.dueDate || '';
  if (max && todayStr() > max) return 'Overdue';
  return paid > 0 ? 'Partial' : 'Pending';
}

// Adds paid / balance / status, and gives records saved before the duration field existed
// a consistent dueMin / dueMax / repayDuration (their old date becomes a fixed "Others" date).
export function enrich(txs, rps) {
  const p = {};
  for (const r of rps) p[r.tid] = round2((p[r.tid] || 0) + r.amount);
  return txs.map((t) => {
    const max = t.dueMax || t.dueDate || '';
    const paid = p[t.tid] || 0;
    const e = { ...t, dueMax: max, dueMin: t.dueMin || max, repayDuration: t.repayDuration || (max ? 'others' : ''), paid, balance: round2(t.amount - paid) };
    e.status = statusOf(e, paid);
    return e;
  });
}

export function countdown(t) {
  if (t.status === 'Settled') return 'Completed';
  if (!t.dueMax) return 'No due date';
  const today = todayStr();
  const pl = (k) => `${k} day${k === 1 ? '' : 's'}`;
  if (t.status === 'Overdue') return `${pl(daysBetween(t.dueMax, today))} overdue`;
  const a = daysBetween(today, t.dueMin), b = daysBetween(today, t.dueMax);
  if (b === 0) return 'Due today';
  if (a === b) return `${pl(b)} remaining`;
  if (a <= 0) return `Due within ${pl(b)}`;
  return `Due in ${a}–${b} days`;
}
