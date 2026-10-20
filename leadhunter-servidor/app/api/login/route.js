export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { startSession } from '@/lib/auth';
import { clientIp } from '@/lib/limits';
let dummy;

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const e = String(email || '').toLowerCase().slice(0, 254), pw = String(password || '').slice(0, 200), ip = clientIp(req);

  // Limite de tentativas: 5 falhas por e-mail ou 20 por IP em 15 minutos
  const f = (await sql`SELECT
    (SELECT count(*) FROM audit_logs WHERE action='login_failed' AND target=${e} AND created_at > now() - interval '15 minutes')::int AS by_email,
    (SELECT count(*) FROM audit_logs WHERE action='login_failed' AND details->>'ip'=${ip} AND created_at > now() - interval '15 minutes')::int AS by_ip`)[0];
  if (f.by_email >= 5 || f.by_ip >= 20)
    return Response.json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, { status: 429, headers: { 'Retry-After': '900' } });

  let u = (await sql`SELECT id,password_hash,blocked FROM users WHERE email=${e} AND deleted_at IS NULL`)[0];
  // Cria o OWNER no primeiro login, usando as variaveis de ambiente (nada fica no codigo)
  if (!u && process.env.OWNER_EMAIL && e === process.env.OWNER_EMAIL.toLowerCase() && pw === process.env.OWNER_PASSWORD) {
    const hash = await bcrypt.hash(pw, 12);
    u = (await sql`INSERT INTO users (email,name,password_hash,role) VALUES (${e},'Owner',${hash},'OWNER') RETURNING id,password_hash,blocked`)[0];
    await sql`INSERT INTO credits_wallets (user_id) VALUES (${u.id}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO audit_logs (actor_id,action) VALUES (${u.id},'owner_created')`;
  }
  // Compara sempre com um hash (mesmo sem usuario) para o tempo de resposta nao revelar se o e-mail existe
  const hash = u?.password_hash || (dummy ??= await bcrypt.hash('x-dummy-password', 12));
  const match = await bcrypt.compare(pw, hash);
  if (!u || u.blocked || !match) {
    await sql`INSERT INTO audit_logs (action,target,details) VALUES ('login_failed',${e},${JSON.stringify({ ip })}::jsonb)`;
    await sql`DELETE FROM audit_logs WHERE action='login_failed' AND created_at < now() - interval '30 days'`;
    return Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  await startSession(u.id, u.password_hash);
  return Response.json({ ok: true });
}
