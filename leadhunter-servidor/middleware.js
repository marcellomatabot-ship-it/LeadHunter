import { NextResponse } from 'next/server';
// Protecao CSRF extra: pedidos que alteram dados precisam vir do proprio site
export function middleware(req) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const o = req.headers.get('origin');
    if (o) {
      let h = ''; try { h = new URL(o).host; } catch {}
      if (h !== req.headers.get('host')) return NextResponse.json({ error: 'Pedido bloqueado.' }, { status: 403 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: '/api/:path*' };
