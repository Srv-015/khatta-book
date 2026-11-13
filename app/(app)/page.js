'use client';
import { useData } from '@/components/DataProvider';
import { TxDetail } from '@/components/forms';
import { Empty, Panel, Stat, TxList } from '@/components/ui';
import { daysBetween, money, todayStr } from '@/lib/calc';

export default function Dashboard() {
  const { tx, loading, show } = useData();
  if (loading) return <Empty>Loading…</Empty>;
  const sum = (a, k) => a.reduce((s, t) => s + t[k], 0);
  const open = tx.filter((t) => t.balance > 0);
  const over = open
    .filter((t) => t.status === 'Overdue')
    .sort((a, b) => a.dueMax.localeCompare(b.dueMax));
  const upcoming = open
    .filter((t) => t.status !== 'Overdue' && t.dueMax)
    .sort((a, b) => a.dueMax.localeCompare(b.dueMax));
  const soon = upcoming.filter((t) => daysBetween(todayStr(), t.dueMax) <= 3).length;
  const recent = [...tx]
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))
    .slice(0, 6);
  const biggest = [...open].sort((a, b) => b.balance - a.balance).slice(0, 6);
  const o = (t) => show(<TxDetail tid={t.tid} />);
  return (
    <>
      {(over.length > 0 || soon > 0) && (
        <div className="mb-4 rounded-xl bg-wab px-4 py-3 text-sm text-wa">
          {over.length > 0 &&
            `${over.length} overdue payment${over.length > 1 ? 's' : ''} (${money(sum(over, 'balance'))}). `}
          {soon > 0 && `${soon} due within 3 days.`}
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total money given" value={money(sum(tx, 'amount'))} />
        <Stat label="Total money received" value={money(sum(tx, 'paid'))} />
        <Stat label="Total outstanding" value={money(sum(tx, 'balance'))} />
        <Stat label="Total settled" value={tx.filter((t) => t.status === 'Settled').length} />
        <Stat label="Overdue payments" value={money(sum(over, 'balance'))} tone="text-er" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Overdue payments">
          <TxList items={over} onOpen={o} empty="Nothing overdue" />
        </Panel>
        <Panel title="Upcoming repayment dates">
          <TxList items={upcoming.slice(0, 6)} onOpen={o} empty="Nothing upcoming" />
        </Panel>
        <Panel title="Pending payments">
          <TxList items={biggest} onOpen={o} empty="No pending payments" />
        </Panel>
        <Panel title="Recent transactions">
          <TxList items={recent} onOpen={o} empty="No transactions yet" />
        </Panel>
      </div>
    </>
  );
}
