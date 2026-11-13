import { cookies } from 'next/headers';
import { verify, COOKIE } from './token';

export async function currentUserId() {
  const t = cookies().get(COOKIE)?.value;
  return t ? verify(t) : null;
}
