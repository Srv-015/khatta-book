'use client';
import { useData } from '@/components/DataProvider';
import { PersonDetail, PersonForm } from '@/components/forms';
import { Empty } from '@/components/ui';
import { money } from '@/lib/calc';

export default function People() {
  const { tx, people, loading, show } = useData();
  if (loading) return <Empty>Loading…</Empty>;
  const rows = people.map((p) => {
    const L = tx.filter((t) => t.name === p.name);
    const g = L.reduce((a, t) => a + t.amount, 0), r = L.reduce((a, t) => a + t.paid, 0);
    return { ...p, g, r, o: g - r };
  });
  return (
    <>
      <div className="mb-3"><button className="btn" onClick={() => show(<PersonForm />)}>+ Add person</button></div>

      <div className="space-y-2 md:hidden">
        {rows.map((p) => (
          <div key={p._id} className="card cursor-pointer active:bg-ac2" onClick={() => show(<PersonDetail name={p.name} />)}>
            <div className="flex justify-between gap-2">
              <div className="font-semibold">{p.name}<div className="text-xs font-normal text-mu">{p.phone || 'No contact'}</div></div>
              <div className="text-right"><div className="font-semibold">{money(p.o)}</div><div className="text-xs text-mu">outstanding</div></div>
            </div>
            <div className="mt-2 text-xs text-mu">Given {money(p.g)} · Repaid {money(p.r)}</div>
          </div>
        ))}
        {!rows.length && <Empty>No people yet</Empty>}
      </div>

      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Contact</th><th>Given</th><th>Repaid</th><th>Outstanding</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td><button className="font-semibold text-ac" onClick={() => show(<PersonDetail name={p.name} />)}>{p.name}</button></td>
                <td>{p.phone || '–'}</td><td>{money(p.g)}</td><td>{money(p.r)}</td><td><b>{money(p.o)}</b></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><Empty>No people yet</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
