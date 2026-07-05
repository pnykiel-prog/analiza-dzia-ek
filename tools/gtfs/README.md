# Statyczna warstwa przystanków (GTFS) — kontekst transportowy M2

Ustala **kontekst transportowy** działki (wytyczne transport §3): czy w okolicy jest „żywe"
pokrycie komunikacją zbiorową. Z tego wynika, czy przystanek działa jako **bramka** kanału A
(miasto), czy tylko **flaga** „teren bez komunikacji zbiorowej" (wieś — bez wpływu na ocenę).

Runtime czyta warstwę z `src/lib/data/gtfs_przystanki.json` (loader: `src/lib/data/przystankiGtfs.ts`,
konektor: `src/lib/data/connectors/gtfs.ts`). Plik w repo to **SEED** — pełną warstwę wgrywa import.

## Źródło danych

GTFS z **Krajowego Punktu Dostępowego** i repozytoriów (feedy per miasto/operator):

- KPD / dane.gov.pl — https://dane.gov.pl (rozkłady GTFS)
- przyjazdy.pl/gtfs, mkuran.pl/gtfs — zbiorcze
- ZTM Warszawa, GZM (Katowice), Kraków, Poznań, Trójmiasto, Wrocław, Łódź, Rzeszów…

Wystarczy **statyczny** GTFS (rozkład); GTFS-RT (real-time) niepotrzebny. Rekomendacja: kilka–
kilkanaście największych aglomeracji (tam koncentruje się popyt; pokrywa się z modelem aglomeracji).

## Co liczymy

**Kursów/dobę roboczą** na każdym przystanku — reprezentatywny dzień (środa):
aktywne `service_id` (calendar/calendar_dates) → kursy (`trips`) → zliczenie odjazdów per
`stop_id` (`stop_times`). To odróżnia żywą linię od „martwej" (2–3 kursy), która formalnie
jest w GTFS, ale nie daje realnej dostępności (§3).

## Uruchomienie (`import.ts`)

GTFS to ZIP — **rozpakuj** każdy feed do osobnego katalogu (ze `stops.txt`, `trips.txt`,
`stop_times.txt`, `calendar.txt` i/lub `calendar_dates.txt`). Node 22+, bez zależności.

```bash
# Rozpakuj feedy, potem:
npx tsx tools/gtfs/import.ts --feed ./warszawa --feed ./gzm --feed ./krakow
#   --feed <katalog>   rozpakowany GTFS (powtarzalny, wiele feedów)
#   --out <plik>       domyślnie src/lib/data/gtfs_przystanki.json
#   --min-kursy <n>    pomiń przystanki poniżej progu (domyślnie 1)
```

Feedy scalane; przystanki dedup po zaokrąglonych współrzędnych (max kursów). Po biegu commituj
`gtfs_przystanki.json`. Po pierwszym imporcie kontekst miejski aktywuje bramkę przystanku (§4.1);
poza pokryciem GTFS kontekst zostaje nieznany (bez flagi, bez kary — §0).

## Reguły oceny (już w silniku)

- `z_komunikacja` (żywy przystanek ≥10 kursów/dobę w 1500 m) → przystanek = bramka kanału A.
- `bez_komunikacji` (pokrycie GTFS, brak żywego przystanku) → flaga, przystanek poza bramką.
- brak pokrycia (najbliższy przystanek > 8 km) → kontekst nieznany, bez flagi.
- Progi: `KONFIG_M2.transportKontekst` (RgtfsM, progKursyDobe, zasiegPokryciaM).
