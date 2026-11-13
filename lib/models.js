import mongoose from 'mongoose';
const { Schema, models, model } = mongoose;
const uid = { type: Schema.Types.ObjectId, index: true, required: true };

const userS = new Schema({ email: { type: String, unique: true, lowercase: true }, passwordHash: String }, { timestamps: true });

const personS = new Schema({ userId: uid, name: String, phone: { type: String, default: '' } });
personS.index({ userId: 1, name: 1 }, { unique: true });

// Dates are stored as plain strings (YYYY-MM-DD, HH:mm) so time zones never shift them.
const txS = new Schema({
  userId: uid, seq: Number, tid: String, name: String, amount: Number,
  date: String, time: String, reason: String, notes: String,
  // Expected repayment. dueDate mirrors dueMax; dueTime is legacy (no longer written or used).
  repayDuration: { type: String, default: '' }, dueMin: { type: String, default: '' }, dueMax: { type: String, default: '' },
  dueDate: { type: String, default: '' }, dueTime: String, dueNotes: { type: String, default: '' },
}, { timestamps: true });
txS.index({ userId: 1, tid: 1 }, { unique: true });

const rpS = new Schema({
  userId: uid, seq: Number, rid: String, tid: String, amount: Number,
  date: String, time: String, notes: String,
}, { timestamps: true });
rpS.index({ userId: 1, rid: 1 }, { unique: true });

export const User = models.User || model('User', userS, 'users');
export const Person = models.Person || model('Person', personS, 'people');
export const Transaction = models.Transaction || model('Transaction', txS, 'transactions');
export const Repayment = models.Repayment || model('Repayment', rpS, 'repayments');
