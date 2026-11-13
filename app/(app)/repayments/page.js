'use client';
import { useData } from '@/components/DataProvider';
import { RepaymentForm, TxDetail, useActions } from '@/components/forms';
import { Empty } from '@/components/ui';
import { fmtDate, money } from '@/lib/calc';

export default function Repayments() {
  const { tx, rp, loading, show } = useData();
  const { askDeleteRp } = useActions();
  if (loading) return <Empty>Loading…</Empty>;
  const nm = Object.fromEntries(tx.map((t) => [t.tid, t.name]));
  const rows = [...rp].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  return (
    <>
      <div className="mb-3">
        <button className="btn btn-p" onClick={() => show(<RepaymentForm />)}>
          + Record repayment
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r._id} className="card">
            <div className="flex justify-between gap-2">
              <div className="font-semibold">
                {nm[r.tid]}
                <div className="text-xs font-normal text-mu">
                  {r.rid} · {r.tid} · {fmtDate(r.date)} {r.time}
                </div>
              </div>
              <div className="font-semibold">{money(r.amount)}</div>
            </div>
            {r.notes && <div className="mt-1 text-sm text-mu">{r.notes}</div>}
            <div className="mt-2 flex gap-2">
              <button className="btn btn-sm" onClick={() => show(<TxDetail tid={r.tid} />)}>
                View loan
              </button>
              <button className="btn btn-sm" onClick={() => askDeleteRp(r)}>
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
              <th>Transaction</th>
              <th>Person</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Time</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.rid}</td>
                <td>
                  <button className="text-ac" onClick={() => show(<TxDetail tid={r.tid} />)}>
                    {r.tid}
                  </button>
                </td>
                <td>{nm[r.tid]}</td>
                <td>{money(r.amount)}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.time}</td>
                <td>{r.notes}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => askDeleteRp(r)}>
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
