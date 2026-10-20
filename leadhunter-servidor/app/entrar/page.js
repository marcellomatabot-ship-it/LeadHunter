'use client';
import { useEffect, useState } from 'react';
export default function Home() {
  const [me, setMe] = useState(null), [err, setErr] = useState(''), [f, setF] = useState({ email: '', password: '' });
  const load = () => fetch('/api/me').then(r => r.ok ? r.json() : null).then(setMe);
  useEffect(() => { load(); }, []);
  const send = async (path) => {
    setErr('');
    const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const d = await r.json(); if (!r.ok) setErr(d.error); else load();
  };
  const box = { maxWidth: 380, margin: '10vh auto', padding: 24, border: '1px solid #12382b', borderRadius: 14 };
  const inp = { display: 'block', width: '100%', margin: '8px 0', padding: 10, background: '#06110d', color: '#e6f5ee', border: '1px solid #12382b', borderRadius: 8, boxSizing: 'border-box' };
  const btn = { padding: '10px 16px', marginRight: 8, background: '#0f9d6f', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' };
  if (me) return <div style={box}><h2>LeadHunter</h2>
    <p>{me.email} · plano <b>{me.role}</b></p>
    <p>Leads esta semana: {me.weeklyUsed} / {me.weeklyLimit ?? 'ilimitado'}</p>
    <p>Creditos: {me.credits}</p>
    <button style={btn} onClick={async () => { await fetch('/api/logout', { method: 'POST' }); setMe(null); }}>Sair</button></div>;
  return <div style={box}><h2>LeadHunter</h2>
    <input style={inp} placeholder="E-mail" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
    <input style={inp} type="password" placeholder="Senha (8+ caracteres)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
    {err && <p role="alert" style={{ color: '#ff6b6b' }}>{err}</p>}
    <button style={btn} onClick={() => send('login')}>Entrar</button><button style={{ ...btn, background: 'none', border: '1px solid #12382b' }} onClick={() => send('register')}>Criar conta</button></div>;
}
