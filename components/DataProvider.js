'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { enrich } from '@/lib/calc';
import { api } from '@/lib/client';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

function Modal({ children, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-start sm:overflow-y-auto sm:p-4 print:static print:bg-transparent print:p-0"
         onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none pb-[max(1rem,env(safe-area-inset-bottom))] sm:mt-8 sm:max-h-none sm:overflow-visible sm:rounded-b-xl print:mt-0 print:max-h-none print:max-w-none print:overflow-visible print:border-0">{children}</div>
    </div>
  );
}

export function DataProvider({ children }) {
  const [raw, setRaw] = useState({ transactions: [], repayments: [], people: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState({ msg: '', on: false });
  const toastTimer = useRef(null);

  const reload = useCallback(async () => { setRaw(await api('/api/data')); setLoading(false); }, []);
  useEffect(() => { reload().catch((e) => setToast(e.message)); }, [reload]);
  // re-evaluate statuses and countdowns every minute
  useEffect(() => { const i = setInterval(() => setRaw((r) => ({ ...r })), 60000); return () => clearInterval(i); }, []);

  const tx = useMemo(() => enrich(raw.transactions, raw.repayments), [raw]);
  const close = useCallback(() => setModal(null), []);
  // Short pill message. A new message replaces the old one and restarts the timer
  // (before, an old timer could dismiss a newer message early).
  const notify = useCallback((msg, ms = 2800) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, on: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), ms);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <Ctx.Provider value={{ tx, rp: raw.repayments, people: raw.people, loading, reload, show: setModal, close, notify }}>
      {children}
      {modal && <Modal onClose={close}>{modal}</Modal>}
      {/* phones: just above the floating bottom bar; desktop: near the bottom edge */}
      <div role="status" aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4 print:hidden md:bottom-6">
        {toast.msg && <div className={`toast rounded-full bg-tx px-4 py-2 text-sm text-bg shadow-lg ${toast.on ? 'on' : ''}`}>{toast.msg}</div>}
      </div>
    </Ctx.Provider>
  );
}
