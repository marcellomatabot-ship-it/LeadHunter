export const dynamic = 'force-dynamic';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { str, cents } from '@/lib/crm';
const no = () => Response.json({ error: 'Faca login para continuar.' }, { status: 401 });

export async function GET() {
  const u = await currentUser(); if (!u) return no();
  const deals = await sql`SELECT d.id, d.stage, d.contact, d.value_cents, d.tags, d.notes, d.next_action,
      d.last_contact_at, d.favorite, l.name, l.phone, l.address, l.city, l.state, l.maps_url, l.source
    FROM crm_deals d JOIN leads l ON l.id = d.lead_id
    WHERE d.user_id = ${u.id} ORDER BY d.created_at DESC LIMIT 500`;
  return Response.json({ deals });
}

// Salva um lead (manual ou vindo da busca) e coloca no funil na etapa NOVO
export async function POST(req) {
  const u = await currentUser(); if (!u) return no();
  const b = await req.json().catch(() => ({}));
  const name = str(b.name, 120);
  if (!name) return Response.json({ error: 'Informe o nome da empresa.' }, { status: 400 });
  const place = str(b.placeId, 200);
  const maps = typeof b.mapsUrl === 'string' && b.mapsUrl.startsWith('https://') ? b.mapsUrl.slice(0, 500) : null;
  const rating = typeof b.rating === 'number' && b.rating >= 0 && b.rating <= 5 ? Math.round(b.rating * 10) / 10 : null;
  const reviews = Number.isInteger(b.reviews) && b.reviews >= 0 ? b.reviews : null;
  const l = await sql`INSERT INTO leads (source, source_id, name, category, phone, address, city, state, rating, reviews, website_url, maps_url)
    VALUES (${place ? 'google_places' : 'manual'}, ${place ?? crypto.randomUUID()}, ${name}, ${str(b.category, 80)}, ${str(b.phone, 40)},
      ${str(b.address, 300)}, ${str(b.city, 80)}, ${str(b.state, 40)}, ${rating}, ${reviews}, ${str(b.website, 300)}, ${maps})
    ON CONFLICT (source, source_id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, address = EXCLUDED.address,
      maps_url = EXCLUDED.maps_url, fetched_at = now() RETURNING id`;
  const d = await sql`INSERT INTO crm_deals (user_id, lead_id, contact, value_cents, next_action)
    VALUES (${u.id}, ${l[0].id}, ${str(b.contact, 80)}, ${cents(b.valueCents)}, ${str(b.nextAction, 160)})
    ON CONFLICT (user_id, lead_id) DO NOTHING RETURNING id`;
  return d.length ? Response.json({ id: d[0].id }) : Response.json({ error: 'Esse lead ja esta no seu CRM.' }, { status: 409 });
}
