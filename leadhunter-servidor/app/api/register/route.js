export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { startSession } from '@/lib/auth';
import { clientIp } from '@/lib/limits';

export async function POST(req) {
  const { email, password, name } = await req.json().catch(() => ({}));
  const e = String(email || '').toLowerCase().trim(), pw = String(password || '');
  if (e.length > 254 || !/^\S+@\S+\.\S+$/.test(e) || pw.length < 8 || pw.length > 72)
    return Response.json({ error: 'Informe um e-mail valido e uma senha de 8 a 72 caracteres.' }, { status: 400 });
  const ip = clientIp(req);
  const n = (await sql`SELECT count(*)::int AS n FROM audit_logs WHERE action='register' AND details->>'ip'=${ip} AND created_at > now() - interval '1 hour'`)[0].n;
  if (n >= 5) return Response.json({ error: 'Muitas contas criadas deste local. Tente novamente mais tarde.' }, { status: 429, headers: { 'Retry-After': '3600' } });

  const hash = await bcrypt.hash(pw, 12);
  const r = await sql`INSERT INTO users (email,name,password_hash) VALUES (${e},${typeof name === 'string' ? name.slice(0, 80) : null},${hash})
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!r.length) return Response.json({ error: 'Nao foi possivel criar a conta com esse e-mail.' }, { status: 409 });
  await sql`INSERT INTO credits_wallets (user_id) VALUES (${r[0].id})`;
  await sql`INSERT INTO audit_logs (actor_id,action,details) VALUES (${r[0].id},'register',${JSON.stringify({ ip })}::jsonb)`;
  await startSession(r[0].id, hash);
  return Response.json({ ok: true });
}
