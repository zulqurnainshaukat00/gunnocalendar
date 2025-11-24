
const CORE = [
  './','./index.html','./styles.css','./app.js',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon-180.png',
  './data/farming.json'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open('gunnocal-v12-3').then(c=>c.addAll(CORE)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.includes('gunnocal-v12-3')).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch',e=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }else{
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
  }
});
