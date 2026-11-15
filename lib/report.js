import { groupPayments } from './payments';

// Pure helpers for the person-wise report and the mobile nav. No React, no database access:
// everything is derived from the transactions / repayments that are already saved.

// 'HH:mm' (as saved) -> '2:35 PM'. Older records without a time say so instead of guessing.
export function fmtTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
  if (!m) return 'Time not saved';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Everyone who appears in the people list or on a transaction, A–Z, no duplicates.
export function personNames(tx, people) {
  const set = new Set([...people.map((p) => p.name), ...tx.map((t) => t.name)].filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const stamp = (e) => `${e.date || ''} ${e.time || ''}`;

// One entry per saved record: every loan is "Given", every repayment is "Received". Newest first.
export function buildEntries(tx, rp, name) {
  const mine = tx.filter((t) => t.name === name);
  const tids = new Set(mine.map((t) => t.tid));
  const given = mine.map((t) => ({
    key: `t-${t._id || t.tid}`, kind: 'given', id: t.tid, ref: t.tid, amount: t.amount, date: t.date, time: t.time || '',
    notes: String(t.notes || '').trim(), extraNotes: String(t.dueNotes || '').trim(), reason: t.reason || '',
  }));
  const received = groupPayments(rp.filter((r) => tids.has(r.tid)), mine).map((g) => ({
    key: `p-${g.key}`, kind: 'received', id: g.id, ref: g.allocations.length > 1 ? `${g.allocations.length} loans` : g.allocations[0].tid,
    amount: g.amount, date: g.date, time: g.time, notes: g.notes, extraNotes: '', reason: '', allocations: g.allocations,
  }));
  return [...given, ...received].sort((a, b) => stamp(b).localeCompare(stamp(a)) || (a.kind === b.kind ? 0 : a.kind === 'received' ? -1 : 1));
}

export const filterEntries = (list, kind) => (kind === 'all' ? list : list.filter((e) => e.kind === kind));

// tx must be the enriched list (it carries paid / balance).
export function personTotals(tx, name) {
  const mine = tx.filter((t) => t.name === name);
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    given: round(mine.reduce((a, t) => a + t.amount, 0)),
    received: round(mine.reduce((a, t) => a + t.paid, 0)),
    outstanding: round(mine.reduce((a, t) => a + t.balance, 0)),
    loans: mine.length,
  };
}

// Mobile bottom bar: decides from the scroll position whether it should be hidden.
// hideOn = 'down' -> hide while scrolling down, show while scrolling up (YouTube / Instagram style)
// hideOn = 'up'   -> the opposite
// A 12px threshold avoids flicker; the bar is always shown at the very top, at the very
// bottom and on pages too short to scroll, so navigation can never get stuck out of reach.
export function nextNavState(state, y, max, hideOn = 'down', threshold = 12) {
  y = Math.min(Math.max(y, 0), Math.max(max, 0)); // iOS rubber-band overscroll gives out-of-range values
  if (max <= 0 || y <= 8 || max - y <= 8) return { hidden: false, last: y };
  const dy = y - state.last;
  if (Math.abs(dy) < threshold) return state;
  const up = dy < 0;
  return { hidden: hideOn === 'up' ? up : !up, last: y };
}
