export const dynamic = 'force-dynamic';
import { randomBytes, createHash } from 'crypto';
import { sql } from '@/lib/db';
import { clientIp } from '@/lib/limits';
const OK = () => Response.json({ ok: true, message: 'Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora.' });

export async function POST(req) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM, site = process.env.SITE_URL;
  if (!key || !from || !site) return Response.json({ error: 'A recuperacao de senha ainda nao foi configurada pelo administrador.' }, { status: 503 });
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || '').toLowerCase().trim().slice(0, 254), ip = clientIp(req);
  if (!/^\S+@\S+\.\S+$/.test(e)) return OK();
  const n = (await sql`SELECT count(*)::int AS n FROM audit_logs WHERE action='reset_request' AND (details->>'ip'=${ip} OR target=${e}) AND created_at > now() - interval '1 hour'`)[0].n;
  if (n >= 5) return Response.json({ error: 'Muitos pedidos. Tente novamente mais tarde.' }, { status: 429 });
  await sql`INSERT INTO audit_logs (action,target,details) VALUES ('reset_request',${e},${JSON.stringify({ ip })}::jsonb)`;

  const u = (await sql`SELECT id FROM users WHERE email=${e} AND deleted_at IS NULL AND NOT blocked`)[0];
  if (u) {
    const token = randomBytes(32).toString('hex');
    const h = createHash('sha256').update(token).digest('hex'); // so o hash fica guardado
    await sql`DELETE FROM settings WHERE key LIKE 'pwreset:%' AND ((value->>'exp')::bigint < ${Date.now()} OR value->>'uid' = ${u.id})`;
    await sql`INSERT INTO settings (key, value) VALUES (${'pwreset:' + h}, ${JSON.stringify({ uid: u.id, exp: Date.now() + 3600000 })}::jsonb)`;
    const link = site.replace(/\/$/, '') + '/redefinir#' + token;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [e], subject: 'Redefinir sua senha no LeadHunter',
          text: `Recebemos um pedido para redefinir sua senha. Acesse o link abaixo (vale por 1 hora):\n\n${link}\n\nSe nao foi voce, ignore este e-mail.`,
          html: `<p>Recebemos um pedido para redefinir sua senha no LeadHunter.</p><p><a href="${link}">Criar nova senha</a> (o link vale por 1 hora)</p><p>Se não foi você, ignore este e-mail.</p>`,
        }),
      });
    } catch {}
  }
  return OK();
}
