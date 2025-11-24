
// ---- utilities
const $ = sel => document.querySelector(sel);
function fmtDate(d){return d.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit',year:'numeric'})}

const STORE = {
  get(k,def=null){try{return JSON.parse(localStorage.getItem(k))??def}catch(e){return def}},
  set(k,v){localStorage.setItem(k, JSON.stringify(v))}
};

// ---- Theme
function applyTheme(t){
  if(t==='system'){ document.documentElement.classList.remove('light','dark'); }
  else{ document.documentElement.classList.remove('light','dark'); document.documentElement.classList.add(t); }
  STORE.set('theme', t);
  $('#theme').value = t; $('#theme2').value = t;
}

// ---- Punjabi fixed-month mapping (day calc)
const PMAP = [
  ['Chet',   [3,14],[4,13]],
  ['Vaisakh',[4,14],[5,14]],
  ['Jeth',   [5,15],[6,14]],
  ['Harh',   [6,15],[7,16]],
  ['Sawan',  [7,17],[8,16]],
  ['Bhadon', [8,17],[9,16]],
  ['Assu',   [9,17],[10,16]],
  ['Kattak', [10,17],[11,15]],
  ['Maghar', [11,16],[12,14]],
  ['Poh',    [12,15],[1,13]],
  ['Magh',   [1,14],[2,12]],
  ['Phagan', [2,13],[3,13]],
];
function punjabiFor(date){
  const y = date.getFullYear();
  for(const [name,[sm,sd],[em,ed]] of PMAP){
    const s = new Date(sm<3?y: y, sm-1, sd); // naive, acceptable ±1
    const e = new Date(em<3?y+1:y, em-1, ed);
    if(date>=s && date<=e){
      const day = Math.floor((date - s)/(24*3600*1000)) + 1;
      let yr = y+621-57; // rough Bikrami→Gregorian relation not used; just show 208x series approx
      // Derive a stable Punjabi year by offset from March
      const pjYear = (date.getMonth()>=2? y+2082-2025 : y+2081-2025); // anchors 2025→2082
      return {name, day, year: pjYear};
    }
  }
  // fallback
  return {name:'Maghar', day:1, year:2082};
}

// ---- Hijri tabular (Kuwaiti algorithm simplified)
function hijriFor(gd){
  const jd = Math.floor((gd/86400000) - (gd.getTimezoneOffset()/ (60*24)) + 2440587.5);
  const islamicEpoch = 1948439.5;
  let days = jd - islamicEpoch;
  let hYear = Math.floor((30*days + 10646)/10631);
  let hMonth = Math.min(11, Math.floor((days - 29 - hijriToJdStart(hYear))/29.5));
  let hDay = jd - hijriToJd(hYear, hMonth, 1) + 1;
  const names = ["Muharram","Safar","Rabi I","Rabi II","Jumada I","Jumada II","Rajab","Sha'ban","Ramadan","Shawwal","Dhul Qa'da","Dhul Hijja"];
  return {year:hYear, month:hMonth, day:hDay, name:names[hMonth]};
}
function hijriToJdStart(y){ return (y-1)*354 + Math.floor((3+11*y)/30) }
function hijriToJd(y,m,d){ return 1948439.5 + d + Math.ceil(29.5*m) + hijriToJdStart(y) }

// ---- Weather: try AccuWeather first, fallback Open-Meteo
async function fetchWeather(lat, lon){
  const res = { ok:false, temp:null, wind:null, provider:null };
  const key = $('#accuKey').value.trim() || STORE.get('accu_key','');
  if(key){
    try{
      const r1 = await fetch(`https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${key}&q=${lat},${lon}`);
      if(r1.ok){
        const loc = await r1.json();
        const locKey = loc.Key;
        const r2 = await fetch(`https://dataservice.accuweather.com/currentconditions/v1/${locKey}?apikey=${key}&details=true`);
        if(r2.ok){
          const cur = (await r2.json())[0];
          res.temp = cur.Temperature.Metric.Value;
          res.wind = cur.Wind.Speed.Metric.Value;
          res.ok = true; res.provider = 'AccuWeather';
          return res;
        }
      }
    }catch(e){/* fallthrough */}
  }
  // fallback – Open‑Meteo (no key)
  try{
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`);
    if(r.ok){
      const cur = (await r.json()).current;
      res.temp = cur.temperature_2m;
      res.wind = cur.wind_speed_10m;
      res.ok = true; res.provider = 'Open‑Meteo';
    }
  }catch(e){}
  return res;
}
function sprayAdvice(wind){
  if(wind==null) return {ok:false, en:"No data", ur:"ڈیٹا دستیاب نہیں"};
  if(wind<=2.5) return {ok:true, en:"Suitable for spraying", ur:"سپرے کے لیے موزوں"};
  if(wind<=4) return {ok:false, en:"Borderline — light wind. Spray with caution.", ur:"ہلکی ہوا — احتیاط سے سپرے کریں"};
  return {ok:false, en:"Too windy. Avoid spraying.", ur:"ہوا تیز ہے — سپرے سے گریز کریں"};
}

// ---- Reminders
function listReminders(){
  const list = STORE.get('reminders',[]);
  const ul = $('#events'); ul.innerHTML = '';
  if(!list.length){ ul.innerHTML = '<li>No events.</li>'; return; }
  for(const it of list){
    const li = document.createElement('li');
    li.textContent = `${new Date(it.when).toLocaleString()} — ${it.text}`;
    ul.appendChild(li);
  }
}

// ---- Farming data
let FARM = {};
async function loadFarming(){
  const r = await fetch('data/farming.json');
  FARM = await r.json();
}

// ---- Render Day
function renderDay(date){
  const p = punjabiFor(date);
  const h = hijriFor(date);
  const dayHtml = `
    <h2>${date.toLocaleDateString(undefined,{weekday:'short', day:'2-digit', month:'short', year:'numeric'})}</h2>
    <div class="kv"><div><b>English:</b></div><div>${date.toLocaleDateString(undefined,{day:'2-digit', month:'short', year:'numeric'})}</div></div>
    <div class="kv"><div><b>Islamic:</b></div><div>${h.day} ${h.name} ${h.year} <span class="badge">offset 0</span></div></div>
    <div class="kv"><div><b>Panjabi (پنجابی):</b></div><div><b>${p.day}</b> ${p.name} ${p.year} <span class="badge">30‑day month</span></div></div>
  `;
  $('#outDay').innerHTML = dayHtml;

  // Farming lists
  $('#farmMonth').textContent = p.name;
  $('#farmListEN').innerHTML = (FARM[p.name]?.en||[]).map(s=>`<li>${s}</li>`).join('');
  $('#farmListUR').innerHTML = (FARM[p.name]?.ur||[]).map(s=>`<li>${s}</li>`).join('');
  $('#farmNote').textContent = "Guidance is general for Sahiwal agro‑climate; adapt to field conditions.";
}

// ---- Init
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; $('#installBtn').hidden=false; });
$('#installBtn').addEventListener('click', async ()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; $('#installBtn').hidden=true; } });

async function init(){
  // theme
  const t = STORE.get('theme','dark'); applyTheme(t);
  $('#theme').onchange = e=>applyTheme(e.target.value);
  $('#theme2').onchange = e=>applyTheme(e.target.value);

  // settings
  $('#accuKey').value = STORE.get('accu_key','');
  $('#coords').value = STORE.get('coords','30.6709846,73.2896608');
  $('#saveSettings').onclick = ()=>{ STORE.set('accu_key',$('#accuKey').value.trim()); STORE.set('coords',$('#coords').value.trim()); alert('Saved'); };

  // date
  const now = new Date();
  $('#baseDate').valueAsDate = now;
  $('#todayBtn').onclick = ()=>{ $('#baseDate').valueAsDate = new Date(); render(); };
  $('#baseDate').addEventListener('change', render);

  $('#addReminder').onclick = ()=>{
    const txt = prompt('Reminder text:');
    if(!txt) return;
    const when = $('#baseDate').valueAsDate || new Date();
    const list = STORE.get('reminders',[]); list.push({text:txt, when: when});
    STORE.set('reminders', list); listReminders();
  };
  $('#exportBtn').onclick = ()=>{
    const blob = new Blob([JSON.stringify(STORE.get('reminders',[]), null, 2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'reminders.json'});
    a.click();
  };
  $('#importBtn').onclick = ()=>{
    const inp = Object.assign(document.createElement('input'), {type:'file', accept:'application/json'});
    inp.onchange = ()=>{
      const f = inp.files[0]; if(!f) return;
      const r = new FileReader(); r.onload = ()=>{ STORE.set('reminders', JSON.parse(r.result||'[]')); listReminders(); }; r.readAsText(f);
    }; inp.click();
  };

  await loadFarming();
  listReminders();
  render();
  // weather
  const [lat,lon] = ($('#coords').value||'30.6709846,73.2896608').split(',').map(Number);
  const w = await fetchWeather(lat,lon);
  if(w.ok){
    $('#temp').textContent = `${w.temp} °C (${w.provider})`;
    $('#wind').textContent = `${w.wind} m/s`;
    const adv = sprayAdvice(w.wind);
    $('#spray').innerHTML = adv.ok? `<span class="status-ok">✔ ${adv.en} — <span dir="rtl">${adv.ur}</span></span>` :
                                   `<span class="status-bad">✖ ${adv.en} — <span dir="rtl">${adv.ur}</span></span>`;
  }else{
    $('#temp').textContent = '—'; $('#wind').textContent='—'; $('#spray').textContent='No data';
  }
}
function render(){ const d = $('#baseDate').valueAsDate || new Date(); renderDay(d); }

// kick
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js') ); }
init();
