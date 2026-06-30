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

## Panel wprowadzania działek — kreator 3-poziomowy

Zgodnie z dokumentem „Katalog danych i tryby pól" panel `/nowa` odsłania pola
stopniowo wraz z poziomem (tryby **R / R? / A / A° / A± / S**):

- **Poziom 1 — identyfikacja:** widoczna wyłącznie identyfikacja działek
  (kaskada TERYT województwo → powiat → gmina → obręb → numer; tryb hybrydowy:
  lista 16 województw + podpowiedzi z mini-słownika + wpis własny). Obsługa
  **wielu działek** (repeater) ze scaleniem geometrii w jeden „teren inwestycji"
  i walidacją przylegania. Całe scoringowanie liczy się automatycznie (ukryte).
- **Poziom 2 — ocena działki:** odsłaniają się wskaźniki planistyczne (**A±**,
  z override i śladem audytowym „✎ skorygowane ręcznie"), uwarunkowania terenu/
  środowiska (**A°**, tylko odczyt), pola rynkowe (**A± → R dynamicznie** wg
  liczby ofert `N`: ≥30 wiarygodne, 10–29 szacunek, <10 fallback regionalny/
  ręczne) oraz dane ręczne / wąskie gardła (własność, przyłączenia, geotechnika).
- **Poziom 3 — model finansowy:** parametry reżimu i montażu (**A±/R**):
  oprocentowanie, okres kredytu, grant, fazy osi czasu, indeksy, koszt budowy,
  cena gruntu, partycypacje.

Brak danej w polu A/A°/A± nie blokuje — obniża pewność (zasada „brak danych ≠ nie").

## Warstwa integracji danych (wzorzec konektora)

Zgodnie z briefem wdrożeniowym warstwa danych używa **wzorca konektora**
(`src/lib/data/connectors/`):

- Wspólny interfejs `pobierz(teren) → { status, dane, źródło, czas, meta }`;
  awaria jednego konektora **nie wywraca raportu** (runner = `Promise.allSettled`).
- Każda dana niesie **metadane**: źródło, znacznik czasu, pewność, tryb pola.
- **Brak danych ≠ błąd** — konektor bez wyniku zwraca status „brak" (biała plama)
  i obniża pewność.
- **Konfiguracja, nie kod** — endpointy, klucze, mapowanie zmiennych GUS i flagi
  aktywności w `src/lib/data/connectorsConfig.ts`.
- Warstwa sieciowa (`net.ts`): timeout, retry z backoffem, log surowych odpowiedzi
  (tryb debug `KONEKTORY_DEBUG=1`).
- Obliczenia geometryczne w **EPSG:2180** (powierzchnia, centroid, przyleganie).

**Zaimplementowane konektory:**

| Konektor | Etap | Dane | Status |
|---|---|---|---|
| ULDK | M1 | geometria, powierzchnia, front, TERYT | działa (geokoder) |
| GUS BDL | M1 | demografia, rynek pracy | auto-dobór ID zmiennych z katalogu BDL po nazwie |
| KIMPZP | M1 | status planistyczny | best-effort (≈75% gmin to rastry → „do weryfikacji") |
| GDOŚ Natura 2000 / ochrona | M2 | bramki: Natura 2000, ochrona wykluczająca | obecność WMS w punkcie |
| ISOK / Wody Polskie | M2 | bramka: powódź szczególna | obecność WMS w punkcie |
| PIG-PIB SOPO | M2 | bramka: osuwiska | obecność WMS w punkcie |
| NID | M2 | flaga: strefa konserwatorska | obecność WMS w punkcie |
| OSM / Overpass | M2 | W3: przystanek, usługi pieszo, POZ, szkoły/żłobki | zapytanie `around` (proxy dostępności) |

Konektory środowiskowe (M2) działają wzorcem „obecność obiektu w punkcie" (WMS
GetFeatureInfo w centroidzie). Adresy WMS i nazwy warstw w `connectorsConfig.ts`
są wartościami startowymi — do potwierdzenia przez `GetCapabilities` źródeł;
przy złej warstwie konektor zwraca „brak" (bramka „do weryfikacji"), nie błąd.

Przyleganie wielu działek liczone jest **na geometrii** (test spójności bloku),
nie na numerach. Panel pokazuje **raport źródeł** (które konektory zwróciły dane).

Katalog pozostałych źródeł (M2/M3: NMT, EGiB, GESUT, BDOT10k, GDOŚ, ISOK, PIG,
GIOŚ, NID, Overpass, routing, RSPO, RPWDL, dane rynkowe) jest zarejestrowany w
`connectorsConfig.ts` i włączany przyrostowo.

## Integracja ULDK (geometria + kaskada TERYT)

Panel `/nowa` korzysta z **realnego ULDK** (GUGiK):

- **Kaskada TERYT** (`/api/teryt`) pobiera województwa/powiaty/gminy/obręby z ULDK
  (realne kody TERYT dla całej Polski), z **fallbackiem do mini-słownika**, gdy
  ULDK jest niedostępny.
- **Geometria działki** (`src/lib/data/uldk.ts` → `GetParcelById`): z WKT
  (EPSG:2180) liczona jest powierzchnia (formuła Gaussa), front i proporcja boków
  (`src/lib/geo.ts`, testowane offline).
- Resolver pobiera dane w kolejności: provider demonstracyjny (3 działki) →
  **ULDK** (dla dowolnej realnej działki) → szkielet z ręczną powierzchnią.

> **Sieć:** ULDK wymaga dostępu wychodzącego do `uldk.gugik.gov.pl`. Działa na
> hostingu z otwartą siecią (np. Vercel). W środowiskach z polityką egress
> blokującą ten host wywołania degradują się gracefully do fallbacku.

## Warstwa danych

Provider demonstracyjny zwraca **dane przykładowe** (3 działki, w tym przypadek z białymi plamami);
dla pozostałych działek geometria pochodzi z ULDK, a atrybuty scoringowe pozostają do uzupełnienia
ręcznego na Poziomie 2 (do czasu podpięcia GUS/MPZP/OSM).
Architektura adapterów (`lib/data/adapters.ts`) opisuje realne źródła i ich endpointy
(ULDK, EGiB, KIMPZP/Rejestr Urbanistyczny, NMT, ISOK, GUS BDL, OSM, GDOŚ, RSPO/RPWDL, RCiWN, BGK/KZN) —
podpięcie realnych API nie wymaga zmian w silnikach. Dane planistyczne migrują 🔴/🟡 → 🟢 wraz
z Rejestrem Urbanistycznym (01.07.2026), stąd projekt z fallbackiem i obsługą braków.

## Konfiguracja i kalibracja

Wszystkie progi, wagi wymiarów per profil oraz parametry reżimów finansowych są wartościami
**startowymi do kalibracji**, nie ostatecznymi. Edytuj je w zakładce **Konfiguracja** i przeliczaj
działkę na żywo, albo w `src/lib/config.ts`.
