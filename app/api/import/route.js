import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { handle, HttpError, ensurePerson } from '@/lib/api';
import { Transaction, Repayment } from '@/lib/models';
import { DURATIONS, computeDue } from '@/lib/calc';
import { planImportedPayIds, remapImportedPayIds } from '@/lib/payments';
import { bumpRepaymentCounter, reserveRepaymentSeq } from '@/lib/paymentsDb';

const val = (c) => {
  if (c == null) return '';
  if (c instanceof Date) return c;
  if (typeof c === 'object') {
    if ('result' in c) return val(c.result);
    if (c.richText) return c.richText.map((x) => x.text).join('');
    if ('text' in c) return c.text;
  }
  return c;
};
const ds = (v) =>
  v instanceof Date
    ? v.toISOString().slice(0, 10)
    : String(v || '')
        .trim()
        .slice(0, 10);
const ts = (v) =>
  v instanceof Date
    ? v.toISOString().slice(11, 16)
    : String(v || '')
        .trim()
        .slice(0, 5);
const str = (v) => String(v ?? '').trim();

// Accepts the .xlsx or .csv files produced by this app's export. Existing IDs are skipped.
export const POST = handle(async (req, _c, uid) => {
  const file = (await req.formData()).get('file');
  if (!file || typeof file === 'string') throw new HttpError('Choose a file');
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    if (file.name.toLowerCase().endsWith('.csv')) await wb.csv.read(Readable.from(buf));
    else await wb.xlsx.load(buf);
  } catch {
    throw new HttpError('Could not read that file');
  }

  const txRows = [],
    rpRows = [];
  wb.eachSheet((ws) => {
    const head = (ws.getRow(1).values || []).slice(1).map((v) => str(val(v)));
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const o = {};
      head.forEach((h, i) => (o[h] = val(row.getCell(i + 1).value)));
      if ('Repayment ID' in o) rpRows.push(o);
      else if ('Transaction ID' in o && 'Amount Given' in o) txRows.push(o);
    });
  });

  const haveT = new Set(
    (await Transaction.find({ userId: uid }).select('tid').lean()).map((t) => t.tid)
  );
  const haveR = new Set(
    (await Repayment.find({ userId: uid }).select('rid').lean()).map((r) => r.rid)
  );
  let nt = 0,
    nr = 0;
  for (const o of txRows) {
    const tid = str(o['Transaction ID']),
      name = str(o['Person’s Name']),
      amount = Number(o['Amount Given']);
    if (!tid || !name || !(amount > 0) || haveT.has(tid)) continue;
    const date = ds(o['Transaction Date']);
    // New files carry "Expected Repayment" (+ From/To); files from older versions only have a date.
    const label = str(o['Expected Repayment']);
    const found = DURATIONS.find((d) => d.label === label || d.key === label);
    const custom =
      ds(o['Expected Repayment To']) ||
      ds(o['Expected Repayment From']) ||
      ds(o['Expected Repayment Date']);
    let due;
    try {
      due = computeDue({
        duration: found?.key || (custom ? 'others' : ''),
        date,
        custom,
        notes: str(o['Expected Repayment Notes']),
      });
    } catch {
      due = computeDue({
        duration: custom ? 'others' : '',
        date,
        custom,
        notes: str(o['Expected Repayment Notes']),
      });
    }
    await Transaction.create({
      userId: uid,
      tid,
      seq: parseInt(tid.replace(/\D/g, ''), 10) || 0,
      name,
      amount,
      date,
      time: ts(o['Transaction Time']),
      reason: str(o['Description']),
      notes: str(o['Notes']),
      ...due,
    });
    haveT.add(tid);
    nt++;
    await ensurePerson(uid, name);
  }
  const candidates = [];
  for (const o of rpRows) {
    const rid = str(o['Repayment ID']),
      tid = str(o['Transaction ID']),
      amount = Number(o['Amount Repaid']);
    if (!rid || !haveT.has(tid) || !(amount > 0) || haveR.has(rid)) continue;
    haveR.add(rid); // also skips a repeated row inside the same file
    candidates.push({
      rid,
      tid,
      amount,
      date: ds(o['Repayment Date']),
      time: ts(o['Repayment Time']),
      notes: str(o['Notes']),
      payId: str(o['Payment ID']),
      payTotal: Number(o['Payment Total']) || 0,
    });
  }
  if (candidates.length) {
    const seqOf = (rid) => parseInt(rid.replace(/\D/g, ''), 10) || 0;
    // keep the repayment counter ahead of the numbers being imported, so later payments never reuse them
    await bumpRepaymentCounter(uid, Math.max(...candidates.map((c) => seqOf(c.rid))));
    const [stored, loans] = await Promise.all([
      Repayment.find({ userId: uid }).select('rid tid payId date time notes').lean(),
      Transaction.find({ userId: uid }).select('tid name').lean(),
    ]);
    // a Payment ID that already means a different payment here gets a fresh one (it would merge and be deleted together)
    const plan = planImportedPayIds(
      candidates,
      stored,
      Object.fromEntries(loans.map((l) => [l.tid, l.name]))
    );
    const first = plan.collisions.length
      ? await reserveRepaymentSeq(uid, plan.collisions.length)
      : 0;
    const payIds = remapImportedPayIds(
      plan,
      plan.collisions.map((_, i) => `R-${String(first + i).padStart(4, '0')}`)
    );
    for (const c of candidates) {
      await Repayment.create({
        userId: uid,
        rid: c.rid,
        tid: c.tid,
        amount: c.amount,
        seq: seqOf(c.rid),
        date: c.date,
        time: c.time,
        notes: c.notes,
        payId: payIds.get(c.rid) || '',
      });
      nr++;
    }
  }
  return { transactions: nt, repayments: nr };
});
