# RB Taxi – Checklist (PWA)

## Co to umí
- Mobilní checklist pro řidiče (před/po směně)
- Offline režim (Service Worker + cache)
- Ukládání historie do telefonu (LocalStorage)
- Export historie do CSV
- Volitelné odesílání do systému přes `Endpoint URL` (např. Google Apps Script / API)

## Rychlé spuštění (nejjednodušší)
1) Nahraj složku někam na web (doporučení: GitHub Pages)
2) Otevři URL v mobilu (Safari/Chrome)
3) Klikni „Přidat na plochu“ (Android: menu → Install app, iOS: Sdílet → Přidat na plochu)

## Deployment přes GitHub Pages
1) Vytvoř nový repo (např. `rb-checklist`)
2) Nahraj obsah ZIPu do rootu repa
3) Settings → Pages → Deploy from branch → `main` / root
4) Hotovo. URL začne fungovat jako PWA.

## Napojení na sběr dat (Google Sheets)
Nejrychlejší je Google Apps Script Web App, který přijme JSON a zapíše řádek do tabulky.
- V aplikaci pak vložíš jeho URL do „Endpoint URL“.
- Pokud endpoint nefunguje, checklist se stejně uloží offline.

Pokud chceš, napíšu ti i hotový Apps Script + šablonu Google Sheet (řádky, sloupce, formát).


## Stav položek (OK / Není v pořádku)
Každá položka má volbu **✓ OK** nebo **✕ Není v pořádku**. Ukládá se jako `ok` / `nok`.


## Poznámka
Tato verze obsahuje opravený `app.js` (v7). Ukládání do telefonu + export CSV fungují.
