'use client';
import { countdown, fmtDate, money } from '@/lib/calc';

const STY = {
  Settled: 'bg-okb text-ok',
  Overdue: 'bg-erb text-er',
  Partial: 'bg-wab text-wa',
  Pending: 'bg-inb text-inf',
};

export const Badge = ({ s }) => (
  <span
    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STY[s]}`}
  >
    {s === 'Partial' ? 'Partially Paid' : s}
  </span>
);
export const Panel = ({ title, children, id }) => (
  <section id={id} className="card scroll-mt-4">
    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
    {children}
  </section>
);
export const Stat = ({ label, value, tone = '' }) => (
  <div className="card">
    <div className="text-xs text-mu">{label}</div>
    <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
  </div>
);
export const Empty = ({ children }) => (
  <div className="py-4 text-center text-sm text-mu">{children}</div>
);

export function TxList({ items, onOpen, empty }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return items.map((t) => (
    <button
      key={t._id}
      onClick={() => onOpen(t)}
      className="flex w-full justify-between gap-3 border-t border-bd py-2.5 text-left first:border-0"
    >
      <div>
        {t.name}
        <div className="text-xs text-mu">
          {t.reason || t.tid} · {fmtDate(t.date)}
        </div>
      </div>
      <div className="text-right">
        {money(t.balance)}
        <div className="text-xs text-mu">
          <Badge s={t.status} /> {countdown(t)}
        </div>
      </div>
    </button>
  ));
}
