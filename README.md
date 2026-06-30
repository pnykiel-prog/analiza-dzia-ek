# Analiza działek — budownictwo społeczne

Aplikacja webowa oceniająca potencjał działki pod **budownictwo społeczne dla młodych i senioralne**.
Realizuje architekturę z dokumentów źródłowych w repozytorium (`architektura_aplikacji.md` jako
źródło prawdy) w postaci działającego, klikalnego produktu.

Proces przebiega w **trzech poziomach**, gdzie wynik każdego poziomu jest wejściem następnego:

| Poziom | Co robi | Dokument źródłowy |
|---|---|---|
| **1 — przesiew** | bramki (twarde wykluczenia) + scoring 5 wymiarów (W1–W5) osobno dla 2 profili, werdykt + pewność | `poziom1_scoring.md` |
| **2 — ocena działki** | obwiednia zabudowy → typologia → program pod profil (warianty + flagi) | `rekomendacja_modelu_zabudowy.md`, `dane_wejsciowe_analiza_dzialek.md` |
| **3 — model finansowy SIM** | koszt, montaż, oś czasu, reżim „as-of", indeksacja, domknięcie (DSCR, pułap czynszu), wymagana dotacja, wrażliwość | `model_ekonomiczny_SIM_czasowy.md` (domyślny), `model_ekonomiczny_SIM_poziom2.md` (scenariusz A) |

## Stack

- **Next.js 14 (App Router) + TypeScript** — full-stack w jednym repo.
- **Tailwind CSS** — interfejs.
- Silniki obliczeniowe jako **czyste funkcje** (testowalne `node --test`).

## Uruchomienie

```bash
npm install
npm run dev          # tryb deweloperski → http://localhost:3000
# lub
npm run build && npm run start   # produkcyjnie
```

Inne polecenia:

```bash
npm test             # testy silników P1/P2/P3
npm run typecheck    # kontrola typów
```

## Struktura

```
src/
├─ app/
│  ├─ page.tsx                 # lista działek + werdykt przesiewowy
│  ├─ analiza/[id]/page.tsx    # pełna analiza 3 poziomów
│  ├─ konfiguracja/page.tsx    # edytor parametrów + przeliczanie na żywo
│  ├─ o-aplikacji/page.tsx
│  └─ api/                     # /dzialki, /analiza/[id] (GET/POST), /konfiguracja
├─ components/                 # widoki Poziom1/2/3 + komponenty UI
└─ lib/
   ├─ types.ts                 # model domenowy
   ├─ config.ts                # WARSTWA KONFIGURACJI — progi, wagi, reżimy (edytowalne)
   ├─ data/
   │  ├─ adapters.ts           # katalog/interfejsy źródeł (ULDK, GUS, OSM…)
   │  ├─ sample.ts             # dane przykładowe (z „białymi plamami”)
   │  └─ service.ts            # pozyskanie danych + raport pokrycia
   └─ engine/
      ├─ poziom1.ts            # bramki + scoring
      ├─ poziom2.ts            # rekomendacja zabudowy
      ├─ poziom3.ts            # model finansowy SIM
      └─ index.ts              # orkiestrator pipeline'u
```

## Zasady przekrojowe (zaimplementowane)

1. **Dwa profile osobno** — `score_mlodzi` i `score_seniorzy` (te same wymiary, inne wagi).
2. **Bramki przed punktacją** — twarde wykluczenia (pass/warunkowo/fail/do weryfikacji).
3. **Brak danych ≠ „nie"** — braki = wartość neutralna (mediana), obniżają tylko **pewność**;
   biała plama planistyczna nigdy nie daje „wykluczone".
4. **Rozdział nadawania się (P2) od opłacalności (P3).**
5. **Liczenie na momencie realizacji** — P3 indeksuje koszty/wartości do dat budowy i oddania,
   domyślny reżim = program 2027+.
6. **Parametry w konfiguracji, nie w kodzie** — `lib/config.ts` + edytor `/konfiguracja`.
7. **Wynik poziomu = wejście następnego**; **pętla zwrotna P3 → P2**, gdy program nie domyka.

## Warstwa danych

Na tym etapie warstwa zwraca **dane przykładowe** (3 działki, w tym przypadek z białymi plamami).
Architektura adapterów (`lib/data/adapters.ts`) opisuje realne źródła i ich endpointy
(ULDK, EGiB, KIMPZP/Rejestr Urbanistyczny, NMT, ISOK, GUS BDL, OSM, GDOŚ, RSPO/RPWDL, RCiWN, BGK/KZN) —
podpięcie realnych API nie wymaga zmian w silnikach. Dane planistyczne migrują 🔴/🟡 → 🟢 wraz
z Rejestrem Urbanistycznym (01.07.2026), stąd projekt z fallbackiem i obsługą braków.

## Konfiguracja i kalibracja

Wszystkie progi, wagi wymiarów per profil oraz parametry reżimów finansowych są wartościami
**startowymi do kalibracji**, nie ostatecznymi. Edytuj je w zakładce **Konfiguracja** i przeliczaj
działkę na żywo, albo w `src/lib/config.ts`.
