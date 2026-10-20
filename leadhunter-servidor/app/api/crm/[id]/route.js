export const dynamic = 'force-dynamic';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { STAGES, UUID, str, cents } from '@/lib/crm';
const no = () => Response.json({ error: 'Faca login para continuar.' }, { status: 401 });
const bad = () => Response.json({ error: 'Pedido invalido.' }, { status: 400 });

export async function PATCH(req, { params }) {
  const u = await currentUser(); if (!u) return no();
  if (!UUID.test(params.id)) return bad();
  const b = await req.json().catch(() => ({}));
  if (b.stage !== undefined && !STAGES.includes(b.stage)) return bad();
  const tags = Array.isArray(b.tags) ? b.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 10) : null;
  const r = await sql`UPDATE crm_deals SET
      stage = COALESCE(${b.stage ?? null}::deal_stage, stage),
      notes = CASE WHEN ${b.notes !== undefined} THEN ${str(b.notes, 2000)} ELSE notes END,
      next_action = CASE WHEN ${b.nextAction !== undefined} THEN ${str(b.nextAction, 160)} ELSE next_action END,
      value_cents = CASE WHEN ${b.valueCents !== undefined} THEN ${cents(b.valueCents)}::int ELSE value_cents END,
      tags = COALESCE(${tags}::text[], tags),
      favorite = COALESCE(${typeof b.favorite === 'boolean' ? b.favorite : null}::boolean, favorite),
      last_contact_at = CASE WHEN ${b.stage !== undefined} THEN now() ELSE last_contact_at END
    WHERE id = ${params.id} AND user_id = ${u.id} RETURNING id`;
  return r.length ? Response.json({ ok: true }) : Response.json({ error: 'Lead nao encontrado.' }, { status: 404 });
}

export async function DELETE(_req, { params }) {
  const u = await currentUser(); if (!u) return no();
  if (!UUID.test(params.id)) return bad();
  await sql`DELETE FROM crm_deals WHERE id = ${params.id} AND user_id = ${u.id}`;
  return Response.json({ ok: true });
}
