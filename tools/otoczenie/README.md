# Warstwa otoczenia / jakości życia (OSM) — modyfikator, nie bramka

Zieleń/park, plac zabaw, poczta, bank/bankomat z OSM. **Łagodny modyfikator popytu** (do +6%)
+ pozytywne sygnały w raporcie — NIE bramka (brak obiektu nigdy nie dyskwalifikuje). Zieleń/plac
zabaw ważą młodzi (rodziny), poczta/bank — seniorzy (codzienne sprawy).

Runtime: `src/lib/data/otoczenie_dane.json` (loader `src/lib/data/otoczenie.ts`), wpięte w konektor
odległości (dodaje `zielen/plac_zabaw/poczta/bank` do `odleglosciM2`) → `modyfikatorOtoczenia`
+ `sygnalyOtoczenia`. Plik w repo to SEED — pełną warstwę wgrywa import.

## Pobranie (Overpass Turbo → „surowe dane OSM")

Na https://overpass-turbo.eu/ wklej i Wykonaj, potem Eksportuj → dane → **surowe dane OSM**:

```
[out:json][timeout:900];
area["ISO3166-1"="PL"][admin_level=2]->.pl;
(
  nwr(area.pl)[leisure=park];
  nwr(area.pl)[leisure=playground];
  nwr(area.pl)[landuse=recreation_ground];
  nwr(area.pl)[natural=wood];
  nwr(area.pl)[landuse=forest];
  nwr(area.pl)[amenity=post_office];
  nwr(area.pl)[amenity=bank];
  nwr(area.pl)[amenity=atm];
);
out tags center;
```

(Duża warstwa — jeśli timeout, pobierz po województwie: `area["name"="województwo mazowieckie"]->.pl;`.)

## Import

```bash
npx tsx tools/otoczenie/import.ts --osm ./otoczenie.json
```
Klasyfikacja → dedup per kategoria (< 40 m) → `otoczenie_dane.json`. Progi/wagi: `KONFIG_M2.otoczenie`.
