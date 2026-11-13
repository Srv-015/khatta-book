import { NextResponse } from 'next/server';
import { verify, COOKIE } from './lib/token';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) return NextResponse.next();
  const t = req.cookies.get(COOKIE)?.value;
  if (t && (await verify(t))) return NextResponse.next();
  if (pathname.startsWith('/api')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-icon.png|icon.svg).*)'] };
