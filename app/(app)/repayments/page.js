'use client';
import { useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { PersonDetail, RepaymentForm, TxDetail, useActions } from '@/components/forms';
import { Empty } from '@/components/ui';
import { fmtDate, money } from '@/lib/calc';
import { groupPayments } from '@/lib/payments';

export default function Repayments() {
  const { tx, rp, loading, show } = useData();
  const { askDeleteRp } = useActions();
  const rows = useMemo(() => groupPayments(rp, tx), [rp, tx]); // one line per payment
  if (loading) return <Empty>Loading…</Empty>;
  const applied = (g) => g.allocations.map((a) => `${a.tid} ${money(a.amount)}`).join(' · ');
  const open = (g) => show(g.allocations.length > 1 ? <PersonDetail name={g.person} /> : <TxDetail tid={g.allocations[0].tid} />);
  return (
    <>
      <div className="mb-3">
        <button className="btn btn-p" onClick={() => show(<RepaymentForm />)}>
          + Record repayment
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((g) => (
          <div key={g.key} className="card">
            <div className="flex justify-between gap-2">
              <div className="font-semibold">
                {g.person}
                <div className="text-xs font-normal text-mu">
                  {g.id} · {fmtDate(g.date)} {g.time}
                </div>
              </div>
              <div className="font-semibold">{money(g.amount)}</div>
            </div>
            <div className="mt-1 text-xs text-mu">{applied(g)}</div>
            {g.notes && <div className="mt-1 text-sm text-mu">{g.notes}</div>}
            <div className="mt-2 flex gap-2">
              <button className="btn btn-sm" onClick={() => open(g)}>
                {g.allocations.length > 1 ? 'View person' : 'View loan'}
              </button>
              <button className="btn btn-sm" onClick={() => askDeleteRp(g.rows[0])}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {!rows.length && <Empty>No repayments recorded</Empty>}
      </div>

      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Applied to</th>
              <th>Person</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Time</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <td>{g.id}</td>
                <td>
                  <button className="text-ac" onClick={() => open(g)}>
                    {g.allocations.length > 1 ? applied(g) : g.allocations[0].tid}
                  </button>
                </td>
                <td>{g.person}</td>
                <td>{money(g.amount)}</td>
                <td>{fmtDate(g.date)}</td>
                <td>{g.time}</td>
                <td>{g.notes}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => askDeleteRp(g.rows[0])}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8}>
                  <Empty>No repayments recorded</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
