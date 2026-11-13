// Raw safety copy of every collection -> ./backups/khatta-raw-YYYY-MM-DD.json
// (For a restorable backup use Reports & Export > Download backup in the app.)
import mongoose from 'mongoose';
import fs from 'node:fs';

await mongoose.connect(process.env.MONGODB_URI);
const out = { exportedAt: new Date().toISOString() };
for (const c of ['users', 'people', 'transactions', 'repayments'])
  out[c] = await mongoose.connection.collection(c).find({}).toArray();
fs.mkdirSync('backups', { recursive: true });
const file = `backups/khatta-raw-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('Saved', file);
await mongoose.disconnect();
