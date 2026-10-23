const CACHE='kasa-marathon-shell-v1';
const SHELL=['/marthon','/marthon/login'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('kasa-marathon-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const request=e.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'&&url.pathname.startsWith('/marthon')&&!url.search){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      try{
        const r=await fetch(request);
        if(r.ok&&r.headers.get('content-type')?.includes('text/html'))await c.put(request,r.clone()).catch(()=>{});
        return r;
      }catch{
        return await c.match(request)||await c.match('/marthon')||Response.error();
      }
    })());
    return;
  }
  if(url.pathname.startsWith('/_next/static/')&&!url.search){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE),hit=await c.match(request);
      if(hit)return hit;
      const res=await fetch(request);
      if(res.ok)await c.put(request,res.clone()).catch(()=>{});
      return res;
    })());
  }
});