import ExcelJS from 'exceljs';
import { handle } from '@/lib/api';
import { Transaction, Repayment } from '@/lib/models';
import { durationLabel, enrich } from '@/lib/calc';

const TX = ['Transaction ID', 'Person’s Name', 'Amount Given', 'Total Amount Repaid', 'Outstanding Balance', 'Transaction Date', 'Transaction Time', 'Expected Repayment', 'Expected Repayment From', 'Expected Repayment To', 'Status', 'Description', 'Notes', 'Expected Repayment Notes'];
const RP = ['Repayment ID', 'Transaction ID', 'Person’s Name', 'Amount Repaid', 'Repayment Date', 'Repayment Time', 'Notes'];
const PP = ['Person’s Name', 'Total Money Given', 'Total Money Repaid', 'Outstanding Balance'];
const LABEL = { Partial: 'Partially Paid', Settled: 'Fully Settled' };
const asDate = (s) => (s ? new Date(s + 'T00:00:00Z') : null);

// ?format=xlsx|csv  &type=tx|rp (csv only)  &ids=T-0001,T-0002  &from=YYYY-MM-DD  &to=YYYY-MM-DD
export const GET = handle(async (req, _c, uid) => {
  const q = new URL(req.url).searchParams;
  const ids = q.get('ids')?.split(',').filter(Boolean);
  const from = q.get('from'), to = q.get('to');
  const [T, R] = await Promise.all([
    Transaction.find({ userId: uid }).sort({ seq: 1 }).lean(),
    Repayment.find({ userId: uid }).sort({ seq: 1 }).lean(),
  ]);
  const tx = enrich(T, R).filter((t) => (!ids || ids.includes(t.tid)) && (!from || t.date >= from) && (!to || t.date <= to));
  const nm = Object.fromEntries(tx.map((t) => [t.tid, t.name]));
  const A = tx.map((t) => [t.tid, t.name, t.amount, t.paid, t.balance, t.date, t.time, durationLabel(t), t.dueMin, t.dueMax, LABEL[t.status] || t.status, t.reason, t.notes, t.dueNotes || '']);
  const B = R.filter((r) => nm[r.tid]).map((r) => [r.rid, r.tid, nm[r.tid], r.amount, r.date, r.time, r.notes]);
  const P = {};
  tx.forEach((t) => { const p = (P[t.name] ??= [t.name, 0, 0, 0]); p[1] += t.amount; p[2] += t.paid; p[3] += t.balance; });
  const stamp = new Date().toISOString().slice(0, 10);

  if (q.get('format') === 'csv') {
    const rp = q.get('type') === 'rp';
    const rows = rp ? [RP, ...B] : [TX, ...A];
    const body = '\ufeff' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return new Response(body, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="khatta-${rp ? 'repayments' : 'transactions'}-${stamp}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  const sheet = (name, head, rows, { money = [], dates = [], w }) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = head.map((h, i) => ({ header: h, width: w[i] }));
    rows.forEach((r) => ws.addRow(r.map((v, i) => (dates.includes(i) ? asDate(v) : v))));
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F5C' } };
    money.forEach((i) => (ws.getColumn(i + 1).numFmt = '"₹"#,##0.00'));
    dates.forEach((i) => (ws.getColumn(i + 1).numFmt = 'dd-mmm-yyyy'));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } };
  };
  sheet('Transaction Summary', TX, A, { money: [2, 3, 4], dates: [5, 8, 9], w: [14, 22, 15, 18, 18, 16, 14, 18, 22, 22, 14, 32, 32, 32] });
  sheet('Repayment History', RP, B, { money: [3], dates: [4], w: [14, 14, 22, 15, 16, 15, 32] });
  sheet('People Summary', PP, Object.values(P), { money: [1, 2, 3], w: [24, 18, 18, 18] });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="khatta-book-${stamp}.xlsx"`,
    },
  });
});
