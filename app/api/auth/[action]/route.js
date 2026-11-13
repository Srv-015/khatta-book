import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/db';
import { User } from '@/lib/models';
import { sign, COOKIE } from '@/lib/token';
import { currentUserId } from '@/lib/auth';

const fails = new Map();
const bad = (m, s = 400) => Response.json({ error: m }, { status: s });
const setCookie = (t) =>
  cookies().set(COOKIE, t, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 60 * 60 * 24 * 7 });

export async function GET() {
  try {
    await dbConnect();
    return Response.json({ hasUser: (await User.countDocuments()) > 0 });
  } catch (e) {
    return bad(e.message, 500);
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const a = params.action;
    if (a === 'logout') { cookies().delete(COOKIE); return Response.json({ ok: true }); }
    const b = await req.json().catch(() => ({}));

    if (a === 'register') {
      if ((await User.countDocuments()) > 0) return bad('Registration is closed', 403);
      const email = String(b.email || '').trim().toLowerCase();
      const pw = String(b.password || '');
      if (!/^\S+@\S+\.\S+$/.test(email)) return bad('Enter a valid email');
      if (pw.length < 8) return bad('Password must be at least 8 characters');
      const u = await User.create({ email, passwordHash: await bcrypt.hash(pw, 12) });
      setCookie(await sign(String(u._id)));
      return Response.json({ ok: true });
    }

    if (a === 'login') {
      const email = String(b.email || '').trim().toLowerCase();
      const f = fails.get(email) || { n: 0, t: 0 };
      if (f.n >= 5 && Date.now() - f.t < 60000) return bad('Too many attempts. Wait a minute.', 429);
      const u = await User.findOne({ email });
      if (!u || !(await bcrypt.compare(String(b.password || ''), u.passwordHash))) {
        fails.set(email, { n: f.n + 1, t: Date.now() });
        return bad('Wrong email or password', 401);
      }
      fails.delete(email);
      setCookie(await sign(String(u._id)));
      return Response.json({ ok: true });
    }

    if (a === 'password') {
      const uid = await currentUserId();
      if (!uid) return bad('Unauthorized', 401);
      const u = await User.findById(uid);
      if (!u || !(await bcrypt.compare(String(b.current || ''), u.passwordHash))) return bad('Current password is wrong');
      if (String(b.next || '').length < 8) return bad('New password must be at least 8 characters');
      u.passwordHash = await bcrypt.hash(b.next, 12);
      await u.save();
      return Response.json({ ok: true });
    }
    return bad('Not found', 404);
  } catch (e) {
    return bad(e.message || 'Server error', 500);
  }
}
