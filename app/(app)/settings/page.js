'use client';
import { useEffect, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { Panel } from '@/components/ui';
import { api } from '@/lib/client';

export default function Settings() {
  const { notify } = useData();
  const [dark, setDark] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [err, setErr] = useState('');
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);

  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch {}
  };
  async function changePw(e) {
    e.preventDefault();
    setErr('');
    try { await api('/api/auth/password', { method: 'POST', body: pw }); setPw({ current: '', next: '' }); notify('Password changed'); }
    catch (x) { setErr(x.message); }
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Appearance">
        <button className="btn" onClick={toggle}>Switch to {dark ? 'light' : 'dark'} mode</button>
      </Panel>
      <Panel title="Account">
        <form onSubmit={changePw} className="grid gap-2">
          <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          <input className="input" type="password" placeholder="New password (8+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          {err && <p className="text-sm text-er">{err}</p>}
          <div className="flex gap-2"><button className="btn btn-p">Change password</button><button type="button" className="btn" onClick={logout}>Sign out</button></div>
        </form>
      </Panel>
    </div>
  );
}
