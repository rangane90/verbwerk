const CACHE='verbwerk-v11-online-17';
const RETIRED_PREFIXES=['verbwerk-v8-','verbwerk-v9-','verbwerk-v10-','verbwerk-v11-'];
const FILES=['./','./index.html','./manifest.webmanifest','./icon.svg','./vocabulary-pilot.js','./vocabulary-general-a1-c2.js?v=21','./vocabulary-wordly-de.js?v=1','./vocabulary-gender-index.js?v=1','./vocabulary-latest-database.js?v=4','./vocabulary-general-ui.js?v=36','./vocabulary-unified-library.js?v=10','./vocabulary-manifest.json','./VOCABULARY-LICENSE.md'];
const DATA_PATHS=['vocabulary-general-a1-c2.js','vocabulary-wordly-de.js','vocabulary-gender-index.js','vocabulary-manifest.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&(RETIRED_PREFIXES.some(prefix=>key.startsWith(prefix))||key==='verbwerk-v10-2-library-2')).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function cachedData(cache,request,url){let cached=await cache.match(request);if(cached)return cached;let keys=await cache.keys();let matching=keys.find(key=>new URL(key.url).pathname===url.pathname);return matching?cache.match(matching):null;}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const url=new URL(event.request.url),isData=DATA_PATHS.some(path=>url.pathname.endsWith('/'+path));
  if(isData){event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok){if(response.type==='basic')await cache.put(event.request,response.clone());return response;}return await cachedData(cache,event.request,url)||response;}catch(_){return await cachedData(cache,event.request,url)||new Response('Vocabulary data is not cached yet.',{status:503,headers:{'Content-Type':'text/plain'}});}})());return;}
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&response.type==='basic')cache.put(event.request,response.clone()).catch(()=>{});return response}))).catch(()=>caches.open(CACHE).then(cache=>cache.match('./index.html'))));
});
