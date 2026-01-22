// RB Taxi checklist PWA (offline + optional endpoint submit) — FIXED v7
// ✓ OK / ✕ Není v pořádku + poznámka při ✕
// Bez sekce "Během směny" (odstraněno)

const STORAGE_KEY = "rb_checklist_v7_history";
const DRAFT_KEY   = "rb_checklist_v7_draft";
const ENDPOINT_KEY= "rb_checklist_v7_endpoint";

const $ = (id) => document.getElementById(id);

const lists = {
  pre_vehicle: [
    { id:"fuel",     t:"Palivo / baterie OK",      s:"Zkontroluj stav + případně dobít." },
    { id:"tires",    t:"Pneumatiky OK",            s:"Vizuálně + tlak (když je podezření)." },
    { id:"lights",   t:"Světla OK",                s:"Potkávací + blinkry + brzda." },
    { id:"brakes",   t:"Brzdy OK",                 s:"Krátká kontrola po rozjezdu." },
    { id:"wipers",   t:"Stěrače + kapalina",       s:"Bezpečnost = minimum." },
    { id:"clean_in", t:"Interiér čistý",           s:"Sedáky, podlaha, pásy." },
    { id:"clean_out",t:"Exteriér čistý",           s:"Skla + SPZ viditelná." }
  ],
  pre_equipment: [
    { id:"kit",      t:"Lékárnička",               s:"Dostupná + neprošlá." },
    { id:"triangle", t:"Výstražný trojúhelník",    s:"V kufru / dostupný." },
    { id:"vest",     t:"Reflexní vesta",           s:"Ideálně 2 ks." },
    { id:"docs",     t:"Doklady",                  s:"ŘP / povolení / doklady vozu." }
  ],
  pre_tech: [
    { id:"app",      t:"Taxi aplikace funkční",    s:"Přihlášení + data." },
    { id:"terminal", t:"Platební terminál OK",     s:"Baterie + signál." },
    { id:"nav",      t:"Navigace funkční",         s:"GPS + data." },
    { id:"charger",  t:"Nabíječka v autě",         s:"Kabel + držák." }
  ],
  post: [
    { id:"end_apps",     t:"Ukončena směna v aplikacích", s:"Odhlásit / offline." },
    { id:"revenue_check",t:"Tržby zkontrolovány",         s:"Hotovost vs karta." },
    { id:"cash",         t:"Hotovost odevzdána / evidována", s:"Podle pravidel." }
  ]
};

function todayStr(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}

function toast(msg){
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toast);
  window.__toast = setTimeout(()=> t.style.display="none", 2400);
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

function renderChecks(containerId, items){
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = "";

  for (const it of items){
    const row = document.createElement("div");
    row.className = "check";
    row.dataset.key = `${containerId}:${it.id}`;
    row.dataset.state = "";
    row.dataset.note = "";

    row.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;width:100%">
        <div style="flex:1">
          <div class="lbl">${it.t}</div>
          <div class="sub">${it.s || ""}</div>

          <div class="checkNote" hidden>
            <span class="noteLabel">Popis (proč ✕):</span>
            <textarea placeholder="Stručně co je špatně + co je potřeba udělat…"></textarea>
          </div>
        </div>

        <div class="stateBtns">
          <button type="button" class="stateBtn ok" aria-label="OK">✓</button>
          <button type="button" class="stateBtn nok" aria-label="Není v pořádku">✕</button>
        </div>
      </div>
    `;

    const okBtn = row.querySelector(".stateBtn.ok");
    const nokBtn = row.querySelector(".stateBtn.nok");
    const noteWrap = row.querySelector(".checkNote");
    const noteTa = row.querySelector(".checkNote textarea");

    const setState = (state) => {
      row.dataset.state = state || "";
      okBtn.classList.toggle("active", state === "ok");
      nokBtn.classList.toggle("active", state === "nok");

      const showNote = (state === "nok");
      noteWrap.hidden = !showNote;
      if (!showNote) {
        // note can remain saved; but hidden
      }
    };

    okBtn.addEventListener("click", () => setState(row.dataset.state === "ok" ? "" : "ok"));
    nokBtn.addEventListener("click", () => setState(row.dataset.state === "nok" ? "" : "nok"));

    noteTa.addEventListener("input", () => {
      row.dataset.note = noteTa.value || "";
    });

    setState("");
    el.appendChild(row);
  }
}

function getState(container, itemId){
  const node = document.querySelector(`[data-key="${container}:${itemId}"]`);
  const s = node?.dataset?.state || "";
  return s || null; // "ok" | "nok" | null
}
function getNote(container, itemId){
  const node = document.querySelector(`[data-key="${container}:${itemId}"]`);
  const n = node?.dataset?.note || "";
  return (n || "").trim();
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
  if (!d) localStorage.removeItem(DRAFT_KEY);
  else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}

function getForm(){
  const payload = {
    date: todayStr(),
    ts: new Date().toISOString(),
    driver: ($("driver")?.value || "").trim(),
    vehicle: ($("vehicle")?.value || "").trim(),
    shiftStart: $("shiftStart")?.value || "",
    shiftEnd: $("shiftEnd")?.value || "",
    kmStart: ($("kmStart")?.value || "").trim(),
    kmEnd: ($("kmEnd")?.value || "").trim(),
    issues: ($("issues")?.value || "").trim(),
    incident: ($("incident")?.value || "").trim(),
    checks: {},
    notes: {}
  };

  for (const [k, arr] of Object.entries(lists)){
    payload.checks[k] = {};
    payload.notes[k] = {};
    for (const it of arr){
      payload.checks[k][it.id] = getState(k, it.id);
      const note = getNote(k, it.id);
      if (note) payload.notes[k][it.id] = note;
    }
  }
  return payload;
}

function setForm(data){
  if (!data) return;
  if ($("driver")) $("driver").value = data.driver || "";
  if ($("vehicle")) $("vehicle").value = data.vehicle || "";
  if ($("shiftStart")) $("shiftStart").value = data.shiftStart || "";
  if ($("shiftEnd")) $("shiftEnd").value = data.shiftEnd || "";
  if ($("kmStart")) $("kmStart").value = data.kmStart || "";
  if ($("kmEnd")) $("kmEnd").value = data.kmEnd || "";
  if ($("issues")) $("issues").value = data.issues || "";
  if ($("incident")) $("incident").value = data.incident || "";

  const setRow = (container, itemId, state, noteText) => {
    const node = document.querySelector(`[data-key="${container}:${itemId}"]`);
    if (!node) return;
    const okBtn = node.querySelector(".stateBtn.ok");
    const nokBtn = node.querySelector(".stateBtn.nok");
    const noteWrap = node.querySelector(".checkNote");
    const noteTa = node.querySelector(".checkNote textarea");

    const st = (state === "ok" || state === "nok") ? state : "";
    node.dataset.state = st;
    okBtn.classList.toggle("active", st === "ok");
    nokBtn.classList.toggle("active", st === "nok");

    const note = (noteText || "").trim();
    node.dataset.note = note;
    if (noteTa) noteTa.value = note;

    const showNote = (st === "nok");
    if (noteWrap) noteWrap.hidden = !showNote;
  };

  for (const [k, arr] of Object.entries(lists)){
    for (const it of arr){
      setRow(k, it.id, data?.checks?.[k]?.[it.id], data?.notes?.[k]?.[it.id]);
    }
  }
}

function clearChecks(){
  document.querySelectorAll("[data-key]").forEach(node => {
    node.dataset.state = "";
    node.dataset.note = "";
    node.querySelectorAll(".stateBtn").forEach(b => b.classList.remove("active"));
    const noteWrap = node.querySelector(".checkNote");
    if (noteWrap) noteWrap.hidden = true;
    const ta = node.querySelector(".checkNote textarea");
    if (ta) ta.value = "";
  });
}

function validate(payload){
  const errors = [];
  if (!payload.driver) errors.push("Doplň Řidič.");
  if (!payload.vehicle) errors.push("Doplň Vozidlo.");

  const isBadNum = (v) => v && !/^\d+$/.test(v);
  if (isBadNum(payload.kmStart)) errors.push("Stav km – začátek má být číslo.");
  if (isBadNum(payload.kmEnd)) errors.push("Stav km – konec má být číslo.");

  return errors;
}

async function postToEndpoint(endpoint, payload){
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return txt;
}

function renderHistory(){
  const list = $("history");
  if (!list) return;

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
    const nokCount = (() => {
      const all = Object.assign({}, it.checks?.pre_vehicle, it.checks?.pre_equipment, it.checks?.pre_tech, it.checks?.post);
      return Object.values(all || {}).filter(v => v === "nok").length;
    })();

    div.innerHTML = `
      <div class="row">
        <div><strong>${it.date}</strong> • ${escapeHtml(it.driver)} • ${escapeHtml(it.vehicle)}</div>
        <div class="small">${new Date(it.ts).toLocaleString("cs-CZ")}</div>
      </div>
      <div class="meta">${km} • ✕: ${nokCount} • závady: ${it.issues ? "ano" : "ne"} • incident: ${it.incident ? "ano" : "ne"}</div>
    `;
    list.appendChild(div);
  }
}

function download(filename, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:"text/plain;charset=utf-8"}));
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
}

function toCSV(items){
  const header = ["date","ts","driver","vehicle","shiftStart","shiftEnd","kmStart","kmEnd","pre_ok_pct","post_ok_pct","nok_count","nok_notes","issues","incident"];
  const rows = [header.join(",")];

  const pctOk = (obj) => {
    const vals = Object.values(obj||{});
    if (!vals.length) return "";
    const ok = vals.filter(v => v === "ok").length;
    return Math.round((ok/vals.length)*100);
  };

  const flattenNotes = (notesObj) => {
    const out = [];
    for (const [k, v] of Object.entries(notesObj||{})){
      if (typeof v === "string" && v.trim()) out.push(`${k}:${v.trim()}`);
    }
    return out.join(" | ");
  };

  for (const it of items){
    const pre = Object.assign({}, it.checks?.pre_vehicle, it.checks?.pre_equipment, it.checks?.pre_tech);
    const post = it.checks?.post || {};
    const nok = (Object.values(pre).filter(v=>v==="nok").length) + (Object.values(post).filter(v=>v==="nok").length);

    const notes = Object.assign({}, it.notes?.pre_vehicle, it.notes?.pre_equipment, it.notes?.pre_tech, it.notes?.post);

    const row = [
      it.date, it.ts, it.driver, it.vehicle,
      it.shiftStart||"", it.shiftEnd||"",
      it.kmStart||"", it.kmEnd||"",
      pctOk(pre), pctOk(post),
      nok, flattenNotes(notes),
      (it.issues||"").replace(/\n/g," ").replace(/"/g,'""'),
      (it.incident||"").replace(/\n/g," ").replace(/"/g,'""')
    ].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",");
    rows.push(row);
  }
  return rows.join("\n");
}

// --- Install prompt handling (optional)
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("installBtn");
  if (btn) btn.hidden = false;
});
$("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").hidden = true;
});

// --- Init UI
$("todayPill") && ($("todayPill").textContent = todayStr());

renderChecks("pre_vehicle", lists.pre_vehicle);
renderChecks("pre_equipment", lists.pre_equipment);
renderChecks("pre_tech", lists.pre_tech);
renderChecks("post", lists.post);

// Endpoint
const endpointInput = $("endpoint");
if (endpointInput){
  endpointInput.value = localStorage.getItem(ENDPOINT_KEY) || "";
  endpointInput.addEventListener("change", () => {
    localStorage.setItem(ENDPOINT_KEY, (endpointInput.value || "").trim());
    toast("Endpoint uložen.");
  });
}

// Load draft
const draft = loadDraft();
if (draft){
  setForm(draft);
  const hint = $("startHint");
  if (hint) hint.textContent = "Našel jsem rozpracovaný checklist – načteno.";
}
renderHistory();

// Buttons
$("btnStart")?.addEventListener("click", () => {
  const now = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  if ($("shiftStart")) $("shiftStart").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  toast("Směna zahájena (čas doplněn).");
});

$("btnSave1")?.addEventListener("click", () => { saveDraft(getForm()); toast("Uloženo (rozpracované)."); });
$("btnSave2")?.addEventListener("click", () => { saveDraft(getForm()); toast("Uloženo (rozpracované)."); });

$("btnSubmit")?.addEventListener("click", async () => {
  const payload = getForm();
  const errors = validate(payload);
  if (errors.length){
    toast(errors[0]);
    return;
  }

  // store offline first
  const history = loadHistory();
  history.push(payload);
  saveHistory(history);
  saveDraft(null);
  renderHistory();

  const endpoint = (endpointInput?.value || "").trim();
  if (!endpoint){
    toast("Uloženo offline. Pro centrální sběr nastav endpoint.");
    // clear post fields, keep driver/vehicle
    if ($("shiftEnd")) $("shiftEnd").value = "";
    if ($("kmStart")) $("kmStart").value = "";
    if ($("kmEnd")) $("kmEnd").value = "";
    if ($("issues")) $("issues").value = "";
    if ($("incident")) $("incident").value = "";
    clearChecks();
    return;
  }

  try{
    toast("Odesílám…");
    await postToEndpoint(endpoint, payload);
    toast("✅ Odesláno + uloženo offline.");
    if ($("shiftEnd")) $("shiftEnd").value = "";
    if ($("kmStart")) $("kmStart").value = "";
    if ($("kmEnd")) $("kmEnd").value = "";
    if ($("issues")) $("issues").value = "";
    if ($("incident")) $("incident").value = "";
    clearChecks();
  }catch(err){
    console.error(err);
    toast("⚠️ Endpoint nedostupný – uloženo offline.");
  }
});

$("btnTest")?.addEventListener("click", async () => {
  const endpoint = (endpointInput?.value || "").trim();
  const status = $("endpointStatus");
  if (status) status.textContent = "";
  if (!endpoint){
    if (status) status.textContent = "Doplň endpoint URL.";
    return;
  }
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  try{
    await postToEndpoint(endpoint, { ping:true, ts:new Date().toISOString() });
    if (status) status.textContent = "✅ OK – endpoint přijímá data.";
    toast("Endpoint OK.");
  }catch(err){
    if (status) status.textContent = "⚠️ Neprošlo: " + (err?.message || err);
    toast("Endpoint neprošel.");
  }
});

$("btnExport")?.addEventListener("click", () => {
  const items = loadHistory();
  if (!items.length){ toast("Nic k exportu."); return; }
  const csv = toCSV(items);
  download(`rb_checklist_${todayStr().replace(/\./g,'-')}.csv`, csv);
  toast("Export CSV hotový.");
});

$("btnClear")?.addEventListener("click", () => {
  if (!confirm("Smazat historii v telefonu?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  toast("Historie smazána.");
});
