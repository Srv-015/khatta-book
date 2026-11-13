import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.log('Usage: npm run reset-password -- "new-password-8+chars"');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
const r = await mongoose.connection.collection('users').updateOne({}, { $set: { passwordHash: await bcrypt.hash(pw, 12) } });
console.log(r.matchedCount ? 'Password updated.' : 'No user found.');
await mongoose.disconnect();
