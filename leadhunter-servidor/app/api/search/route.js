export const dynamic = 'force-dynamic';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { str } from '@/lib/crm';

const SOCIAL = ['facebook.com','instagram.com','tiktok.com','linkedin.com','wa.me','whatsapp.com','ifood.com.br','linktr.ee','twitter.com','x.com','youtube.com','google.com','goo.gl','mercadolivre.com.br','olx.com.br','tripadvisor.com','booking.com'];
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,nextPageToken';
const err = (m, s) => Response.json({ error: m }, { status: s });

function classify(site) {
  if (!site) return { status: 'POSSIBLY_NO_SITE', label: 'Possivelmente sem website' };
  let host = ''; try { host = new URL(site).hostname.replace(/^www\./, ''); } catch {}
  if (SOCIAL.some((d) => host === d || host.endsWith('.' + d)))
    return { status: 'POSSIBLY_NO_SITE', label: 'Apenas rede social/diretorio (nao e site proprio)' };
  return { status: 'SITE_FOUND', label: 'Website encontrado' };
}

export async function POST(req) {
  const u = await currentUser(); if (!u) return err('Faca login para continuar.', 401);
  const key = process.env.PLACES_API_KEY;
  if (!key) return err('A fonte de dados ainda nao foi configurada pelo administrador.', 503);
  const b = await req.json().catch(() => ({}));
  const category = str(b.category, 80), city = str(b.city, 80), state = str(b.state, 40), hood = str(b.neighborhood, 80);
  const country = str(b.country, 60) || 'Brasil';
  if (!category || !city) return err('Informe a categoria e a cidade.', 400);
  if (country.toLowerCase() !== 'brasil' && !['MAX', 'OWNER'].includes(u.role)) return err('A busca internacional e exclusiva do plano MAX.', 403);
  const want = Math.min(Math.max(parseInt(b.count) || 1, 1), 400);
  let allowed = want;
  if (u.weekly_leads !== null) {
    const r = await sql`SELECT leads_used FROM usage WHERE user_id=${u.id} AND week_start=date_trunc('week', now())::date`;
    allowed = Math.min(want, u.weekly_leads - (r[0]?.leads_used ?? 0));
  }
  if (allowed <= 0) return err('Voce atingiu o limite semanal de leads do seu plano.', 429);

  const textQuery = `${category} em ${hood ? hood + ', ' : ''}${city}, ${state ? state + ', ' : ''}${country}`;
  const seen = new Set(), out = []; let token;
  for (let page = 0; page < 3 && out.length < allowed; page++) {
    let res;
    try {
      res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
        body: JSON.stringify({ textQuery, pageSize: 20, languageCode: 'pt-BR', ...(token ? { pageToken: token } : {}) }),
      });
    } catch { return err('Nao conseguimos consultar a fonte de dados neste momento. Tente novamente.', 502); }
    if (!res.ok) return err('Nao conseguimos consultar a fonte de dados neste momento. Tente novamente.', 502);
    const data = await res.json();
    for (const p of data.places || []) {
      if (seen.has(p.id)) continue; seen.add(p.id);
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
      const c = classify(p.websiteUri);
      if (b.onlyNoSite !== false && c.status === 'SITE_FOUND') continue;
      const digits = (p.internationalPhoneNumber || '').replace(/\D/g, '');
      out.push({
        placeId: p.id, name: p.displayName?.text || '', category: p.primaryTypeDisplayName?.text || null,
        address: p.formattedAddress || null, phone: p.nationalPhoneNumber || null,
        whatsapp: /^55\d{2}9\d{8}$/.test(digits) ? digits : null, // palpite: celular, NAO verificado
        website: p.websiteUri || null, mapsUrl: p.googleMapsUri || null,
        rating: p.rating ?? null, reviews: p.userRatingCount ?? null, status: c.status, statusLabel: c.label,
      });
    }
    token = data.nextPageToken; if (!token) break;
  }
  const results = out.slice(0, allowed);
  if (results.length && !(await consumeAndLog(u, results.length, b))) return err('Voce atingiu o limite semanal de leads do seu plano.', 429);
  return Response.json({ results, requested: want, limited: allowed < want, verifiedAt: new Date().toISOString() });
}

import { consumeLeads } from '@/lib/auth';
async function consumeAndLog(u, n, b) {
  if (!(await consumeLeads(u, n))) return false;
  await sql`INSERT INTO searches (user_id, filters, requested, returned) VALUES (${u.id}, ${JSON.stringify({ category: b.category, city: b.city, state: b.state, country: b.country })}::jsonb, ${n}, ${n})`;
  return true;
}
