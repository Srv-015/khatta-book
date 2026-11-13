'use client';
import { useState } from 'react';
import { useData } from '@/components/DataProvider';
import { Confirm } from '@/components/forms';
import { Panel } from '@/components/ui';
import { api } from '@/lib/client';

export default function ExportPage() {
  const { show, close, reload, notify } = useData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = `/api/export?format=xlsx&from=${from}&to=${to}`;

  async function restore(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let data;
    try {
      data = JSON.parse(await f.text());
    } catch {
      return notify('That is not a valid backup file');
    }
    show(
      <Confirm
        label="Replace everything"
        message="This replaces ALL current records with the backup. Download a fresh backup first if you are unsure."
        onYes={async () => {
          try {
            await api('/api/backup', { method: 'POST', body: data });
            await reload();
            notify('Backup restored');
          } catch (err) {
            notify(err.message);
          }
          close();
        }}
      />
    );
  }
  async function importFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    const r = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return notify(j.error || 'Import failed');
    await reload();
    notify(`Imported ${j.transactions} transactions and ${j.repayments} repayments`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel title="Excel & CSV export">
        <p className="mb-3 text-sm text-mu">
          Excel has three sheets: Transaction Summary, Repayment History and People Summary.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <a className="btn btn-p" href="/api/export?format=xlsx">
            Export all (.xlsx)
          </a>
          <a className="btn" href="/api/export?format=csv&type=tx">
            Transactions CSV
          </a>
          <a className="btn" href="/api/export?format=csv&type=rp">
            Repayments CSV
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-mu">
            From
            <input
              className="input mt-1"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm text-mu">
            To
            <input
              className="input mt-1"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <a className="btn col-span-2" href={range}>
            Export date range (.xlsx)
          </a>
        </div>
        <p className="mt-3 text-xs text-mu">
          To export specific records, tick them on the Transactions page.
        </p>
      </Panel>
      <Panel title="Backup, restore & import">
        <p className="mb-3 text-sm text-mu">
          Download a backup file regularly and keep a copy somewhere other than this PC.
        </p>
        <a className="btn btn-p mb-4" href="/api/backup">
          Download backup (.json)
        </a>
        <label className="mb-3 block text-sm text-mu">
          Restore from backup (.json)
          <input className="input mt-1" type="file" accept=".json" onChange={restore} />
        </label>
        <label className="block text-sm text-mu">
          Import exported Excel / CSV (adds missing records)
          <input className="input mt-1" type="file" accept=".xlsx,.csv" onChange={importFile} />
        </label>
      </Panel>
    </div>
  );
}
