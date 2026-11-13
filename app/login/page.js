'use client';
import { useEffect, useState } from 'react';

export default function Login() {
  const [hasUser, setHasUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json().then((j) => (r.ok ? setHasUser(j.hasUser) : setErr(j.error))))
      .catch(() => setErr('Cannot reach the server'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/auth/' + (hasUser ? 'login' : 'register'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || 'Something went wrong');
    location.href = '/';
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card grid w-full max-w-sm gap-3 p-6">
        <h1 className="font-serif text-2xl font-semibold text-ac">Khatta Book</h1>
        <p className="text-sm text-mu">
          {hasUser === null ? 'Connecting…' : hasUser ? 'Sign in to continue.' : 'First run: create your account.'}
        </p>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input className="input" type="password" placeholder={hasUser ? 'Password' : 'Password (8+ characters)'} value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-er">{err}</p>}
        <button className="btn btn-p" disabled={hasUser === null}>{hasUser ? 'Sign in' : 'Create account'}</button>
      </form>
    </div>
  );
}
