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
    takenFrom: ($("takenFrom")?.value || "").trim(),
    handoverNote: ($("handoverNote")?.value || "").trim(),
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
  if ($("takenFrom")) $("takenFrom").value = data.takenFrom || "";
  if ($("handoverNote")) $("handoverNote").value = data.handoverNote || "";
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

const ALLOWED_PLATES = ["2BY5398","1BU0299","1BU0060","2BL8995","2BT1565"];

function validate(payload){
  const errors = [];
  if (!payload.driver) errors.push("Doplň Řidič.");
  if (!payload.vehicle) errors.push("Vyber SPZ vozidla.");
  if (payload.vehicle && !ALLOWED_PLATES.includes(payload.vehicle)) errors.push("Neplatná SPZ.");
  if (!payload.takenFrom) errors.push("Doplň: Převzato po (řidič).");

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

    const nokLines = [];
    for (const [k, arr] of Object.entries(lists)){
      for (const item of arr){
        const st = it.checks?.[k]?.[item.id] ?? null;
        if (st === "nok"){
          const note = it.notes?.[k]?.[item.id] || "";
          nokLines.push(`• ${item.t}${note ? " — " + escapeHtml(note) : ""}`);
        }
      }
    }

    div.innerHTML = `
      <div class="row">
        <div><strong>${it.date}</strong> • ${escapeHtml(it.driver)} • <strong>${escapeHtml(it.vehicle)}</strong></div>
        <div class="small">${new Date(it.ts).toLocaleString("cs-CZ")}</div>
      </div>
      <div class="meta">
        převzato po: <strong>${escapeHtml(it.takenFrom || "—")}</strong>
        ${it.handoverNote ? ` • pozn.: ${escapeHtml(it.handoverNote)}` : ""}
        • ${km}
        • ✕: <strong>${nokLines.length}</strong>
      </div>
      ${nokLines.length ? `
        <details class="mini">
          <summary class="small">Zobrazit NEOK položky</summary>
          <div class="small" style="margin-top:6px;line-height:1.35">${nokLines.join("<br>")}</div>
        </details>
      ` : `<div class="small">Vše OK.</div>`}
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


function buildPrintableHTML(record){
  const sections = [
    ["Vozidlo (SPZ)", record.vehicle || ""],
    ["Řidič", record.driver || ""],
    ["Převzato po", record.takenFrom || ""],
    ["Poznámka převzetí", record.handoverNote || ""],
    ["Začátek směny", record.shiftStart || ""],
    ["Konec směny", record.shiftEnd || ""],
    ["Km start", record.kmStart || ""],
    ["Km konec", record.kmEnd || ""],
    ["Závady dnes", record.issues || ""],
    ["Incident", record.incident || ""],
  ];

  const statusLabel = (v)=> v==="ok" ? "OK" : (v==="nok" ? "NEOK" : "NEVYPLNĚNO");
  const statusClass = (v)=> v==="ok" ? "stOk" : (v==="nok" ? "stNok" : "stEmpty");

  const groupTitles = {
    pre_vehicle: "Před směnou – Vozidlo",
    pre_equipment: "Před směnou – Povinná výbava",
    pre_tech: "Před směnou – Taxi technika",
    post: "Po směně – Ukončení směny"
  };

  let checksHtml = "";
  for (const [k, arr] of Object.entries(lists)){
    checksHtml += `<h3>${groupTitles[k] || k}</h3><table class="tbl"><thead><tr><th>Položka</th><th>Stav</th><th>Popis při ✕</th></tr></thead><tbody>`;
    for (const it of arr){
      const st = record.checks?.[k]?.[it.id] ?? null;
      const note = record.notes?.[k]?.[it.id] || "";
      checksHtml += `<tr>
        <td>${escapeHtml(it.t)}</td>
        <td class="${statusClass(st)}">${statusLabel(st)}</td>
        <td>${escapeHtml(note)}</td>
      </tr>`;
    }
    checksHtml += `</tbody></table>`;
  }

  const metaRows = sections
    .filter(([_,v])=>String(v||"").trim()!=="")
    .map(([k,v])=>`<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
    .join("");

  return `<!doctype html>
  <html lang="cs"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RB Taxi – Checklist – ${escapeHtml(record.vehicle||"")}</title>
  <style>
    @page { size: A4; margin: 6mm; }
    html,body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body{
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
      color:#111;
      margin:0;
    }
    /* One-page compaction */
    .page{
      width: 198mm; /* 210mm - margins approx */
      transform: scale(0.82);
      transform-origin: top left;
    }
    h1{margin:0 0 4px; font-size:16px;}
    .sub{color:#555; margin:0 0 10px; font-size:10px;}
    h3{margin:10px 0 6px; font-size:11px;}
    table{border-collapse:collapse; width:100%; margin:6px 0 10px; page-break-inside:avoid;}
    th,td{border:1px solid #ddd; padding:5px 6px; vertical-align:top; font-size:9px; line-height:1.15;}
    th{background:#f6f6f6; text-align:left;}
    .tbl thead th{font-size:9px;}
    .stOk{background:#e9f9ef;}
    .stNok{background:#fdecec;}
    .stEmpty{background:#f3f4f6; color:#555;}
    tr{page-break-inside:avoid;}
    @media print{ body{margin:0;} }
  </style></head>
  <body>
    <div class="page">
    <h1>RB Taxi – Denní checklist</h1>
    <p class="sub">${escapeHtml(record.date||"")} • ${escapeHtml(new Date(record.ts).toLocaleString("cs-CZ"))}</p>
    <h3>Identifikace</h3>
    <table><tbody>${metaRows}</tbody></table>
    ${checksHtml}
      </div>
  </body></html>`;
}

$("btnExport")?.addEventListener("click", () => {
  const items = loadHistory();
  if (!items.length){ toast("Nic k exportu."); return; }
  const latest = items[items.length - 1];
  const w = window.open("", "_blank");
  if (!w){ toast("Povol pop-up okna pro export PDF."); return; }
  w.document.open();
  w.document.write(buildPrintableHTML(latest));
  w.document.close();
  setTimeout(()=> { w.focus(); w.print(); }, 350);
  toast("Otevřeno pro tisk / uložit jako PDF.");
});

$("btnClear")?.addEventListener("click", () => {
  if (!confirm("Smazat historii v telefonu?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  toast("Historie smazána.");
});

/* RB_UI_V18_GUARD */
(function(){
  function jumpTo(selector){
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function setActiveSeg(selector){
    document.querySelectorAll(".segNav .seg").forEach(b => {
      b.classList.toggle("active", b.dataset.jump === selector);
    });
  }

  function computeStats(){
    const all = {};
    for (const [k, arr] of Object.entries(lists)){
      for (const it of arr){
        all[`${k}:${it.id}`] = getState(k, it.id);
      }
    }
    const preKeys = ["pre_vehicle","pre_equipment","pre_tech"];
    const preVals = preKeys.flatMap(k => lists[k].map(it => getState(k, it.id)));
    const postVals = lists.post.map(it => getState("post", it.id));

    const pct = (vals)=> {
      const filled = vals.filter(v => v==="ok" || v==="nok");
      if (!filled.length) return 0;
      const ok = filled.filter(v => v==="ok").length;
      return Math.round((ok/filled.length)*100);
    };

    const nokCount = Object.values(all).filter(v => v==="nok").length;
    return { prePct: pct(preVals), postPct: pct(postVals), nokCount };
  }

  function refreshPills(){
    const s = computeStats();
    const p1 = $("pillPre"); if (p1) p1.textContent = `Před: ${s.prePct}%`;
    const p2 = $("pillPost"); if (p2) p2.textContent = `Po: ${s.postPct}%`;
    const p3 = $("pillNok"); if (p3) p3.textContent = `✕: ${s.nokCount}`;
  }

  function refreshNokSummary(){
    const box = $("nokSummary");
    const listEl = $("nokSummaryList");
    if (!box || !listEl) return;

    const nok = [];
    for (const [k, arr] of Object.entries(lists)){
      for (const it of arr){
        const st = getState(k, it.id);
        if (st === "nok"){
          const note = getNote(k, it.id);
          const group = (k === "post") ? "Po směně" : "Před směnou";
          nok.push({ group, label: it.t, note });
        }
      }
    }

    if (!nok.length){
      box.hidden = true;
      listEl.innerHTML = "";
      return;
    }

    box.hidden = false;
    listEl.innerHTML = nok.map(x => `
      <div class="summaryItem">
        <span class="tag">${escapeHtml(x.group)}</span>
        <div><strong>${escapeHtml(x.label)}</strong>${x.note ? ` — ${escapeHtml(x.note)}` : ""}</div>
      </div>
    `).join("");
  }

  document.querySelectorAll(".segNav .seg").forEach(b => {
    b.addEventListener("click", () => {
      const sel = b.dataset.jump;
      setActiveSeg(sel);
      jumpTo(sel);
    });
  });

  $("barSave")?.addEventListener("click", () => {
    saveDraft(getForm());
    toast("Uloženo.");
  });
  $("barSubmit")?.addEventListener("click", () => $("btnSubmit")?.click());
  $("barExport")?.addEventListener("click", () => $("btnExport")?.click());

  document.addEventListener("click", (e) => {
    if (e.target?.classList?.contains("stateBtn")) { refreshPills(); refreshNokSummary(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target?.closest?.(".checkNote") || e.target?.id === "issues" || e.target?.id === "incident") {
      refreshPills(); refreshNokSummary();
    }
  });

  $("btnSubmit")?.addEventListener("click", () => {
    const se = $("shiftEnd");
    if (se && !se.value){
      const now = new Date();
      const pad=(n)=>String(n).padStart(2,"0");
      se.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
  }, true);

  const LAST_KEY = "rb_checklist_v18_last_values";
  function loadLast(){ try { return JSON.parse(localStorage.getItem(LAST_KEY)||"{}"); } catch { return {}; } }
  function saveLast(v){ localStorage.setItem(LAST_KEY, JSON.stringify(v||{})); }

  const draft = loadDraft?.() || null;
  if (!draft){
    const last = loadLast();
    if ($("driver") && !$("driver").value) $("driver").value = last.driver || "";
    if ($("vehicle") && !$("vehicle").value) $("vehicle").value = last.vehicle || "";
    if ($("takenFrom") && !$("takenFrom").value) $("takenFrom").value = last.takenFrom || "";
  }

  const _pushHistory = pushHistory;
  window.pushHistory = function(payload){
    try { saveLast({ driver: payload.driver, vehicle: payload.vehicle, takenFrom: payload.takenFrom }); } catch {}
    return _pushHistory(payload);
  }

  refreshPills();
  refreshNokSummary();
})();

/* RB_GATE_V20 */
(function(){
  // Gate submit until required fields + NOK notes are satisfied.
  function getRequiredState(){
    const driver = ($("driver")?.value || "").trim();
    const vehicle = ($("vehicle")?.value || "").trim();
    const takenFrom = ($("takenFrom")?.value || "").trim();

    const missing = [];
    if (!vehicle) missing.push("Vyber SPZ");
    if (!driver) missing.push("Vyplň řidiče");
    if (!takenFrom) missing.push("Vyplň „Převzato po“");

    // NOK notes: any item marked NOK must have non-empty note
    const nokMissing = [];
    for (const [k, arr] of Object.entries(lists)){
      for (const it of arr){
        const st = getState(k, it.id);
        if (st === "nok"){
          const note = (getNote(k, it.id) || "").trim();
          if (!note){
            // label + section
            const group = (k === "post") ? "Po směně" : "Před směnou";
            nokMissing.push(`${group}: ${it.t}`);
          }
        }
      }
    }
    return { missing, nokMissing };
  }

  function renderSubmitHint(state){
    const box = $("submitHint");
    if (!box) return;
    const msgs = [];
    if (state.missing.length) msgs.push("• " + state.missing.join(" • "));
    if (state.nokMissing.length){
      const list = state.nokMissing.slice(0, 4).map(x => `• Doplnit popis u ✕: ${x}`).join("<br>");
      msgs.push(list + (state.nokMissing.length > 4 ? `<br>• … a další (${state.nokMissing.length-4})` : ""));
    }
    if (!msgs.length){
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = `<strong>Nelze odeslat:</strong><br>${msgs.join("<br>")}`;
  }

  function setSubmitEnabled(enabled){
    const b1 = $("btnSubmit");
    const b2 = $("barSubmit");
    if (b1) b1.disabled = !enabled;
    if (b2) b2.disabled = !enabled;
  }

  function refreshGate(){
    const st = getRequiredState();
    const ok = (!st.missing.length && !st.nokMissing.length);
    setSubmitEnabled(ok);
    renderSubmitHint(st);
  }

  // Make sure refreshGate runs on relevant changes
  document.addEventListener("input", (e) => {
    const id = e.target?.id;
    if (["driver","vehicle","takenFrom"].includes(id)) refreshGate();
    if (e.target?.closest?.(".checkNote") || id==="issues" || id==="incident") refreshGate();
  });
  document.addEventListener("click", (e) => {
    if (e.target?.classList?.contains("stateBtn")) refreshGate();
  });

  // If user clicks disabled submit via other means, show toast
  function guardedSubmitClick(e){
    const st = getRequiredState();
    if (st.missing.length || st.nokMissing.length){
      e.preventDefault();
      e.stopPropagation();
      toast("Doplň povinné údaje / popis u ✕.");
      refreshGate();
      return false;
    }
  }
  $("btnSubmit")?.addEventListener("click", guardedSubmitClick, true);
  $("barSubmit")?.addEventListener("click", guardedSubmitClick, true);

  // Initial
  refreshGate();
})();

/* RB_V21_CORE */
(function(){
  // ----- config -----
  // Mark critical items by id (from v11 lists)
  const CRITICAL = new Set(["brakes","lights","triangle","firstaid"]);

  function isCriticalNok(){
    const crit = [];
    for (const [k, arr] of Object.entries(lists)){
      for (const it of arr){
        const st = getState(k, it.id);
        if (st === "nok" && CRITICAL.has(it.id)){
          const group = (k === "post") ? "Po směně" : "Před směnou";
          crit.push(`${group}: ${it.t}`);
        }
      }
    }
    return crit;
  }

  function refreshCriticalBox(){
    const crit = isCriticalNok();
    const box = $("criticalBox");
    const text = $("criticalText");
    const ack = $("criticalAck");
    if (!box || !text || !ack) return { crit, ok:true };
    if (!crit.length){
      box.hidden = true;
      ack.checked = false;
      text.innerHTML = "";
      return { crit, ok:true };
    }
    box.hidden = false;
    text.innerHTML = `Byla označena kritická závada:<br><strong>${crit.map(escapeHtml).join("<br>")}</strong><br><br><strong>VOZIDLO NESMÍ DO PROVOZU.</strong>`;
    // ok only if acknowledged
    const ok = !!ack.checked;
    return { crit, ok };
  }

  $("criticalAck")?.addEventListener("change", () => {
    // trigger V20 gate refresh if exists
    if (typeof window.__rb_refreshGate === "function") window.__rb_refreshGate();
  });

  // ----- carryover (previous shift NOK for same vehicle) -----
  function readHistory(){
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  }

  function lastShiftForVehicle(spz){
    if (!spz) return null;
    const h = readHistory();
    for (let i=h.length-1;i>=0;i--) {
      if ((h[i].vehicle||"").trim() === spz.trim()) return h[i];
    }
    return null;
  }

  function computeNokFromPayload(payload){
    const nok = [];
    if (!payload?.checks) return nok;
    for (const [k, obj] of Object.entries(payload.checks)){
      for (const [id, v] of Object.entries(obj || {})){
        if (v === "nok"){
          const note = payload.notes?.[k]?.[id] || "";
          // find title
          const it = (lists[k]||[]).find(x => x.id === id);
          const title = it ? it.t : id;
          const group = (k === "post") ? "Po směně" : "Před směnou";
          nok.push({ k, id, title, group, note });
        }
      }
    }
    return nok;
  }

  function renderCarryover(nokList){
    const box = $("carryoverBox");
    const list = $("carryoverList");
    if (!box || !list) return;
    if (!nokList.length){
      box.hidden = true;
      list.innerHTML = "";
      return;
    }
    box.hidden = false;
    list.innerHTML = nokList.map((x,idx)=>`
      <div class="carryoverItem">
        <span class="tag">✕ ${
          escapeHtml(x.group)
        }</span>
        <div class="txt">
          <div><strong>${escapeHtml(x.title)}</strong></div>
          <div class="small" style="opacity:.85">${x.note ? escapeHtml(x.note) : "bez popisu"}</div>
        </div>
        <div class="carryoverBtns">
          <button class="carryBtn nok" data-carry="nok" data-k="${x.k}" data-id="${x.id}">Stále trvá</button>
          <button class="carryBtn ok" data-carry="ok" data-k="${x.k}" data-id="${x.id}">Vyřešeno</button>
        </div>
      </div>
    `).join("");
  }

  function applyCarryState(k,id,state){
    // set state and prefill note
    setState(k,id,state);
    if (state === "nok"){
      const existing = (getNote(k,id)||"").trim();
      if (!existing) setNote(k,id,"převzato – doplň detail");
    } else {
      // keep note empty
      setNote(k,id,"");
    }
    // rerender list cards in UI (existing renderLists is used in app.js; call renderAll if exists)
    if (typeof renderLists === "function") renderLists();
    if (typeof window.__rb_refreshGate === "function") window.__rb_refreshGate();
  }

  document.addEventListener("click", (e)=>{
    const btn = e.target?.closest?.("[data-carry]");
    if (!btn) return;
    e.preventDefault();
    const k = btn.getAttribute("data-k");
    const id = btn.getAttribute("data-id");
    const st = btn.getAttribute("data-carry");
    applyCarryState(k,id,st);
  });

  function refreshCarryover(){
    const spz = ($("vehicle")?.value || "").trim();
    const taken = ($("takenFrom")?.value || "").trim();
    // show only if takenFrom chosen (responsibility)
    if (!spz || !taken){
      renderCarryover([]);
      return;
    }
    const last = lastShiftForVehicle(spz);
    if (!last){ renderCarryover([]); return; }
    const nok = computeNokFromPayload(last);
    renderCarryover(nok);
  }

  // Refresh carryover when SPZ or takenFrom changes
  ["vehicle","takenFrom"].forEach(id => {
    $(id)?.addEventListener("change", refreshCarryover);
    $(id)?.addEventListener("input", refreshCarryover);
  });

  // ----- integrate with v20 gate -----
  // wrap/override the v20 refreshGate by attaching hook used above
  if (typeof window.__rb_refreshGate !== "function"){
    // v20 did not expose it; we create one by calling internal gate state recompute
    // We'll rely on button disabled state by triggering input events; but also define a minimal one:
    window.__rb_refreshGate = function(){}; 
  }
  const prevRefresh = window.__rb_refreshGate;
  window.__rb_refreshGate = function(){
    try { prevRefresh(); } catch {}
    // Critical gate: if critical NOK exists, require acknowledgement, else disable submit
    const critState = refreshCriticalBox();
    const enable = critState.ok;
    if (!enable){
      $("btnSubmit") && ($("btnSubmit").disabled = true);
      $("barSubmit") && ($("barSubmit").disabled = true);
    }
  }

  // also run on any change
  document.addEventListener("click", (e)=>{
    if (e.target?.classList?.contains("stateBtn")) window.__rb_refreshGate();
  });
  document.addEventListener("input", ()=> window.__rb_refreshGate());

  // initial
  refreshCarryover();
  window.__rb_refreshGate();
})();

/* RB_V23_HYBRID */
(function(){
  const ENDPOINT_KEY = "rb_api_endpoint_v23";
  const DB_NAME = "rb_checklist_db_v23";
  const DB_VER = 1;
  const STORE = "queue";
  const STORE_PHOTOS = "photos";
  const REQUIRED_PHOTO_IDS = new Set(["clean_out","clean_in","lights"]);
  const CRITICAL_IDS = new Set(["brakes","lights","triangle","firstaid"]);

  function getEndpoint(){ return (localStorage.getItem(ENDPOINT_KEY) || "").trim(); }
  function setEndpoint(v){ localStorage.setItem(ENDPOINT_KEY, (v||"").trim()); }
  function setStatus(text, cls){
    const el = $("apiStatus");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("ok","err","warn");
    if (cls) el.classList.add(cls);
  }

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath:"qid" });
          s.createIndex("status","status",{ unique:false });
          s.createIndex("ts","ts",{ unique:false });
        }
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath:"pid" });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }
  async function idbPut(store, val){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,"readwrite");
      tx.objectStore(store).put(val);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }
  async function idbGet(store, key){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,"readonly");
      const r = tx.objectStore(store).get(key);
      r.onsuccess = ()=> resolve(r.result||null);
      r.onerror = ()=> reject(r.error);
    });
  }
  async function idbAll(store){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,"readonly");
      const r = tx.objectStore(store).getAll();
      r.onsuccess = ()=> resolve(r.result||[]);
      r.onerror = ()=> reject(r.error);
    });
  }
  async function idbUpdate(store, key, patch){
    const cur = await idbGet(store,key);
    if (!cur) return;
    await idbPut(store, Object.assign(cur, patch));
  }
  async function queueCount(){
    const all = await idbAll(STORE);
    return all.filter(x=>x.status==="pending"||x.status==="error").length;
  }
  async function refreshQueuePill(){
    const el = $("queuePill");
    if (!el) return;
    const n = await queueCount();
    el.textContent = `Fronta: ${n}`;
  }

  async function apiPing(){
    const ep = getEndpoint();
    if (!ep) { setStatus("Chybí endpoint","warn"); return false; }
    try {
      const res = await fetch(ep + "?action=ping");
      const j = await res.json();
      if (j && j.ok) { setStatus("Online","ok"); return true; }
      setStatus("Chyba API","err"); return false;
    } catch(e) {
      setStatus("Offline / nedostupné","warn"); return false;
    }
  }
  async function apiLast(spz){
    const ep = getEndpoint();
    if (!ep || !spz) return null;
    try {
      const res = await fetch(ep + "?action=last&spz=" + encodeURIComponent(spz));
      const j = await res.json();
      if (j && j.ok) return j.payload || null;
      return null;
    } catch(e) { return null; }
  }
  async function apiSubmit(payload){
    const ep = getEndpoint();
    if (!ep) throw new Error("Missing endpoint");
    const res = await fetch(ep, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"submit", payload })
    });
    const j = await res.json();
    if (!j || !j.ok) throw new Error(j?.error || "API error");
    return j.id;
  }

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> {
        const dataUrl = reader.result;
        const b64 = String(dataUrl).split(",")[1] || "";
        resolve(b64);
      };
      reader.onerror = ()=> reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function ensurePhotoUI(){
    document.querySelectorAll(".check").forEach(ch => {
      const id = ch.getAttribute("data-id");
      if (!id || !REQUIRED_PHOTO_IDS.has(id)) return;
      if (ch.querySelector(".photoWrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "photoWrap";
      wrap.innerHTML = `
        <div class="small" style="margin-top:6px;opacity:.85">Foto (povinné při ✕)</div>
        <input class="photoInput" type="file" accept="image/*" capture="environment" data-photo-id="${id}">
        <div class="small" id="photoState_${id}" style="opacity:.85;margin-top:4px">—</div>
      `;
      ch.appendChild(wrap);
    });
  }

  document.addEventListener("change", async (e)=>{
    const inp = e.target?.closest?.(".photoInput");
    if (!inp) return;
    const id = inp.getAttribute("data-photo-id");
    const file = inp.files && inp.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    const pid = "p_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    await idbPut(STORE_PHOTOS, {
      pid,
      itemId: id,
      name: `${id}_${Date.now()}.jpg`,
      type: file.type || "image/jpeg",
      data: b64
    });
    const mapKey = "rb_photo_map_v23";
    let m={};
    try{ m=JSON.parse(localStorage.getItem(mapKey)||"{}"); }catch{}
    m[id]=pid;
    localStorage.setItem(mapKey, JSON.stringify(m));
    const st = $("photoState_"+id);
    if (st) st.textContent = "Foto přidáno ✅";
    if (typeof window.__rb_refreshGate === "function") window.__rb_refreshGate();
  });

  async function buildPhotosPayload(){
    const mapKey = "rb_photo_map_v23";
    let m={};
    try{ m=JSON.parse(localStorage.getItem(mapKey)||"{}"); }catch{}
    const photos=[];
    for (const [id,pid] of Object.entries(m)) {
      const rec = await idbGet(STORE_PHOTOS, pid);
      if (rec) photos.push({ name: rec.name, type: rec.type, data: rec.data, itemId: id });
    }
    return photos;
  }

  async function missingRequiredPhotos(){
    const mapKey = "rb_photo_map_v23";
    let m={};
    try{ m=JSON.parse(localStorage.getItem(mapKey)||"{}"); }catch{}
    const miss=[];
    for (const id of REQUIRED_PHOTO_IDS) {
      let st=null;
      for (const [k,arr] of Object.entries(lists)) {
        if ((arr||[]).some(x=>x.id===id)) {
          st = getState(k,id);
          if (st==="nok" && !m[id]) miss.push(id);
        }
      }
    }
    return miss;
  }

  async function applyCarryoverFromLast(){
    const spz = ($("vehicle")?.value||"").trim();
    const taken = ($("takenFrom")?.value||"").trim();
    if (!spz || !taken) return;
    const last = await apiLast(spz);
    if (!last) return;
    const nok=[];
    if (last.checks) {
      for (const [k,obj] of Object.entries(last.checks)) {
        for (const [id,v] of Object.entries(obj||{})) {
          if (v==="nok") nok.push({k,id});
        }
      }
    }
    const tag = `[EXISTOVALO PŘI PŘEVZETÍ – po: ${last.driver||"?"} – ${new Date(last.time).toLocaleString("cs-CZ")}]`;
    for (const it of nok) {
      if (lists[it.k] && lists[it.k].some(x=>x.id===it.id)) {
        setState(it.k,it.id,"nok");
        const cur=(getNote(it.k,it.id)||"").trim();
        if (!cur) setNote(it.k,it.id, tag + " doplň detail");
        else if (!cur.includes("[EXISTOVALO PŘI PŘEVZETÍ")) setNote(it.k,it.id, tag + " " + cur);
      }
    }
    if (typeof renderLists==="function") renderLists();
    if (typeof window.__rb_refreshGate==="function") window.__rb_refreshGate();
  }

  ["vehicle","takenFrom"].forEach(id=>{ $(id)?.addEventListener("change", ()=>{ apiPing(); applyCarryoverFromLast(); }); });

  function inCriticalStop(){
    for (const [k,arr] of Object.entries(lists)) {
      for (const it of arr) {
        if (CRITICAL_IDS.has(it.id) && getState(k,it.id)==="nok") return true;
      }
    }
    return false;
  }
  function setUiLocked(locked){
    document.querySelectorAll("input,textarea,select,button").forEach(el=>{
      if (el.id==="criticalAck") return;
      if (el.classList.contains("photoInput")) return;
      if (locked) {
        if (el.classList.contains("checkNote")) return;
        el.setAttribute("data-lockbak","1");
        el.disabled = true;
      } else {
        if (el.getAttribute("data-lockbak")==="1") el.disabled = false;
        el.removeAttribute("data-lockbak");
      }
    });
  }
  function refreshStopLock(){
    const stop = inCriticalStop();
    const box = $("criticalBox");
    if (!stop) {
      setUiLocked(false);
      if (box) box.hidden = true;
      return true;
    }
    if (box) box.hidden = false;
    const ack = $("criticalAck");
    const ok = !!ack?.checked;
    if (!ok) setUiLocked(true);
    else setUiLocked(false);
    return ok;
  }
  $("criticalAck")?.addEventListener("change", ()=>{ refreshStopLock(); if (typeof window.__rb_refreshGate==="function") window.__rb_refreshGate(); });

  async function createPayload(){
    const form = getForm();
    const issues=[];
    for (const [k,arr] of Object.entries(lists)) {
      for (const it of arr) {
        if (getState(k,it.id)==="nok") {
          const note=(getNote(k,it.id)||"").trim();
          issues.push({
            section:(k==="post")?"Po směně":"Před směnou",
            item:it.t,
            note,
            carryover: note.includes("[EXISTOVALO PŘI PŘEVZETÍ")
          });
        }
      }
    }
    const photos = await buildPhotosPayload();
    return {
      vehicle: form.vehicle,
      driver: form.driver,
      takenFrom: form.takenFrom,
      checks: form.checks,
      notes: form.notes,
      issues,
      photos,
      meta: {
        appVersion: "v23",
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    };
  }

  async function enqueue(payload){
    const qid = "q_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    await idbPut(STORE, { qid, ts:Date.now(), status:"pending", payload });
    await refreshQueuePill();
    return qid;
  }

  async function syncOnce(){
    const all = await idbAll(STORE);
    const items = all.filter(x=>x.status==="pending"||x.status==="error").sort((a,b)=>a.ts-b.ts);
    if (!items.length) return true;
    const online = await apiPing();
    if (!online) return false;
    for (const it of items) {
      try {
        const id = await apiSubmit(it.payload);
        await idbUpdate(STORE, it.qid, { status:"sent", sentId:id, sentAt:Date.now(), error:null });
      } catch(e) {
        await idbUpdate(STORE, it.qid, { status:"error", error:String(e) });
        break;
      }
    }
    await refreshQueuePill();
    return true;
  }

  $("btnSyncNow")?.addEventListener("click", async ()=>{ await syncOnce(); toast("Sync dokončen."); });
  $("btnPing")?.addEventListener("click", async ()=>{ const ok = await apiPing(); toast(ok?"API OK":"API nedostupné"); });
  $("endpoint")?.addEventListener("input", (e)=>{ setEndpoint(e.target.value); });
  if ($("endpoint")) $("endpoint").value = getEndpoint();

  const prevGate = window.__rb_refreshGate;
  window.__rb_refreshGate = async function(){
    try{ if (typeof prevGate==="function") prevGate(); }catch{}
    const stopOk = refreshStopLock();
    const miss = await missingRequiredPhotos();
    const enabled = stopOk && miss.length===0;
    if (!enabled) {
      $("btnSubmit") && ($("btnSubmit").disabled = true);
      $("barSubmit") && ($("barSubmit").disabled = true);
    }
    const hint = $("submitHint");
    if (hint && miss.length) {
      hint.hidden = false;
      hint.innerHTML = `<strong>Nelze odeslat:</strong><br>• Chybí povinné foto u ✕: ${miss.join(", ")}`;
    }
  }

  $("btnSubmit")?.addEventListener("click", async ()=>{
    await window.__rb_refreshGate();
    if ($("btnSubmit")?.disabled) return;
    const payload = await createPayload();
    await enqueue(payload);
    toast("Uloženo do fronty.");
    await syncOnce();
  }, false);

  ensurePhotoUI();
  refreshQueuePill();
  apiPing();
  window.addEventListener("online", ()=> syncOnce());
})();

/* RB_V23_2_PHOTO_FIX */
(function(){
  const MAX_W=1200, MAX_H=1200, JPG_Q=0.7;
  const PHOTO_STORE="photos2";
  const REQUIRED_PHOTO_IDS=new Set(["clean_out","clean_in","lights"]);
  const DB_NAME="rb_checklist_db_v23"; const DB_VER=2;

  function openDB(){
    return new Promise((res,rej)=>{
      const r=indexedDB.open(DB_NAME,DB_VER);
      r.onupgradeneeded=()=>{
        const db=r.result;
        if(!db.objectStoreNames.contains(PHOTO_STORE)){
          db.createObjectStore(PHOTO_STORE,{keyPath:"key"});
        }
      };
      r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
    });
  }
  async function putPhoto(rec){
    const db=await openDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(PHOTO_STORE,"readwrite");
      tx.objectStore(PHOTO_STORE).put(rec);
      tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error);
    });
  }
  async function getPhoto(key){
    const db=await openDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(PHOTO_STORE,"readonly");
      const q=tx.objectStore(PHOTO_STORE).get(key);
      q.onsuccess=()=>res(q.result||null); q.onerror=()=>rej(q.error);
    });
  }

  function ensureCamUI(){
    document.querySelectorAll(".check").forEach(ch=>{
      const id=ch.getAttribute("data-id");
      if(!id||!REQUIRED_PHOTO_IDS.has(id)) return;
      if(ch.querySelector(".camBtn")) return;
      const btn=document.createElement("button");
      btn.type="button"; btn.className="camBtn"; btn.textContent="📷 Přidat foto (povinné při ✕)";
      const img=document.createElement("img"); img.className="photoPrev"; img.hidden=true;
      btn.onclick=()=>pickPhoto(id,img);
      ch.appendChild(btn); ch.appendChild(img);
    });
  }

  function pickPhoto(itemId, img){
    const inp=document.createElement("input");
    inp.type="file"; inp.accept="image/*";
    inp.onchange=async ()=>{
      const f=inp.files&&inp.files[0]; if(!f) return;
      const bmp=await createImageBitmap(f);
      const c=document.createElement("canvas");
      let w=bmp.width,h=bmp.height;
      const r=Math.min(MAX_W/w, MAX_H/h, 1);
      w=Math.round(w*r); h=Math.round(h*r);
      c.width=w; c.height=h;
      const ctx=c.getContext("2d"); ctx.drawImage(bmp,0,0,w,h);
      const data=c.toDataURL("image/jpeg",JPG_Q);
      const b64=data.split(",")[1];
      await putPhoto({key:itemId, type:"image/jpeg", data:b64});
      img.src=data; img.hidden=false;
      if(window.__rb_refreshGate) window.__rb_refreshGate();
    };
    inp.click();
  }

  async function missingPhotos(){
    const miss=[];
    for(const id of REQUIRED_PHOTO_IDS){
      let isNok=false;
      for(const [k,arr] of Object.entries(lists)){
        if((arr||[]).some(x=>x.id===id) && getState(k,id)==="nok"){ isNok=true; }
      }
      if(isNok){
        const p=await getPhoto(id);
        if(!p) miss.push(id);
      }
    }
    return miss;
  }

  const prevGate=window.__rb_refreshGate;
  window.__rb_refreshGate=async function(){
    if(prevGate) try{await prevGate();}catch{}
    const miss=await missingPhotos();
    if(miss.length){
      const hint=document.getElementById("submitHint");
      if(hint){
        hint.hidden=false;
        hint.innerHTML='<strong>Nelze odeslat:</strong><br><span class="errText">Chybí foto:</span> '+miss.join(", ");
      }
      const b=document.getElementById("btnSubmit"); if(b) b.disabled=true;
      const b2=document.getElementById("barSubmit"); if(b2) b2.disabled=true;
    }
  };

  const origCreate=window.createPayload;
  window.createPayload=async function(){
    const p=origCreate?await origCreate():{};
    const photos=[];
    for(const id of REQUIRED_PHOTO_IDS){
      const ph=await getPhoto(id);
      if(ph) photos.push({itemId:id, type:ph.type, data:ph.data, name:id+".jpg"});
    }
    p.photos=(p.photos||[]).concat(photos);
    return p;
  };

  ensureCamUI();
})();
