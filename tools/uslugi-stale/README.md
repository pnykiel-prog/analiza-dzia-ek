# Statyczna warstwa usług (szkoły / przedszkola / POZ / apteki)

Cztery kategorie usług do kanału A (dostępność → kwalifikacja działki wg odległości) w M2,
pobierane z rejestrów urzędowych i **wgrywane lokalnie jako statyczna warstwa**, odświeżane
**raz w roku**. Deterministyczne, bez API na żywo per działka, bez limitów i pętli sieciowych.

Runtime czyta warstwę z `src/lib/data/uslugi_stale.json` (loader: `src/lib/data/uslugiStale.ts`).
Ten katalog to **kontrakt importu wsadowego** — skrypt uruchamiany poza aplikacją (rocznie/cron),
nie kod produkcyjny na żądanie. Aktualny `uslugi_stale.json` w repo to **SEED** (kilka rekordów) —
do zastąpienia pełnym rejestrem po pierwszym imporcie.

## Źródła i filtry

| Kategoria | Źródło (urzędowe) | Filtr przy imporcie |
|---|---|---|
| `szkola` | RSPO | typ placówki = szkoła |
| `przedszkole` | RSPO | typ placówki = przedszkole |
| `poz` | RPWDL (CSV/XML) | rodzaj świadczeń = POZ |
| `apteka` | Rejestr Aptek (RA) | apteki ogólnodostępne |

Przystanki i sklepy **NIE tutaj** — przystanek z OSM (+ GTFS na częstotliwość), sklep z OSM
(brak rejestru, szybka rotacja). Obsługiwane przez `connectors/odleglosci.ts` (Overpass).

## Format (`uslugi_stale.json`)

```json
{
  "meta": { "data_importu": "YYYY-MM-DD", "zrodla": ["RSPO","RPWDL","RA"] },
  "rekordy": [
    { "id": "RSPO:123", "kategoria": "szkola", "nazwa": "...", "adres": "...",
      "lat": 52.23, "lon": 21.01, "teryt_gmina": "146501_1",
      "zrodlo": "RSPO", "data_importu": "2026-01-01" }
  ]
}
```

- **Bez `lat`/`lon` rekord jest bezużyteczny** do liczenia odległości → wykluczany przez loader.
- Skalowanie: docelowo tabela `uslugi_stale` w PostGIS z indeksem GiST (gdy dane trafią do reszty warstwy geo).

## Uruchomienie importera (`import.ts`)

Wymaga internetu (RSPO API + geokoder GUGiK). Node 22+, bez dodatkowych zależności.
**Uruchamiasz u siebie** (nie na produkcji) — wynik (`uslugi_stale.json`) commitujesz do repo.

```bash
# Próbny bieg (bez nadpisania pełnej warstwy — mały limit, do pliku obok):
npx tsx tools/uslugi-stale/import.ts --rspo --limit 500 --out /tmp/uslugi_test.json

# Pełny import (nadpisuje src/lib/data/uslugi_stale.json — atomowo):
npx tsx tools/uslugi-stale/import.ts --rspo --rpwdl poz.csv --ra apteki.csv
#   --rspo             szkoły + przedszkola z RSPO API (mają współrzędne)
#   --rpwdl <plik.csv> POZ z eksportu RPWDL (adresy → geokoder GUGiK)
#   --ra <plik.csv>    apteki z eksportu Rejestru Aptek (adresy → geokoder GUGiK)
#   --no-geocode       pomiń geokodowanie (tylko rekordy z gotowymi współrzędnymi)
#   --limit <n>        ogranicz liczbę rekordów (test)
```

Po biegu sprawdź podsumowanie (liczby per kategoria + `bez_wspolrzednych.log.json`).
Bez flag źródeł importer NIE nadpisuje pliku (ochrona seedu). Cache geokodowania:
`tools/uslugi-stale/geocode_cache.json` (kolejny bieg geokoduje tylko nowe adresy).

**Mapowanie kolumn CSV** (RPWDL/RA) jest tolerancyjne — szuka nagłówków zawierających:
`nazwa`, `miejscowo/miasto`, `ulica/adres`, `numer budynku`, `kod pocztowy`, `teryt`,
`szeroko/latitude` i `dlugo/longitude` (gdy eksport ma już współrzędne — geokoder pominięty).
Jeśli Twój eksport ma inne nagłówki, dostosuj `pole(...)` w `import.ts`.

## Procedura importu (raz w roku, wsadowo)

```
1. POBIERZ surowe dane: RSPO (CSV/API), RPWDL (CSV/XML, pełna księga), RA.
2. FILTRUJ wg kategorii (tabela wyżej).
3. GEOKODUJ adresy → lat/lon (GUGiK), wsadowo; CACHE adres→współrzędne
   (nie geokoduj ponownie adresów niezmienionych) → roczny bieg geokoduje tylko nowe/zmienione.
4. NORMALIZUJ do wspólnego schematu.
5. ZAPISZ do uslugi_stale.json — ATOMOWA podmiana (buduj obok, potem podmień).
6. METADANE: data_importu, liczba rekordów per kategoria; ZALOGUJ rekordy bez współrzędnych
   (nie przerywaj importu — poprawa ręczna).
```

## Zapytanie w czasie analizy (M2)

Dla centroidu działki (`src/lib/data/uslugiStale.ts` → `connectors/odleglosci.ts`):

```
1. k-najbliższych per kategoria z warstwy (po linii prostej).
2. Routing pieszy tylko do nich (ORS/OSRM) → realna odległość [m]; brak klucza → linia prosta.
3. Odległość → bramka kanału A (progi per profil per usługa).
```

Bez wywołania zewnętrznego per działka dla 4 kategorii — tylko odczyt lokalny (+ ewentualny routing).

## Reguła kolizji / bramki

- Kategorie „równorzędne": warstwa wypełnia domyślnie; **pole ręczne tylko gdy warstwa nie zwróci
  punktu w zasięgu** (luka rejestru / nowa okolica) — obsłużone w `PytaniaM2` (pytamy o brakujące).
- Odległość wchodzi w bramkę kanału A: > próg dyskwalifikacji → profil odrzucony (seniorzy wrażliwi
  na POZ/aptekę; młodzi na szkołę/przedszkole).
- Brak punktu i brak wpisu ręcznego → **niższa pewność, nie dyskwalifikacja** (brak ≠ „daleko").

## Odświeżanie

Uruchom import raz w roku (ręcznie/cron), atomowa podmiana `uslugi_stale.json`. Sieć placówek zmienia
się wolno; gdy potrzeba świeższych danych — częstszy bieg tego samego skryptu, bez zmian w kodzie.
