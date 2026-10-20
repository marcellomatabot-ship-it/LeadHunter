import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET);
export async function startSession(userId) {
  const t = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(key());
  cookies().set('lh', t, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 604800 });
}
export async function currentUser() {
  const t = cookies().get('lh')?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    const r = await sql`SELECT u.id,u.email,u.name,u.role,u.blocked,u.created_at,p.weekly_leads
      FROM users u JOIN plans p ON p.code=u.role WHERE u.id=${payload.uid} AND u.deleted_at IS NULL`;
    return r[0] && !r[0].blocked ? r[0] : null;
  } catch { return null; }
}
// Limite semanal aplicado no servidor. Retorna true se reservou, false se estourou.
export async function consumeLeads(user, n) {
  if (user.weekly_leads === null) return true; // OWNER: ilimitado
  const r = await sql`INSERT INTO usage (user_id, week_start, leads_used)
    VALUES (${user.id}, date_trunc('week', now())::date, ${n})
    ON CONFLICT (user_id, week_start) DO UPDATE SET leads_used = usage.leads_used + ${n}
    WHERE usage.leads_used + ${n} <= ${user.weekly_leads} RETURNING leads_used`;
  return r.length > 0;
}
