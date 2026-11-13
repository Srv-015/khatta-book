'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DataProvider, useData } from './DataProvider';
import { TxForm } from './forms';
import { nextNavState } from '@/lib/report';

// Phone bottom bar, like YouTube / Instagram: scrolling DOWN slides it away, scrolling UP brings it back.
const HIDE_NAV_ON = 'down';

// Desktop sidebar (unchanged): [href, label]
const NAV = [
  ['/', 'Dashboard'],
  ['/transactions', 'Transactions'],
  ['/people', 'People'],
  ['/repayments', 'Repayments'],
  ['/reports', 'Reports'],
  ['/export', 'Export'],
  ['/settings', 'Settings'],
];

const Svg = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
const IHome = (p) => <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></Svg>;
const IList = (p) => <Svg {...p}><path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" /><path d="M9 8h6M9 12h6" /></Svg>;
const IPeople = (p) => <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.4 0 4 1.7 4 4" /></Svg>;
const IClock = (p) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /><path d="M12 8v4l2.5 2" /></Svg>;
const IGear = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;
const IChart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
const IDown = (p) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Svg>;

// Phone bottom bar: only these four
const TABS = [
  ['/', 'Dashboard', IHome],
  ['/transactions', 'Transactions', IList],
  ['/people', 'People', IPeople],
  ['/repayments', 'Repayment', IClock],
];
const MENU = [
  ['/settings', 'Settings', IGear],
  ['/reports', 'Reports', IChart],
  ['/export', 'Export', IDown],
];

function Inner({ children }) {
  const path = usePathname();
  const { show } = useData();
  const [menu, setMenu] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const navState = useRef({ hidden: false, last: 0 });
  const title = NAV.find((n) => n[0] === path)?.[1] || '';
  const idx = TABS.findIndex(([h]) => h === path);

  useEffect(() => setMenu(false), [path]);

  // scroll direction -> show / hide the bottom bar (window scroll, so it works on every page)
  useEffect(() => {
    navState.current = { hidden: false, last: window.scrollY };
    setNavHidden(false);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        navState.current = nextNavState(navState.current, window.scrollY, max, HIDE_NAV_ON);
        setNavHidden(navState.current.hidden);
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [path]);
  useEffect(() => {
    if (!menu) return;
    const k = (e) => e.key === 'Escape' && setMenu(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [menu]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-bd bg-sf p-4 print:hidden md:sticky md:top-0 md:block md:h-screen">
        <div className="mb-4 px-2 font-serif text-lg font-bold text-ac">Khatta Book</div>
        <nav>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`mb-1 block rounded-lg px-3 py-2 text-sm ${path === href ? 'bg-ac2 font-semibold text-ac' : 'text-mu'}`}>{label}</Link>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl p-4 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] print:hidden md:p-6 md:pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>

          {/* phone: settings menu (Settings / Reports / Export) */}
          <div className="relative md:hidden">
            <button
              aria-label="Settings menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}
              className="glass flex h-10 w-10 items-center justify-center rounded-full text-tx transition-transform active:scale-90 motion-reduce:transition-none"
            >
              <IGear className="h-5 w-5" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div role="menu" className="glass pop absolute right-0 top-12 z-50 w-52 rounded-2xl p-1.5">
                  {MENU.map(([href, label, Icon]) => (
                    <Link key={href} href={href} role="menuitem" onClick={() => setMenu(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-tx active:bg-white/40">
                      <Icon className="h-5 w-5 text-ac" />{label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <button className="btn btn-p hidden md:inline-flex" onClick={() => show(<TxForm />)}>+ New transaction</button>
        </div>
        {children}
      </main>

      {/* phone: floating liquid-glass pill with four tabs */}
      <nav aria-label="Main" aria-hidden={navHidden} data-hidden={navHidden}
        className={`glass fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-md rounded-full p-1.5 will-change-[transform,opacity] transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none print:hidden md:hidden ${navHidden ? 'pointer-events-none translate-y-[calc(100%+3.5rem)] opacity-0' : 'opacity-100'}`}>
        <div className="relative grid grid-cols-4">
          <span aria-hidden="true"
            className={`glass-active absolute inset-y-0 left-0 w-1/4 rounded-full transition-[transform,opacity] duration-300 ease-[cubic-bezier(.34,1.3,.5,1)] motion-reduce:transition-none ${idx < 0 ? 'opacity-0' : 'opacity-100'}`}
            style={{ transform: `translateX(${Math.max(idx, 0) * 100}%)` }} />
          {TABS.map(([href, label, Icon], i) => (
            <Link key={href} href={href} aria-current={i === idx ? 'page' : undefined} tabIndex={navHidden ? -1 : undefined}
              className={`relative z-10 flex flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-medium transition-[color,transform] duration-200 active:scale-90 motion-reduce:transition-none ${i === idx ? 'text-ac' : 'text-mu'}`}>
              <Icon className={`h-[22px] w-[22px] transition-transform duration-300 motion-reduce:transition-none ${i === idx ? 'scale-110' : ''}`} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <button aria-label="New transaction" onClick={() => show(<TxForm />)}
        className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-30 h-14 w-14 rounded-full bg-ac text-3xl leading-none text-white shadow-lg will-change-transform transition-transform duration-[380ms] ease-[cubic-bezier(.32,.72,0,1)] active:scale-90 motion-reduce:transition-none print:hidden md:hidden dark:text-[#0b1f19] ${navHidden ? 'translate-y-[4.5rem]' : ''}`}>+</button>
    </div>
  );
}

export default function Shell({ children }) {
  return <DataProvider><Inner>{children}</Inner></DataProvider>;
}
