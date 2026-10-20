import { cookies } from 'next/headers';
export async function POST() { cookies().delete('lh'); return Response.json({ ok: true }); }
