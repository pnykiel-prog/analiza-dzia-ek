# Statyczna warstwa sklepów spożywczych (kanał A)

Sklepy **nie mają czystego rejestru urzędowego** (jak RSPO/RPWDL/RA), więc warstwa jest
**warstwowa** (wytyczne `wytyczne_claude_code_sklepy.md`): lokalizatory sieci (baza) + OSM
(niezależne) + [REGON] → dedup → geokod → jeden znormalizowany format ze współrzędnymi.

Runtime czyta `src/lib/data/sklepy_dane.json` (loader: `src/lib/data/sklepy.ts` → `kandydaciSklep`),
łączony z warstwą usług w konektorze odległości. Plik w repo to **SEED** — pełną warstwę wgrywa import.

## Źródła (wg priorytetu)

| Źródło | Rola | Uwaga |
|---|---|---|
| Lokalizatory sieci | **baza** (>70% rynku) | Biedronka, **Dino (klucz do wsi)**, Żabka, Lidl, Netto, Kaufland, Aldi, Auchan, Stokrotka, Carrefour |
| OSM (Overpass) | sklepy niezależne | `shop~supermarket\|convenience\|grocery\|greengrocer` |
| REGON/CEIDG (PKD 47.11.Z) | opcjonalna kompletność | zaszumione (kioski, nieaktywne) — tylko do luk |

## Format (`sklepy.json`, spójny z uslugi_stale + `siec`/`zrodlo`)

```json
{ "id": "...", "kategoria": "sklep", "nazwa": "Dino", "adres": "...", "lat": 52.5, "lon": 16.7,
  "teryt_gmina": "...", "siec": "Dino", "zrodlo": "siec", "data_importu": "2026-01-01" }
```

## Uruchomienie (`import.ts`)

Lokalizatory sieci pobierz per sieć (zwykle ze współrzędnymi lub adresem) do CSV
(`siec,nazwa,adres,teryt[,lat,lon]`). OSM — eksport Overpass do JSON. Node 22+, bez zależności.

```bash
npx tsx tools/sklepy/import.ts --siec biedronka.csv --siec dino.csv --osm osm.json --regon regon.csv
#   --siec <csv>   lokalizator sieci (powtarzalny)     --osm <json>  eksport Overpass (elements)
#   --regon <csv>  REGON PKD 47.11.Z (kompletność)      --out <plik>  --no-geocode
```

- **Dedup** (bez podwójnego liczenia): łączenie po bliskości < 50 m, priorytet **sieć > OSM > REGON**.
- **Geokod**: adresy bez współrzędnych → GUGiK (cache współdzielony z `tools/uslugi-stale/geocode_cache.json`).
- Atomowa podmiana + metadane (liczby per źródło). Odświeżanie **2×/rok**.

## Reguła kolizji (spójnie z usługami)

Typ „równorzędna": warstwa wypełnia domyślnie; ręczne pole odległości **tylko gdy warstwa nie
znajdzie sklepu w zasięgu**. Brak w warstwie i brak wpisu → niższa pewność, **nie dyskwalifikacja**
(realny „food desert" ≠ luka danych). Progi bramki: `KONFIG_M2.progiUslug.sklep` (per profil).
