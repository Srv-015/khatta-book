'use client';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { TxDetail, TxForm, PersonDetail, useActions } from '@/components/forms';
import { Badge, Empty } from '@/components/ui';
import { countdown, dueText, fmtDate, money } from '@/lib/calc';

const SORTS = { new: 'Newest', old: 'Oldest', hi: 'Highest amount', lo: 'Lowest amount' };

export default function Transactions() {
  const { tx, loading, show, notify } = useData();
  const { askDeleteTx } = useActions();
  const [F, setF] = useState({
    q: '',
    status: '',
    from: '',
    to: '',
    min: '',
    max: '',
    sort: 'new',
  });
  const [sel, setSel] = useState(new Set());
  const [showF, setShowF] = useState(false);
  const set = (k) => (e) => setF({ ...F, [k]: e.target.value });

  const rows = useMemo(() => {
    const q = F.q.toLowerCase();
    const key = (t) => t.date + (t.time || '');
    const sorts = {
      new: (a, b) => key(b).localeCompare(key(a)),
      old: (a, b) => key(a).localeCompare(key(b)),
      hi: (a, b) => b.amount - a.amount,
      lo: (a, b) => a.amount - b.amount,
    };
    return tx
      .filter(
        (t) =>
          (!q || `${t.name} ${t.tid} ${t.reason}`.toLowerCase().includes(q)) &&
          (!F.status || t.status === F.status) &&
          (!F.from || t.date >= F.from) &&
          (!F.to || t.date <= F.to) &&
          (!F.min || t.amount >= +F.min) &&
          (!F.max || t.amount <= +F.max)
      )
      .sort(sorts[F.sort]);
  }, [tx, F]);

  const toggle = (id) => {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    setSel(s);
  };
  const exportSel = () =>
    sel.size
      ? (location.href = `/api/export?format=xlsx&ids=${[...sel].join(',')}`)
      : notify('Tick some rows first');
  if (loading) return <Empty>Loading…</Empty>;

  return (
    <>
      <div className="mb-3 flex gap-2">
        <input
          className="input md:max-w-md"
          placeholder="Search name, ID, reason"
          value={F.q}
          onChange={set('q')}
        />
        <button className="btn md:hidden" onClick={() => setShowF(!showF)}>
          Filters
        </button>
        <button className="btn hidden md:inline-flex" onClick={exportSel}>
          Export selected ({sel.size})
        </button>
      </div>
      <div className={`${showF ? 'grid' : 'hidden'} mb-3 grid-cols-2 gap-2 md:grid md:grid-cols-6`}>
        <select className="input" value={F.status} onChange={set('status')}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Partial">Partially paid</option>
          <option value="Settled">Settled</option>
          <option value="Overdue">Overdue</option>
        </select>
        <input
          className="input"
          type="date"
          title="From date"
          value={F.from}
          onChange={set('from')}
        />
        <input className="input" type="date" title="To date" value={F.to} onChange={set('to')} />
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="Min ₹"
          value={F.min}
          onChange={set('min')}
        />
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="Max ₹"
          value={F.max}
          onChange={set('max')}
        />
        <select className="input" value={F.sort} onChange={set('sort')}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* phone: cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((t) => (
          <div
            key={t._id}
            className="card cursor-pointer active:bg-ac2"
            onClick={() => show(<TxDetail tid={t.tid} />)}
          >
            <div className="flex justify-between gap-2">
              <div className="font-semibold">
                {t.name}
                <div className="text-xs font-normal text-mu">
                  {t.tid} · {fmtDate(t.date)}
                  {t.reason ? ` · ${t.reason}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{money(t.balance)}</div>
                <div className="text-xs text-mu">of {money(t.amount)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-mu">
              <Badge s={t.status} />
              <span>{countdown(t)}</span>
            </div>
          </div>
        ))}
        {!rows.length && <Empty>No transactions found</Empty>}
      </div>

      {/* desktop: table */}
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((t) => sel.has(t.tid))}
                  onChange={(e) =>
                    setSel(e.target.checked ? new Set(rows.map((t) => t.tid)) : new Set())
                  }
                />
              </th>
              <th>ID</th>
              <th>Person</th>
              <th>Given</th>
              <th>Repaid</th>
              <th>Balance</th>
              <th>Date</th>
              <th>Due</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id}>
                <td>
                  <input type="checkbox" checked={sel.has(t.tid)} onChange={() => toggle(t.tid)} />
                </td>
                <td>{t.tid}</td>
                <td>
                  <button
                    className="font-semibold text-ac"
                    onClick={() => show(<PersonDetail name={t.name} />)}
                  >
                    {t.name}
                  </button>
                </td>
                <td>{money(t.amount)}</td>
                <td>{money(t.paid)}</td>
                <td>{money(t.balance)}</td>
                <td>{fmtDate(t.date)}</td>
                <td>
                  {dueText(t)}
                  <div className="text-xs text-mu">{countdown(t)}</div>
                </td>
                <td>
                  <Badge s={t.status} />
                </td>
                <td className="space-x-1">
                  <button className="btn btn-sm" onClick={() => show(<TxDetail tid={t.tid} />)}>
                    View
                  </button>
                  <button className="btn btn-sm" onClick={() => show(<TxForm tx={t} />)}>
                    Edit
                  </button>
                  <button className="btn btn-sm" onClick={() => askDeleteTx(t)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10}>
                  <Empty>No transactions found</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
