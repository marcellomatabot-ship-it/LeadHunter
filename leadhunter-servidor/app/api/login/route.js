import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { startSession } from '@/lib/auth';
export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const e = (email || '').toLowerCase();
  let u = (await sql`SELECT id,password_hash,blocked FROM users WHERE email=${e} AND deleted_at IS NULL`)[0];
  // Cria o OWNER no primeiro login, usando as variaveis de ambiente (nada fica no codigo)
  if (!u && process.env.OWNER_EMAIL && e === process.env.OWNER_EMAIL.toLowerCase() && password === process.env.OWNER_PASSWORD) {
    const hash = await bcrypt.hash(password, 12);
    u = (await sql`INSERT INTO users (email,name,password_hash,role) VALUES (${e},'Owner',${hash},'OWNER') RETURNING id,password_hash,blocked`)[0];
    await sql`INSERT INTO credits_wallets (user_id) VALUES (${u.id}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO audit_logs (actor_id,action) VALUES (${u.id},'owner_created')`;
  }
  const ok = u && !u.blocked && (await bcrypt.compare(password || '', u.password_hash));
  if (!ok) return Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  await startSession(u.id);
  return Response.json({ ok: true });
}
