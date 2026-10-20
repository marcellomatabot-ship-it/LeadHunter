import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { startSession } from '@/lib/auth';
export async function POST(req) {
  const { email, password, name } = await req.json().catch(() => ({}));
  if (!/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8)
    return Response.json({ error: 'Informe um e-mail valido e uma senha com 8 ou mais caracteres.' }, { status: 400 });
  const hash = await bcrypt.hash(password, 12);
  const r = await sql`INSERT INTO users (email,name,password_hash) VALUES (${email.toLowerCase()},${name || null},${hash})
    ON CONFLICT (email) DO NOTHING RETURNING id`;
  if (!r.length) return Response.json({ error: 'Nao foi possivel criar a conta com esse e-mail.' }, { status: 409 });
  await sql`INSERT INTO credits_wallets (user_id) VALUES (${r[0].id})`;
  await startSession(r[0].id);
  return Response.json({ ok: true });
}
