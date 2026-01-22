// RB Taxi checklist PWA (offline + optional endpoint submit)
const STORAGE_KEY = "rb_checklist_v1";
const DRAFT_KEY = "rb_checklist_draft_v1";
const ENDPOINT_KEY = "rb_checklist_endpoint_v1";

const $ = (id) => document.getElementById(id);

const lists = {
  pre_vehicle: [
    { id:"fuel", t:"Palivo / baterie OK", s:"Zkontroluj stav + případně dobít."},
    { id:"tires", t:"Pneumatiky OK", s:"Vizuálně + tlak (když je podezření)."},
    { id:"lights", t:"Světla OK", s:"Potkávací + blinkry + brzda."},
    { id:"brakes", t:"Brzdy OK", s:"Krátká kontrola po rozjezdu."},
    { id:"wipers", t:"Stěrače + kapalina", s:"Bezpečnost = minimum."},
    { id:"clean_in", t:"Interiér čistý", s:"Sedáky, podlaha, pásy."},
    { id:"clean_out", t:"Exteriér čistý", s:"Skla + SPZ viditelná."},
  ],
  pre_equipment: [
    { id:"kit", t:"Lékárnička", s:"Dostupná + neprošlá."},
    { id:"triangle", t:"Výstražný trojúhelník", s:"V kufru / dostupný."},
    { id:"vest", t:"Reflexní vesta", s:"Ideálně 2 ks."},
    { id:"docs", t:"Doklady", s:"ŘP / povolení / doklady vozu."},
  ],
  pre_tech: [
    { id:"app", t:"Taxi aplikace funkční", s:"Přihlášení + data."},
    { id:"terminal", t:"Platební terminál OK", s:"Baterie + signál."},
    { id:"nav", t:"Navigace funkční", s:"GPS + data."},
    { id:"charger", t:"Nabíječka v autě", s:"Kabel + držák."},
  ],
  during: [
    { id:"rules", t:"Dodržuji pravidla firmy", s:"Žádné improvizace."},
    { id:"payments", t:"Platby probíhají správně", s:"Karta/hotovost dle účtenky."},
    { id:"behavior", t:"Chování k zákazníkům OK", s:"Slušnost, pomoc, klid."},
    { id:"handsfree", t:"Telefon jen handsfree", s:"Bez výjimky."},
  ],
  post: [
    { id:"end_apps", t:"Ukončena směna v aplikacích", s:"Odhlásit / offline."},
    { id:"revenue_check", t:"Tržby zkontrolovány", s:"Hotovost vs karta."},
    { id:"cash", t:"Hotovost odevzdána / evidována", s:"Podle pravidel."},
  ]
};

function renderChecks(containerId, items){
  const el = $(containerId);
  el.innerHTML = "";
  for (const it of items){
    const wrap = document.createElement("label");
    wrap.className = "check";
    wrap.innerHTML = `
      <input type="checkbox" id="${containerId}_${it.id}">
      <div>
        <div class="lbl">${it.t}</div>
        <div class="sub">${it.s || ""}</div>
      </div>
    `;
    el.appendChild(wrap);
  }
}

function todayStr(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toast);
  window.__toast = setTimeout(()=> t.style.display="none", 2400);
}

function getForm(){
  const getC = (id) => ($(id)?.checked) || false;
  const payload = {
    date: todayStr(),
    ts: new Date().toISOString(),
    driver: $("driver").value.trim(),
    vehicle: $("vehicle").value.trim(),
    shiftStart: $("shiftStart").value || "",
    shiftEnd: $("shiftEnd").value || "",
    kmStart: $("kmStart").value.trim(),
    kmEnd: $("kmEnd").value.trim(),
    issues: $("issues").value.trim(),
    incident: $("incident").value.trim(),
    checks: {}
  };

  for (const [k, arr] of Object.entries(lists)){
    payload.checks[k] = {};
    for (const it of arr){
      payload.checks[k][it.id] = getC(`${k}_${it.id}`);
    }
  }
  // post section stored under checks.post
  payload.checks.post = {};
  for (const it of lists.post){
    payload.checks.post[it.id] = getC(`post_${it.id}`);
  }
  return payload;
}

function setForm(data){
  if (!data) return;
  $("driver").value = data.driver || "";
  $("vehicle").value = data.vehicle || "";
  $("shiftStart").value = data.shiftStart || "";
  $("shiftEnd").value = data.shiftEnd || "";
  $("kmStart").value = data.kmStart || "";
  $("kmEnd").value = data.kmEnd || "";
  $("issues").value = data.issues || "";
  $("incident").value = data.incident || "";

  const setC = (id, v) => { const el = $(id); if (el) el.checked = !!v; };
  for (const [k, arr] of Object.entries(lists)){
    for (const it of arr){
      setC(`${k}_${it.id}`, data?.checks?.[k]?.[it.id]);
    }
  }
  for (const it of lists.post){
    setC(`post_${it.id}`, data?.checks?.post?.[it.id]);
  }
}

function loadHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveHistory(items){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadDraft(){
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); }
  catch { return null; }
}
function saveDraft(d){
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function validate(payload){
  const errors = [];
  if (!payload.driver) errors.push("Doplň Řidič.");
  if (!payload.vehicle) errors.push("Doplň Vozidlo.");
  // km numeric basic check (optional)
  const num = (v) => v && !/^\d+$/.test(v);
  if (num(payload.kmStart)) errors.push("Stav km – začátek má být číslo.");
  if (num(payload.kmEnd)) errors.push("Stav km – konec má být číslo.");
  return errors;
}

function renderHistory(){
  const list = $("history");
  const items = loadHistory().slice().reverse();
  if (!items.length){
    list.innerHTML = `<div class="small">Zatím nic. Po odeslání se záznam uloží i offline.</div>`;
    return;
  }
  list.innerHTML = "";
  for (const it of items){
    const div = document.createElement("div");
    div.className = "item";
    const km = (it.kmStart && it.kmEnd) ? `km ${it.kmStart} → ${it.kmEnd}` : "km nezadané";
    div.innerHTML = `
      <div class="row">
        <div><strong>${it.date}</strong> • ${escapeHtml(it.driver)} • ${escapeHtml(it.vehicle)}</div>
        <div class="small">${new Date(it.ts).toLocaleString("cs-CZ")}</div>
      </div>
      <div class="meta">${km} • závady: ${it.issues ? "ano" : "ne"} • incident: ${it.incident ? "ano" : "ne"}</div>
    `;
    list.appendChild(div);
  }
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

async function postToEndpoint(endpoint, payload){
  // Works with Apps Script or any JSON endpoint.
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return txt;
}

function clearForm(){
  setForm({
    driver: $("driver").value, // keep
    vehicle: $("vehicle").value, // keep
    checks: {}
  });
  $("shiftStart").value = "";
  $("shiftEnd").value = "";
  $("kmStart").value = "";
  $("kmEnd").value = "";
  $("issues").value = "";
  $("incident").value = "";
  // uncheck all
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function download(filename, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:"text/plain;charset=utf-8"}));
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
}

function toCSV(items){
  // Flatten a few useful fields + checks completion %
  const header = ["date","ts","driver","vehicle","shiftStart","shiftEnd","kmStart","kmEnd","issues","incident","pre_done_pct","post_done_pct"];
  const rows = [header.join(",")];

  const pct = (obj) => {
    const vals = Object.values(obj||{});
    if (!vals.length) return "";
    const done = vals.filter(Boolean).length;
    return Math.round((done/vals.length)*100);
  }

  for (const it of items){
    const pre = {
      ...it.checks?.pre_vehicle,
      ...it.checks?.pre_equipment,
      ...it.checks?.pre_tech
    };
    const post = it.checks?.post || {};
    const row = [
      it.date, it.ts, it.driver, it.vehicle,
      it.shiftStart||"", it.shiftEnd||"",
      it.kmStart||"", it.kmEnd||"",
      (it.issues||"").replace(/\n/g," ").replace(/"/g,'""'),
      (it.incident||"").replace(/\n/g," ").replace(/"/g,'""'),
      pct(pre), pct(post)
    ].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",");
    rows.push(row);
  }
  return rows.join("\n");
}

// Install prompt handling
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").hidden = true;
});

// Init
$("todayPill").textContent = todayStr();

renderChecks("pre_vehicle", lists.pre_vehicle);
renderChecks("pre_equipment", lists.pre_equipment);
renderChecks("pre_tech", lists.pre_tech);
renderChecks("during", lists.during);

// Post checks rendered separately to keep section headings simple
renderChecks("post", lists.post);

// Endpoint
$("endpoint").value = localStorage.getItem(ENDPOINT_KEY) || "";
$("endpoint").addEventListener("change", () => {
  localStorage.setItem(ENDPOINT_KEY, $("endpoint").value.trim());
  toast("Endpoint uložen.");
});

const draft = loadDraft();
if (draft){
  setForm(draft);
  $("startHint").textContent = "Našel jsem rozpracovaný checklist – načteno.";
}
renderHistory();

// Buttons
$("btnStart").addEventListener("click", () => {
  const now = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  $("shiftStart").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  toast("Směna zahájena (čas doplněn).");
});

$("btnSave1").addEventListener("click", () => { saveDraft(getForm()); toast("Uloženo (rozpracované)."); });
$("btnSave2").addEventListener("click", () => { saveDraft(getForm()); toast("Uloženo (rozpracované)."); });

$("btnSubmit").addEventListener("click", async () => {
  const payload = getForm();
  const errors = validate(payload);
  if (errors.length){
    toast(errors[0]);
    return;
  }

  // Always store offline first
  const history = loadHistory();
  history.push(payload);
  saveHistory(history);
  saveDraft(null);
  renderHistory();

  const endpoint = ($("endpoint").value || "").trim();
  if (!endpoint){
    toast("Odesláno do telefonu (offline). Pro centrální sběr nastav endpoint.");
    clearForm();
    return;
  }

  try{
    toast("Odesílám…");
    await postToEndpoint(endpoint, payload);
    toast("✅ Odesláno do systému i uložené offline.");
    clearForm();
  }catch(err){
    toast("⚠️ Endpoint nedostupný – uloženo offline.");
    console.error(err);
  }
});

$("btnTest").addEventListener("click", async () => {
  const endpoint = ($("endpoint").value || "").trim();
  $("endpointStatus").textContent = "";
  if (!endpoint){
    $("endpointStatus").textContent = "Doplň endpoint URL.";
    return;
  }
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  try{
    await postToEndpoint(endpoint, { ping:true, ts:new Date().toISOString() });
    $("endpointStatus").textContent = "✅ OK – endpoint přijímá data.";
  }catch(err){
    $("endpointStatus").textContent = "⚠️ Neprošlo: " + (err?.message || err);
  }
});

$("btnExport").addEventListener("click", () => {
  const items = loadHistory();
  if (!items.length){ toast("Nic k exportu."); return; }
  const csv = toCSV(items);
  download(`rb_checklist_${todayStr().replace(/\./g,'-')}.csv`, csv);
  toast("Exportováno CSV.");
});

$("btnClear").addEventListener("click", () => {
  if (!confirm("Smazat historii v telefonu?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  toast("Historie smazána.");
});
