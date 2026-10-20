export const dynamic = 'force-dynamic';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export async function POST(req) {
  const { token, password } = await req.json().catch(() => ({}));
  const pw = String(password || '');
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return Response.json({ error: 'Link invalido ou expirado. Peca um novo.' }, { status: 400 });
  if (pw.length < 8 || pw.length > 72) return Response.json({ error: 'A senha precisa ter de 8 a 72 caracteres.' }, { status: 400 });
  const h = createHash('sha256').update(token).digest('hex');
  // DELETE ... RETURNING garante uso unico do link
  const r = await sql`DELETE FROM settings WHERE key=${'pwreset:' + h} RETURNING value`;
  if (!r.length || r[0].value.exp < Date.now()) return Response.json({ error: 'Link invalido ou expirado. Peca um novo.' }, { status: 400 });
  const hash = await bcrypt.hash(pw, 12);
  await sql`UPDATE users SET password_hash=${hash} WHERE id=${r[0].value.uid}`;
  await sql`INSERT INTO audit_logs (actor_id,action) VALUES (${r[0].value.uid},'password_reset')`;
  return Response.json({ ok: true });
}
