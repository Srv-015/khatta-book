'use client';
import { useState } from 'react';
import { useData } from './DataProvider';
import { Badge, Empty, TxList } from './ui';
import { api } from '@/lib/client';
import { DURATIONS, countdown, dueRange, dueText, durationLabel, fmtDate, money, nowTime, todayStr } from '@/lib/calc';

const Field = ({ label, className = '', ...p }) => (
  <label className={`block text-sm text-mu ${className}`}>
    {label}
    <input className="input mt-1" {...p} />
  </label>
);
const KV = ({ k, children }) => (
  <div>
    <div className="text-xs text-mu">{k}</div>
    {children}
  </div>
);

function useSave() {
  const { reload, close, notify } = useData();
  const [err, setErr] = useState('');
  const run = async (fn, msg) => {
    try {
      await fn();
      close();
      notify(msg);
      reload().catch(() => notify('Saved, but could not refresh the list. Pull to reload.'));
    } catch (e) {
      setErr(e.message);
    }
  };
  return [err, run];
}
const Footer = ({ err, close, label = 'Save' }) => (
  <div className="col-span-full">
    {err && <p className="mb-2 text-sm text-er">{err}</p>}
    <div className="flex justify-end gap-2">
      <button type="button" className="btn" onClick={close}>
        Cancel
      </button>
      <button className="btn btn-p">{label}</button>
    </div>
  </div>
);

export function Confirm({ message, label = 'Delete', onYes }) {
  const { close } = useData();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p>{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button
          className="btn btn-d"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onYes();
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

export function useActions() {
  const { show, reload, close, notify } = useData();
  return {
    askDeleteTx: (t) =>
      show(
        <Confirm
          message={`Delete ${t.tid} (${t.name}) and all its repayments? This cannot be undone.`}
          onYes={async () => {
            await api(`/api/transactions/${t._id}`, { method: 'DELETE' });
            close();
            notify('Transaction deleted');
            await reload();
          }}
        />
      ),
    askDeleteRp: (r) =>
      show(
        <Confirm
          message={`Delete repayment ${r.rid}? This cannot be undone.`}
          onYes={async () => {
            await api(`/api/repayments/${r._id}`, { method: 'DELETE' });
            close();
            notify('Repayment deleted');
            await reload();
          }}
        />
      ),
  };
}

export function TxForm({ tx, name = '' }) {
  const { people, close } = useData();
  const [err, run] = useSave();
  const [f, setF] = useState(
    tx
      ? { ...tx, dueCustom: tx.repayDuration === 'others' ? tx.dueMax || '' : '', dueNotes: tx.dueNotes || '' }
      : {
          name,
          amount: '',
          date: todayStr(),
          time: nowTime(),
          reason: '',
          repayDuration: '',
          dueCustom: '',
          dueNotes: '',
          notes: '',
        }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // live preview; the server recalculates the same range on save
  const range = f.repayDuration && f.repayDuration !== 'others' ? dueRange(f.repayDuration, f.date) : null;
  const submit = (e) => {
    e.preventDefault();
    run(
      () =>
        api(tx ? `/api/transactions/${tx._id}` : '/api/transactions', {
          method: tx ? 'PUT' : 'POST',
          body: f,
        }),
      'Saved'
    );
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <h3 className="col-span-full text-lg font-semibold">
        {tx ? `Edit ${tx.tid}` : 'New transaction'}
      </h3>
      <label className="col-span-full block text-sm text-mu">
        Person’s name
        <input
          className="input mt-1"
          list="people-list"
          value={f.name}
          onChange={set('name')}
          required
        />
        <datalist id="people-list">
          {people.map((p) => (
            <option key={p._id} value={p.name} />
          ))}
        </datalist>
      </label>
      <Field
        label="Amount given (₹)"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        value={f.amount}
        onChange={set('amount')}
        required
      />
      <span className="hidden sm:block" />
      <Field label="Transaction date" type="date" value={f.date} onChange={set('date')} required />
      <Field label="Transaction time" type="time" value={f.time} onChange={set('time')} />
      <label className="col-span-full block text-sm text-mu">
        Expected repayment
        <select className="input mt-1" value={f.repayDuration || ''} onChange={set('repayDuration')}>
          <option value="">Select (optional)</option>
          {DURATIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        {range && (
          <span className="mt-1 block text-xs">
            Expected between {fmtDate(range.min)} and {fmtDate(range.max)}
          </span>
        )}
      </label>
      {f.repayDuration === 'others' && (
        <>
          <Field
            className="col-span-full"
            label="Custom repayment date (optional)"
            type="date"
            value={f.dueCustom}
            onChange={set('dueCustom')}
          />
          <label className="col-span-full block text-sm text-mu">
            Custom notes (optional)
            <textarea className="input mt-1" rows={2} value={f.dueNotes} onChange={set('dueNotes')} />
          </label>
        </>
      )}
      <Field
        className="col-span-full"
        label="Reason / description"
        value={f.reason}
        onChange={set('reason')}
      />
      <label className="col-span-full block text-sm text-mu">
        Notes (optional)
        <textarea className="input mt-1" rows={2} value={f.notes} onChange={set('notes')} />
      </label>
      <Footer err={err} close={close} />
    </form>
  );
}

export function RepaymentForm({ tid, name }) {
  const { tx, people, close } = useData();
  const [err, run] = useSave();
  const t0 = tx.find((t) => t.tid === tid);
  const [person, setPerson] = useState(t0?.name || name || people[0]?.name || '');
  const [f, setF] = useState({
    tid: t0?.tid || '',
    amount: '',
    date: todayStr(),
    time: nowTime(),
    notes: '',
  });
  const open = tx.filter((t) => t.name === person && t.balance > 0);
  const sel = open.find((t) => t.tid === f.tid) || open[0];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    run(
      () => api('/api/repayments', { method: 'POST', body: { ...f, tid: sel?.tid } }),
      'Repayment recorded'
    );
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <h3 className="col-span-full text-lg font-semibold">Record repayment</h3>
      <label className="block text-sm text-mu">
        Person
        <select className="input mt-1" value={person} onChange={(e) => setPerson(e.target.value)}>
          {people.map((p) => (
            <option key={p._id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-mu">
        Related transaction
        <select className="input mt-1" value={sel?.tid || ''} onChange={set('tid')}>
          {open.length ? (
            open.map((t) => (
              <option key={t.tid} value={t.tid}>
                {t.tid} · {t.reason || 'Loan'} · balance {money(t.balance)}
              </option>
            ))
          ) : (
            <option value="">No open transactions</option>
          )}
        </select>
      </label>
      <Field
        label="Amount repaid (₹)"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        max={sel?.balance}
        placeholder={sel ? `Balance ${money(sel.balance)}` : ''}
        value={f.amount}
        onChange={set('amount')}
        required
      />
      <span className="hidden sm:block" />
      <Field label="Repayment date" type="date" value={f.date} onChange={set('date')} required />
      <Field label="Repayment time" type="time" value={f.time} onChange={set('time')} />
      <label className="col-span-full block text-sm text-mu">
        Notes (optional)
        <textarea className="input mt-1" rows={2} value={f.notes} onChange={set('notes')} />
      </label>
      <Footer err={err} close={close} />
    </form>
  );
}

export function PersonForm({ name }) {
  const { people, close } = useData();
  const [err, run] = useSave();
  const [f, setF] = useState({
    name: name || '',
    phone: people.find((p) => p.name === name)?.phone || '',
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => api('/api/people', { method: 'PUT', body: f }), 'Saved');
      }}
      className="grid grid-cols-1 gap-3"
    >
      <h3 className="text-lg font-semibold">{name ? 'Edit contact' : 'Add person'}</h3>
      <Field
        label="Full name"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        readOnly={!!name}
        required
      />
      <Field
        label="Contact number (optional)"
        value={f.phone}
        onChange={(e) => setF({ ...f, phone: e.target.value })}
      />
      <Footer err={err} close={close} />
    </form>
  );
}

export function TxDetail({ tid }) {
  const { tx, rp, show, close } = useData();
  const { askDeleteTx, askDeleteRp } = useActions();
  const t = tx.find((x) => x.tid === tid);
  if (!t) return null;
  const R = rp.filter((r) => r.tid === tid);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">
          {t.tid} · {t.name}
        </h3>
        <Badge s={t.status} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <KV k="Amount given">{money(t.amount)}</KV>
        <KV k="Repaid">{money(t.paid)}</KV>
        <KV k="Remaining balance">
          <b>{money(t.balance)}</b>
        </KV>
        <KV k="Countdown">{countdown(t)}</KV>
        <KV k="Given on">
          {fmtDate(t.date)} {t.time}
        </KV>
        <KV k="Expected repayment">
          {durationLabel(t) || '–'}
          {t.dueMax && <div className="text-xs text-mu">{dueText(t)}</div>}
        </KV>
        {t.dueNotes && (
          <div className="col-span-2">
            <KV k="Repayment notes">{t.dueNotes}</KV>
          </div>
        )}
        <div className="col-span-2">
          <KV k="Reason">{t.reason || '–'}</KV>
        </div>
        <div className="col-span-2">
          <KV k="Notes">{t.notes || '–'}</KV>
        </div>
      </div>
      <div className="mb-1 text-sm font-semibold">Repayments</div>
      {R.length ? (
        <table className="tbl">
          <tbody>
            {R.map((r) => (
              <tr key={r._id}>
                <td>{r.rid}</td>
                <td>{money(r.amount)}</td>
                <td>
                  {fmtDate(r.date)} {r.time}
                </td>
                <td className="whitespace-normal">{r.notes}</td>
                <td className="print:hidden">
                  <button className="btn btn-sm" onClick={() => askDeleteRp(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No repayments yet</Empty>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2 print:hidden">
        <button className="btn" onClick={close}>
          Close
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn" onClick={() => askDeleteTx(t)}>
          Delete
        </button>
        <button className="btn" onClick={() => show(<TxForm tx={t} />)}>
          Edit
        </button>
        {t.balance > 0 && (
          <button className="btn btn-p" onClick={() => show(<RepaymentForm tid={t.tid} />)}>
            Record repayment
          </button>
        )}
      </div>
    </div>
  );
}

export function PersonDetail({ name }) {
  const { tx, people, show, close } = useData();
  const L = tx.filter((t) => t.name === name).sort((a, b) => b.date.localeCompare(a.date));
  const given = L.reduce((a, t) => a + t.amount, 0),
    paid = L.reduce((a, t) => a + t.paid, 0);
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">{name}</h3>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <KV k="Contact">{people.find((p) => p.name === name)?.phone || '–'}</KV>
        <KV k="Total given">{money(given)}</KV>
        <KV k="Total repaid">{money(paid)}</KV>
        <KV k="Outstanding">
          <b>{money(given - paid)}</b>
        </KV>
      </div>
      <div className="mb-1 text-sm font-semibold">Transaction history</div>
      <TxList items={L} onOpen={(t) => show(<TxDetail tid={t.tid} />)} empty="No transactions" />
      <div className="mt-4 flex flex-wrap justify-end gap-2 print:hidden">
        <button className="btn" onClick={close}>
          Close
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn" onClick={() => show(<PersonForm name={name} />)}>
          Edit contact
        </button>
        <button className="btn btn-p" onClick={() => show(<TxForm name={name} />)}>
          + New loan
        </button>
      </div>
    </div>
  );
}
