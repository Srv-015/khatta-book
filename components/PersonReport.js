'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './DataProvider';
import { fmtDate, money } from '@/lib/calc';
import { buildEntries, filterEntries, fmtTime, personNames, personTotals } from '@/lib/report';

const PAGE = 30; // cards rendered per chunk, so very long histories stay smooth

const Tile = ({ label, value, tone = '' }) => (
  <div className="rounded-xl border border-bd bg-bg p-3">
    <div className="text-xs text-mu">{label}</div>
    <div className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</div>
  </div>
);

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading entries">
      {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl border border-bd bg-bg" />)}
    </div>
  );
}

function FlipCard({ e }) {
  const { notify } = useData();
  const [on, setOn] = useState(false);
  const given = e.kind === 'given';
  const hasNotes = !!(e.notes || e.extraNotes);
  // With notes: flip. Without notes: stay as is and show the short "No Notes Available" popup.
  const activate = () => (hasNotes ? setOn((v) => !v) : notify('No Notes Available', 2000));
  const onKey = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
  };
  const label = `${given ? 'Given' : 'Received'} ${money(e.amount)} on ${fmtDate(e.date)}.`;
  return (
    <div
      className={`flip ${on ? 'on' : ''}`} role="button" tabIndex={0} onClick={activate} onKeyDown={onKey}
      aria-pressed={hasNotes ? on : undefined}
      aria-label={hasNotes ? `${label} ${on ? 'Showing notes, press to flip back' : 'Press to show notes'}` : `${label} No notes`}
      data-testid="entry-card" data-kind={e.kind} data-has-notes={hasNotes}
    >
      <div className="flip-inner">
        <div className="flip-face card min-h-[9rem]" aria-hidden={hasNotes ? on : undefined}>
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${given ? 'bg-inb text-inf' : 'bg-okb text-ok'}`}>{given ? 'Given' : 'Received'}</span>
            <span className="text-xs text-mu">{given ? e.id : `${e.id} · ${e.ref}`}</span>
          </div>
          <div className={`mt-2 text-2xl font-semibold ${given ? '' : 'text-ok'}`}>{money(e.amount)}</div>
          <div className="mt-1 text-sm">{fmtDate(e.date)} · {fmtTime(e.time)}</div>
          {e.reason && <div className="mt-1 truncate text-xs text-mu">{e.reason}</div>}
          {e.allocations?.length > 1 && (
            <div className="mt-1 text-xs text-mu">{e.allocations.map((a) => `${a.tid} ${money(a.amount)}`).join(' · ')}</div>
          )}
          {hasNotes && <div className="mt-3 text-xs text-mu">Tap to see notes</div>}
        </div>

        {hasNotes && (
          <div className="flip-face flip-back card min-h-[9rem]" aria-hidden={!on}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-mu">Notes</span>
              <span className="text-xs text-mu">{e.id}</span>
            </div>
            <div className="mt-2 space-y-2 text-sm">
              {e.notes && <p className="whitespace-pre-wrap break-words">{e.notes}</p>}
              {e.extraNotes && (
                <div>
                  <div className="text-xs text-mu">Repayment notes</div>
                  <p className="whitespace-pre-wrap break-words">{e.extraNotes}</p>
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-mu">Tap to flip back</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PersonReport() {
  const { tx, rp, people, loading } = useData();
  const [person, setPerson] = useState('');
  const [kind, setKind] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef(null);

  const names = useMemo(() => personNames(tx, people), [tx, people]);
  const all = useMemo(() => (person ? buildEntries(tx, rp, person) : []), [tx, rp, person]);
  const list = useMemo(() => filterEntries(all, kind), [all, kind]);
  const totals = useMemo(() => (person ? personTotals(tx, person) : null), [tx, person]);

  useEffect(() => setLimit(PAGE), [person, kind]);

  // load the next chunk shortly before the end of the list scrolls into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= list.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([x]) => x.isIntersecting && setLimit((l) => Math.min(l + PAGE, list.length)), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, list.length]);

  const seg = (k, label) => (
    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`btn btn-sm ${kind === k ? 'btn-p' : ''}`}>{label}</button>
  );

  return (
    <section className="card" aria-labelledby="person-report-title">
      <h3 id="person-report-title" className="mb-2 text-sm font-semibold">Person report</h3>
      <label className="block text-sm text-mu">
        Person
        <select className="input mt-1" value={person} onChange={(e) => setPerson(e.target.value)} disabled={loading}>
          <option value="">{loading ? 'Loading people…' : names.length ? 'Select a person' : 'No people yet'}</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      {person && totals && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="Total given" value={money(totals.given)} />
            <Tile label="Total received" value={money(totals.received)} tone="text-ok" />
            <Tile label="Outstanding" value={money(totals.outstanding)} tone={totals.outstanding > 0 ? 'text-er' : ''} />
            <Tile label="Loans" value={totals.loans} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {seg('all', `All (${all.length})`)}
            {seg('given', `Given (${all.filter((e) => e.kind === 'given').length})`)}
            {seg('received', `Received (${all.filter((e) => e.kind === 'received').length})`)}
          </div>

          <div className="mt-3" data-testid="entry-list">
            {list.length === 0 ? (
              <div className="py-6 text-center text-sm text-mu">No entries to show</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.slice(0, limit).map((e) => <FlipCard key={e.key} e={e} />)}
                </div>
                <div className="mt-3 text-center text-xs text-mu" aria-live="polite">
                  Showing {Math.min(limit, list.length)} of {list.length}
                </div>
                {limit < list.length && (
                  <div ref={sentinel} className="mt-2 flex flex-col items-center gap-2 py-2">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-bd border-t-ac" role="status" aria-label="Loading more entries" />
                    <button className="btn btn-sm" onClick={() => setLimit((l) => Math.min(l + PAGE, list.length))}>Load more</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!person && loading && <div className="mt-4"><Skeleton /></div>}
      {!person && !loading && names.length > 0 && <p className="mt-3 text-sm text-mu">Pick a person to see every loan and repayment with date, time and notes.</p>}
    </section>
  );
}
