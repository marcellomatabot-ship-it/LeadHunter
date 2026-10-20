export const dynamic = 'force-dynamic';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Faca login para continuar.' }, { status: 401 });
  const w = (await sql`SELECT balance FROM credits_wallets WHERE user_id=${u.id}`)[0];
  const us = (await sql`SELECT leads_used FROM usage WHERE user_id=${u.id} AND week_start=date_trunc('week', now())::date`)[0];
  return Response.json({ email: u.email, name: u.name, role: u.role, since: u.created_at,
    weeklyLimit: u.weekly_leads, weeklyUsed: us?.leads_used ?? 0, credits: w?.balance ?? 0 });
}
