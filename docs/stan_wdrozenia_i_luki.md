# Stan wdrożenia i luki do pełnej sprawności — GRUNT

**Data:** 2026-07-09
**Zakres:** ocena, czego brakuje aplikacji do „pełnej sprawności" (produkcyjnej wiarygodności i dojrzałości produktu).

## Wniosek w jednym zdaniu

Silnik oceny (M1 przesiew → M2 przydatność → M3 model finansowy SIM) jest **kompletny i przetestowany** (206 testów). Główna luka to **realne dane**: wiele źródeł jest zaparkowanych (`aktywny: false` w `src/lib/data/connectorsConfig.ts`), więc w produkcji uruchamiają się fallbacki i większość działek trafia na listę „do weryfikacji" zamiast dostać werdykt oparty na twardych danych.

## Legenda

- **P0** — bez tego aplikacja „ocenia z przybliżeń" (rdzeń wiarygodności).
- **P1** — wpływa na wiarygodność werdyktu i modelu finansowego.
- **P2** — dojrzałość produktu (nie silnika).
- **Pracochłonność:** S ≈ 0,5–1 dzień · M ≈ 1–3 dni · L ≈ 3–8 dni (szacunek inżynierski, jeden deweloper).
- **Egress:** ⚠ = wymaga żywego dostępu sieciowego (do wykonania/weryfikacji na środowisku z egresem, np. preview/produkcja Vercel — nie w izolowanym sandboksie).

---

## P0 — rdzeń wiarygodności

### P0.1 Warstwy środowiskowe realne (autorytatywne) ⚠ · L
**Stan:** wszystkie źródła WMS/WFS zaparkowane — `ISOK` (powódź), `GDOŚ` (Natura 2000 / formy ochrony), `PIG-PIB SOPO` (osuwiska) mają `aktywny: false` (`connectorsConfig.ts`, sekcja `wmsObecnosc` + `katalog`).
**Skutek:** dziś każda działka bez MPZP mieszkaniowego trafia na listę „do weryfikacji" albo pyta klienta (panel fallback jest już zbudowany).
**Do zrobienia:** on-demand WFS/GetFeatureInfo per działka (BBOX wokół geometrii, payload w kilobajtach, bez masowego mirrora), z jedną próbą + timeout + fallbackiem do pytania. Zgodne z wytycznymi `warstwy_srodowiskowe_2` §1–2.
**Domyka:** naprawę CAP — „warunkowo" tylko przy realnie wykrytym zagrożeniu (logika już gotowa, brakuje źródła danych).

### P0.2 OSM/Overpass w produkcji ⚠ · M
**Stan:** `overpass.aktywny: false` → **kara uciążliwości nigdy nie odpala** w produkcji, mimo że logika `modyfikatorUciazliwosci` (kanał O, 7.1) jest gotowa. `odleglosci.aktywny: true`, ale publiczny Overpass bywa blokowany dla IP centrów danych (Vercel) → usługi pieszo mogą wpadać w `null`.
**Do zrobienia:** stabilny mirror lub własny endpoint Overpass; włączyć uciążliwości (przemysł/kolej/droga/wysypiska), ochronę przyrody z OSM oraz proxy wody (`waterway`/`natural=water` → flaga „w pobliżu cieku — zweryfikuj zagrożenie powodziowe").
**Uwaga:** proxy wody nie zastępuje stref MZP/MRP (to robi P0.1) — tylko wzmacnia decyzję o zapytaniu/pytaniu.

### P0.3 Potwierdzenie ID zmiennych GUS BDL ⚠ (częściowo offline) · M
**Stan:** część zmiennych dobierana po frazie (`ludność ogółem/wiek/bezrobocie`, `dochód`, `NSP gospodarstwa wg tytułu prawnego`); potwierdzone ID tylko dla kilku (`podmioty=60530`, `saldo=1365234`, `wynagrodzenie=64429`, `zameldowania=80121`, `wymeldowania=80123`).
**Skutek:** dobór po frazie jest kruchy (BDL zmienia nazwy) — to był powód, dla którego `udziałGospodarstwBezWłasnościPct` i przeciętny dochód wracały `null`, a model popytu chodził na fallbackach.
**Do zrobienia:** przez `/api/diag-gus?vars=…` potwierdzić i przypiąć stałe ID w `zmienneId` (ludność ogółem, 20–64, 65+, bezrobocie, dochód, gospodarstwa NSP: ogółem + własność). Kod diagnostyki i mapowania można przygotować bez egresu; samo potwierdzenie ID wymaga dostępu do BDL.

---

## P1 — wiarygodność werdyktu i modelu finansowego

### P1.1 Uzbrojenie / odległość do sieci (GESUT/BDOT) ⚠ · M
**Stan:** `KIUT (GESUT)`, `BDOT10k` zaparkowane (`aktywny: false`).
**Skutek:** koszt przyłączy zawsze liczony proxy z odległości → **M3 (montaż finansowy SIM) liczy „na oko"**. To realna pozycja w decyzji inwestycyjnej.

### P1.2 Grunt leśny / rolny klasa I–III (EGiB) ⚠ · M
**Stan:** `KIEG (EGiB)` zaparkowane.
**Skutek:** bramka odrolnienia/odlesienia często `null` → „do weryfikacji" zamiast twardej flagi kosztu i czasu.

### P1.3 Wartość odtworzeniowa i rynek najmu ⚠ · S–M
**Stan:** część województw = fallback benchmark (`wartoscOdtworzeniowa.ts`), czynsze = mediana wojewódzka (`rynek.ts`).
**Skutek:** pułap czynszu SIM i luka najemcy (rdzeń sensu ekonomicznego) częściowo szacowane. Do zrobienia: komplet obwieszczeń wojewodów (wartość odtworzeniowa) + szersze pokrycie rejestru cen/ofert najmu.

### P1.4 Klucze API na środowisku produkcyjnym ⚠ · S
**Stan:** `GUS_BDL_CLIENT_ID` (limity BDL z chmury) i `ORS_API_KEY` (routing pieszy — bez klucza degradacja do linii prostej / haversine) czytane z env.
**Do zrobienia:** potwierdzić, że są ustawione na Vercel (inaczej cicha degradacja jakości).

### P1.5 Spadek terenu (NMT) ⚠ · S
**Stan:** `spadek.aktywny: true` przez publiczne `opentopodata.org` (EU-DEM 25 m) — bywa limitowane.
**Do rozważenia:** własne źródło NMT / GUGiK dla stabilności kanału B.

---

## P2 — dojrzałość produktu (nie silnika)

### P2.1 Persystencja i konta · L
**Stan:** archiwum = **localStorage** (`src/lib/archiwum.ts`, MVP bez backendu). Znika przy zmianie przeglądarki/urządzenia, brak współdzielenia linku, brak kont.
**Do zrobienia:** backend + zapis analiz + (opcjonalnie) logowanie.

### P2.2 Eksport raportu · S–M
**Stan:** tylko `window.print` (druk CSS w `globals.css`) — brak realnego PDF do wysłania/załączenia.

### P2.3 Moduł dokumentów (etap drugi) · L
**Stan:** lista „do weryfikacji" jest już zaprojektowana jako jego wejście, ale sam moduł („wgraj wypis / mapę zalewową / WZ → podnieś pewność") nie istnieje.

### P2.4 Bramka płatności / leady · M
**Stan:** aplikacja to sito przed płatną analizą — brak modelu płatności/pozyskania leadów domykającego lejek.

---

## Co jest już gotowe (dla kontekstu)

- **Silnik M1/M2/M3** — pełny, 206 testów, build OK.
- **Model popytu P1 „oczyszczony"** (populacja → profile → próg dochodowy → udział bez własnego M → korekta migracyjna).
- **Bramka wielkości/formy** — pracuje w tle, opłacalność jako modal.
- **Kanały M2 A–F** — dostępność usług (routing pieszy), spadek (NMT), dojazd do aglomeracji, uciążliwości/otoczenie (logika gotowa; dane P0.2).
- **Naprawa CAP** — „warunkowo" tylko przy wykrytym zagrożeniu; niezweryfikowane → lista „do weryfikacji" + obniżona pewność (nie blokuje).
- **Panel środowiskowy fallback** — teren zalewowy / osuwiska (tak/nie/nie wiem), trójstan zasilający bramki.
- **ULDK (geometria), KIMPZP (plany), GUS BDL (demografia)** — podłączone.

---

## Rekomendowana kolejność

1. **P0.1 + P0.2 razem** — największy zwrot z jednego kroku: zamienia „wszystko do weryfikacji" na realne werdykty i włącza już napisaną logikę kar uciążliwości. Wymaga egresu → realizacja i weryfikacja na środowisku z dostępem sieciowym.
2. **P0.3** — przypięcie ID GUS: przywraca pełny model popytu (koniec fallbacków dochodu i udziału bez własnego M).
3. **P1.1–P1.2** — GESUT/EGiB: urealnia koszt przyłączy (M3) i bramkę odrolnienia.
4. **P1.3–P1.5** — komplet wartości odtworzeniowej/rynku + klucze env + stabilny NMT.
5. **P2** — persystencja, eksport PDF, moduł dokumentów, płatności (gdy rdzeń danych domknięty).

> Uwaga wykonawcza: zadania oznaczone ⚠ wymagają żywego egresu. W izolowanym środowisku deweloperskim (sandbox) wyjścia sieciowe są zablokowane — te elementy najlepiej pisać i weryfikować bezpośrednio na preview/produkcji Vercel (która ma egress).
