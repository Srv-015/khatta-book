import mongoose from 'mongoose';

const globalCache = globalThis;
globalCache._mongo ??= { conn: null, promise: null };

// Messages here are shown on the login page, so they say what to fix and never include
// the connection string. The full technical error is printed in the terminal only.
export default async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Create .env.local in the project folder (copy .env.example), add the line, then restart npm run dev.');
  }

  const cache = globalCache._mongo;
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    console.log('Connecting to MongoDB...');
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
  }

  try {
    cache.conn = await cache.promise;
    console.log('MongoDB connected. Database:', mongoose.connection.name);
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    cache.conn = null;
    console.error('MongoDB connection error:', { name: error.name, message: error.message, cause: error.cause?.message });
    throw new Error('Cannot reach MongoDB. Check that MONGODB_URI is correct, your IP is allowed in Atlas Network Access, and your internet works.');
  }
}
