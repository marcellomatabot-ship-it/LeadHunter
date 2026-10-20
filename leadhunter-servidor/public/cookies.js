(function(){try{if(localStorage.getItem('lh_ck'))return}catch(e){}
var b=document.createElement('div');b.setAttribute('role','region');b.setAttribute('aria-label','Aviso de cookies');
b.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:60;max-width:560px;margin:0 auto;padding:14px 16px;background:rgba(6,17,13,.95);border:1px solid #12382b;border-radius:12px;color:#e6f5ee;font:14px/1.5 system-ui,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
var t=document.createElement('span');t.style.flex='1 1 260px';t.textContent='Usamos apenas um cookie essencial para manter você conectado. Não usamos cookies de publicidade nem de rastreamento. ';
var a=document.createElement('a');a.href='/privacidade';a.textContent='Saiba mais';a.style.color='#4dffb0';t.appendChild(a);
var k=document.createElement('button');k.textContent='Entendi';k.style.cssText='padding:8px 16px;border-radius:9px;border:1px solid #10b981;background:#0f9d6f;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer';
k.onclick=function(){try{localStorage.setItem('lh_ck','1')}catch(e){}b.remove()};
b.appendChild(t);b.appendChild(k);document.body.appendChild(b)})();
