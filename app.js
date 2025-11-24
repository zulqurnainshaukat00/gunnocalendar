
// ===== Theme =====
const themeSel = document.getElementById('themeSel');
function applyTheme(v){
  const root = document.documentElement;
  root.className = '';
  root.classList.add('theme-'+v);
  localStorage.setItem('theme', v);
}
themeSel.addEventListener('change', e=>applyTheme(e.target.value));
applyTheme(localStorage.getItem('theme') || 'system');

// ===== PWA =====
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js');
}

// ===== Dates =====
const baseDate = document.getElementById('baseDate');
const todayBtn = document.getElementById('todayBtn');
const lines = document.getElementById('lines');
const dow = document.getElementById('dow');
const hOffset = document.getElementById('hOffset');

function fmtDate(d){ return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) }

function setDateToToday(){
  const t = new Date(); t.setHours(12,0,0,0);
  baseDate.valueAsDate = t;
  render();
}
todayBtn.onclick = setDateToToday;
baseDate.onchange = render;
hOffset.onchange = ()=>{ localStorage.setItem('hOffset', hOffset.value); render(); };
hOffset.value = localStorage.getItem('hOffset') ?? "0";

// Punjabi fixed months (solar) boundaries (inclusive)
const punjMonths = [
  {slug:'cattak', name:'Kattak', ur:'کتک', start:{m:10,d:17}},
  {slug:'maghar', name:'Maghar', ur:'مگھر', start:{m:11,d:16}},
  {slug:'pooh', name:'Pōh', ur:'پوہ', start:{m:12,d:15}},
  {slug:'maagh', name:'Magh', ur:'ماگھ', start:{m:1,d:14}},
  {slug:'phagan', name:'Phagan', ur:'فگن', start:{m:2,d:13}},
  {slug:'cait', name:'Chet', ur:'چیٹ', start:{m:3,d:15}},
  {slug:'vaisakh', name:'Vaisakh', ur:'ویساکھ', start:{m:4,d:14}},
  {slug:'jetth', name:'Jeth', ur:'جیٹھ', start:{m:5,d:15}},
  {slug:'harh', name:'Harh', ur:'ہاڑھ', start:{m:6,d:15}},
  {slug:'sawan', name:'Sawan', ur:'ساون', start:{m:7,d:16}},
  {slug:'bhadon', name:'Bhadon', ur:'بھادوں', start:{m:8,d:16}},
  {slug:'assu', name:'Assu', ur:'اسو', start:{m:9,d:15}},
];

function punjabiFromGregorian(d){
  // Determine month by boundary that is <= date, else last of previous year (Assu).
  const y = d.getFullYear();
  const m = d.getMonth()+1;
  const da = d.getDate();
  let idx = -1;
  for(let i=0;i<punjMonths.length;i++){
    const s = punjMonths[i].start;
    const yr = (s.m<=m) ? y : y-1;
    const start = new Date(yr, s.m-1, s.d);
    if(d >= start) idx = i;
  }
  if(idx===-1) idx = punjMonths.length-1; // Assu previous year
  const s = punjMonths[idx].start;
  const sy = (s.m<=m) ? y : y-1;
  const start = new Date(sy, s.m-1, s.d);
  const day = Math.floor((d - start)/86400000)+1;
  // Punjabi year rough (Bikrami ~ Gregorian+57/58); we show season year label as y+57
  const year = y + 57;
  return { ...punjMonths[idx], day, year };
}

// Islamic (tabular) with offset
// Algorithm based on Kuwaiti algorithm (civil). Returns y,m,d
function islamicFromGregorian(gd, offset=0){
  const day = gd.getDate(), month = gd.getMonth()+1, year = gd.getFullYear();
  let jd = Math.floor((1461*(year + 4800 + Math.floor((month-14)/12)))/4) + 
           Math.floor((367*(month - 2 - 12*Math.floor((month-14)/12)))/12) - 
           Math.floor((3*Math.floor((year + 4900 + Math.floor((month-14)/12))/100))/4) + day - 32075;
  // Islamic
  let l = jd - 1948440 + 10632;
  let n = Math.floor((l-1)/10631);
  l = l - 10631*n + 354 + offset; // apply offset days
  let j = (Math.floor((10985 - l)/5316))* (Math.floor((50*l)/17719)) + (Math.floor(l/5670))* (Math.floor((43*l)/15238));
  l = l - (Math.floor((30 - j)/15))* (Math.floor((17719*j)/50)) - (Math.floor(j/16))* (Math.floor((15238*j)/43)) + 29;
  let im = Math.floor((24*l)/709);
  let id = l - Math.floor((709*im)/24);
  let iy = 30*n + j - 30;
  return {y:iy, m:im, d:id};
}
const hijriNames = ["","Muharram","Safar","Rabi I","Rabi II","Jumada I","Jumada II","Rajab","Sha'ban","Ramadan","Shawwal","Dhul‑Qa'da","Dhul‑Hijja"];

async function render(){
  const d = baseDate.valueAsDate || new Date();
  d.setHours(12,0,0,0);
  const weekday = d.toLocaleDateString('en-GB',{weekday:'short'});
  dow.textContent = `${weekday} ${fmtDate(d)}`;
  lines.innerHTML='';

  // English
  const L1 = document.createElement('div');
  L1.innerHTML = `<b>English:</b> ${fmtDate(d)}`;
  lines.appendChild(L1);

  // Islamic with offset
  const off = parseInt(hOffset.value||'0',10);
  const ih = islamicFromGregorian(d, off);
  const L2 = document.createElement('div');
  L2.innerHTML = `<b>Islamic:</b> ${ih.d} ${hijriNames[ih.m]} ${ih.y} <span class="badge">offset ${off}</span>`;
  lines.appendChild(L2);

  // Punjabi
  const pj = punjabiFromGregorian(d);
  const L3 = document.createElement('div');
  L3.innerHTML = `<b>Punjabi (پنجابی):</b> <span>${pj.day} ${pj.name} ${pj.year}</span>`;
  lines.appendChild(L3);

  document.getElementById('punjMonthTitle').textContent = `${pj.name}`;
  await loadFarming(pj.slug);
  await loadWeather();
  renderReminders(d);
}

// ===== Farming guide =====
async function loadFarming(slug){
  const enUl = document.getElementById('farmEN');
  const urUl = document.getElementById('farmUR');
  enUl.innerHTML = urUl.innerHTML = '';
  try{
    const res = await fetch('./data/farming.json');
    const data = await res.json();
    const node = data[slug];
    if(!node){ enUl.innerHTML = '<li>No data</li>'; return; }
    node.en.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; enUl.appendChild(li); });
    node.ur.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; urUl.appendChild(li); });
  }catch(e){
    const li=document.createElement('li'); li.textContent='Farming info not available offline.'; enUl.appendChild(li);
  }
}

// ===== Weather (AccuWeather with fallback to Open-Meteo) =====
const ACCU_KEY = '3cc0a720c53d301eee60835dd14d082a'; // user-provided
const LAT = 30.6709846, LON = 73.2896608;

async function loadWeather(){
  const wxLine = document.getElementById('wxLine');
  const sprayLine = document.getElementById('sprayLine');
  wxLine.textContent = 'Loading weather...'; sprayLine.textContent = '';
  let tempC=null, windMs=null, source='';
  try{
    // Find AccuWeather location key by coordinates
    const gp = await fetch(`https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${ACCU_KEY}&q=${LAT}%2C${LON}`);
    if(!gp.ok) throw new Error('loc fail');
    const loc = await gp.json();
    const locKey = loc.Key;
    const cc = await fetch(`https://dataservice.accuweather.com/currentconditions/v1/${locKey}?apikey=${ACCU_KEY}&details=true`);
    if(!cc.ok) throw new Error('cc fail');
    const arr = await cc.json();
    const c = arr[0];
    tempC = c.Temperature.Metric.Value;
    // Accu returns km/h; convert to m/s
    windMs = (c.Wind.Speed.Metric.Value)/3.6;
    source='AccuWeather';
  }catch(e){
    // Fallback Open-Meteo
    try{
      const om = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,wind_speed_10m&timezone=auto`);
      const j = await om.json();
      tempC = j.current.temperature_2m;
      windMs = j.current.wind_speed_10m/3.6; // if it comes km/h
      source='Open‑Meteo';
    }catch(e2){
      wxLine.textContent = 'Weather not available (offline).';
      return;
    }
  }
  document.getElementById('wxBadge').textContent = source;
  wxLine.textContent = `Temp ${tempC.toFixed(1)}°C, wind ${windMs.toFixed(2)} m/s`;

  // Spray guidance
  const ok = windMs<=2.0;
  sprayLine.innerHTML = ok ? `<span class="ok">✔ Suitable for spraying</span> — ہوا کم ہے، سپرے کیا جا سکتا ہے۔`
                           : `<span class="warn">⚠ Not ideal for spraying</span> — ہوا تیز ہے، سپرے مؤخر کریں۔`;
}

// ===== Reminders =====
const remKey = 'gunnocal-reminders';
let reminders = JSON.parse(localStorage.getItem(remKey) || '[]');
document.getElementById('addRem').onclick = ()=>{
  const t = prompt('Reminder title?'); if(!t) return;
  const d = baseDate.value || new Date().toISOString().slice(0,10);
  reminders.push({date:d, title:t}); localStorage.setItem(remKey, JSON.stringify(reminders)); renderReminders();
};
function renderReminders(d){
  const ul = document.getElementById('remList'); ul.innerHTML='';
  reminders.filter(r=>!d || r.date===d.toISOString().slice(0,10)).forEach(r=>{
    const li=document.createElement('li'); li.textContent=`${r.date}: ${r.title}`; ul.appendChild(li);
  });
}
document.getElementById('exportBtn').onclick = ()=>{
  const blob = new Blob([JSON.stringify(reminders,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reminders.json'; a.click();
};
document.getElementById('importFile').onchange = e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ reminders=JSON.parse(r.result||'[]'); localStorage.setItem(remKey, JSON.stringify(reminders)); renderReminders(); };
  r.readAsText(f);
};

// Init
setDateToToday();
