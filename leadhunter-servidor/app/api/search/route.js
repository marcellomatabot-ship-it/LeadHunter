export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { promises as dns } from 'dns';
import { sql } from '@/lib/db';
import { currentUser, consumeLeads } from '@/lib/auth';
import { str } from '@/lib/crm';

const SOCIAL = ['facebook.com','instagram.com','tiktok.com','linkedin.com','wa.me','whatsapp.com','ifood.com.br','linktr.ee','twitter.com','x.com','youtube.com','google.com','goo.gl','mercadolivre.com.br','olx.com.br','tripadvisor.com','booking.com'];
const STOP = new Set(['de','da','do','das','dos','e','ltda','me','epp','eireli','sa','the','and']);
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,nextPageToken';
const err = (m, s) => Response.json({ error: m }, { status: s });
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; LeadHunterBot/1.0)' };

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (name) => norm(name).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
const isSocial = (site) => { try { const h = new URL(site).hostname.replace(/^www\./, ''); return SOCIAL.some((d) => h === d || h.endsWith('.' + d)); } catch { return false; } };

function isPrivate(ip) {
  if (ip.includes(':')) return ip === '::1' || ip === '::' || /^(fc|fd|fe80)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}
async function pub(host) { try { const { address } = await dns.lookup(host); return !isPrivate(address); } catch { return false; } }

async function getText(url) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 3500);
  try {
    let r = await fetch(url, { redirect: 'manual', signal: ac.signal, headers: UA });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get('location'); if (!loc) return null;
      const nu = new URL(loc, url);
      if (!/^https?:$/.test(nu.protocol) || !(await pub(nu.hostname))) return null;
      r = await fetch(nu.href, { redirect: 'manual', signal: ac.signal, headers: UA });
    }
    return r.ok ? (await r.text()).slice(0, 150000) : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Verifica se existe um site proprio em dominios comuns E se a pagina corresponde a empresa
async function findOwnSite(place, city) {
  const toks = tokens(place.name); const base = toks.slice(0, 4).join('');
  if (base.length < 4) return null;
  const domains = [...new Set([base + '.com.br', base + '.com', toks.slice(0, 4).join('-') + '.com.br', base + '.net.br'])];
  const ph = (place.phone || '').replace(/\D/g, '').slice(-8);
  for (const d of domains) {
    if (!(await pub(d))) continue;
    const text = await getText('https://' + d); if (!text) continue;
    const t = norm(text), digits = text.replace(/\D/g, '');
    const ok = (ph.length === 8 && digits.includes(ph)) ||
      (toks.length >= 2 ? toks.every((k) => t.includes(k)) : t.includes(toks[0]) && city && t.includes(norm(city)));
    if (ok) return 'https://' + d;
  }
  return null;
}

async function pool(items, n, fn) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k]); } }));
}

export async function POST(req) {
  const u = await currentUser(); if (!u) return err('Faca login para continuar.', 401);
  const key = process.env.PLACES_API_KEY;
  if (!key) return err('A fonte de dados ainda nao foi configurada pelo administrador.', 503);
  const b = await req.json().catch(() => ({}));
  const category = str(b.category, 80), city = str(b.city, 80), state = str(b.state, 40), hood = str(b.neighborhood, 80);
  const country = str(b.country, 60) || 'Brasil';
  if (!category || !city) return err('Informe a categoria e a cidade.', 400);
  if (country.toLowerCase() !== 'brasil' && u.role !== 'OWNER') return err('A busca internacional ainda nao esta disponivel.', 403);
  const want = Math.min(Math.max(parseInt(b.count) || 1, 1), 400);
  let allowed = want;
  if (u.weekly_leads !== null) {
    const r = await sql`SELECT leads_used FROM usage WHERE user_id=${u.id} AND week_start=date_trunc('week', now())::date`;
    allowed = Math.min(want, u.weekly_leads - (r[0]?.leads_used ?? 0));
  }
  if (allowed <= 0) return err('Voce atingiu o limite semanal de leads do seu plano.', 429);

  const textQuery = `${category} em ${hood ? hood + ', ' : ''}${city}, ${state ? state + ', ' : ''}${country}`;
  const seen = new Set(), cands = []; let token;
  for (let page = 0; page < 3 && cands.length < allowed * 2; page++) {
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
      const digits = (p.internationalPhoneNumber || '').replace(/\D/g, '');
      cands.push({
        placeId: p.id, name: p.displayName?.text || '', category: p.primaryTypeDisplayName?.text || null,
        address: p.formattedAddress || null, phone: p.nationalPhoneNumber || null,
        whatsapp: /^55\d{2}9\d{8}$/.test(digits) ? digits : null, // palpite de celular, NAO verificado
        website: p.websiteUri || null, mapsUrl: p.googleMapsUri || null,
        rating: p.rating ?? null, reviews: p.userRatingCount ?? null,
      });
    }
    token = data.nextPageToken; if (!token) break;
  }

  // Verificacao: 1) site no cadastro do Google  2) so rede social  3) dominios comuns que correspondam a empresa
  const deadline = Date.now() + 40000;
  await pool(cands, 12, async (c) => {
    if (c.website && !isSocial(c.website)) { c.status = 'SITE_FOUND'; c.verification = 'Site informado no cadastro do Google'; return; }
    if (Date.now() > deadline) { c.status = 'UNVERIFIED'; return; }
    const found = await findOwnSite(c, city);
    if (found) { c.status = 'SITE_FOUND'; c.website = found; c.verification = 'Site encontrado em dominio proprio'; }
    else { c.status = 'NO_SITE'; c.verification = c.website ? 'Apenas rede social/diretorio; sem dominio proprio encontrado' : 'Sem site no cadastro do Google e em dominios comuns'; }
  });
  const label = { SITE_FOUND: 'Tem website', NO_SITE: 'Sem website' };
  const results = cands.filter((c) => c.status !== 'UNVERIFIED' && (b.onlyNoSite === false || c.status === 'NO_SITE'))
    .slice(0, allowed).map((c) => ({ ...c, statusLabel: label[c.status] }));

  if (results.length) {
    if (!(await consumeLeads(u, results.length))) return err('Voce atingiu o limite semanal de leads do seu plano.', 429);
    await sql`INSERT INTO searches (user_id, filters, requested, returned) VALUES (${u.id}, ${JSON.stringify({ category, city, state, country })}::jsonb, ${want}, ${results.length})`;
  }
  return Response.json({ results, requested: want, limited: allowed < want, verifiedAt: new Date().toISOString() });
}
