# GRUNT — Zestawienie kompletu danych Poziomu 1 (M1)

Rejestr wszystkich informacji, z których korzysta silnik M1 (przesiew) — źródła,
status pozyskiwania, sposób użycia i wyniki. Dokument jest podstawą do
przygotowania analogicznego zestawienia dla M2 (ocena / model zabudowy).

Źródła prawdy w kodzie:
- `src/lib/engine/poziom1.ts` — orkiestracja M1,
- `src/lib/engine/popytP1.ts` — model popytu (4 werdykty),
- `src/lib/engine/potencjal.ts` — prognoza pojemności,
- `src/lib/types.ts` — `DaneDzialki` (pełny kontrakt wejścia),
- `src/lib/data/connectors/*` — konektory (ULDK, GUS BDL, KIMPZP),
- `src/lib/config.ts` — progi, wagi, benchmarki (`KONFIG_POPYT_P1`, `KONFIG_POZIOM1`).

Legenda statusu pozyskiwania:
- ✅ **auto (live)** — pobierane automatycznie z API dla konkretnej działki/gminy,
- 🟡 **auto proxy/fallback** — pobierane automatycznie, ale przybliżone (proxy albo tabela regionalna),
- ⚪ **niepobierane** — silnik używa wartości neutralnej/deklaracji; szew na LIVE zostawiony.

---

## 1. Co M1 faktycznie ocenia

M1 jest wąski i deterministyczny. Ocenia **trzy** rzeczy i nic więcej
(środowisko, uzbrojenie, dostępność, geotechnika → M2):

1. **Lokalizacja i rozmiar** działki (geometria z ULDK).
2. **Pojemność** — *prognoza orientacyjnego potencjału zabudowy* z kształtu
   działki + zabudowy sąsiedztwa + spadku terenu (zamiast ręcznych wskaźników MPZP/WZ).
3. **Popyt** — siatka **4 werdyktów** (społeczny/komunalny × młodzi/seniorzy) na
   podstawie demografii, dochodu, migracji i rynku.

Wynik = dopasowanie **pojemności** do **popytu**, osobno dla profilu młodych i seniorów.
Podstawa planistyczna (KIMPZP/deklaracja) działa wyłącznie jako **bramka**
(czy funkcja mieszkaniowa dozwolona) + adnotacja „do potwierdzenia w planie".

---

## 2. Dane wejściowe — pełny rejestr

### A. Geometria i lokalizacja — źródło: **ULDK / EGiB** → zasila POJEMNOŚĆ

| Pole (`DaneDzialki`) | Status | Rola w M1 |
|---|---|---|
| `id`, `teryt`, `gmina`, `powiat`, `wojewodztwo` | ✅ auto | Identyfikacja; klucz do GUS; seed sąsiedztwa |
| `powierzchniaM2` | ✅ auto | Podstawa prognozy pojemności (pow. × pokrycie × …) |
| `zwartoscKsztaltu` (Polsby-Popper 0..1) | ✅ auto | `efektywnoscKsztaltu` — jak dobrze działka nadaje się pod zabudowę |
| `minSzerokoscM` (min. bok prostokąta) | ✅ auto | Kara za wąską działkę (< próg wielorodzinnej) |
| `frontM`, `proporcjaBokow` | ✅ auto | Fallback szerokości; sygnał kształtu |

### B. Podstawa planistyczna — źródło: **KIMPZP** / deklaracja użytkownika → BRAMKA

| Pole | Status | Rola w M1 |
|---|---|---|
| `mpzpMeta` (symbol, przeznaczenie, nazwa planu, **maks. wys., intensywność**) | 🟡 auto (gminy pokryte) | Ustala `podstawa` (źródło = `kimpzp`); metryka planu |
| `statusPlanistyczny` (`mpzp_mieszkaniowy` / `sprzeczny` / `brak_danych`) | 🟡 auto | `funkcjaDozwolona`: `sprzeczny` → zeruje werdykty społeczne |
| `podstawa` (ręczna deklaracja typ+symbol) | ⚪ deklaracja | Ma pierwszeństwo, gdy podano symbol |
| `mpzpObecnosc` (`jest`/`brak`/`nieznane`) | ⚪ deklaracja | Adnotacja + obniżenie pewności prognozy, gdy `jest` |

> Pokrycie KIMPZP zdiagnozowane: ~6 dużych miast to „dziury" (Kraków, Gdańsk,
> Lublin, Bielsko-Biała, Opole, Sosnowiec). Tam M1 degraduje się do prognozy.

### C. Sąsiedztwo i teren — źródło: **deterministyczny seed** (szew na BDOT+NMT) → POJEMNOŚĆ

| Sygnał | Status | Rola w M1 |
|---|---|---|
| `pokrycieUdzial` (obrys budynków / bufor) | ⚪ seed (szew: BDOT) | Mnożnik pow. zabudowy |
| `typoweKondygnacje` (mediana w otoczeniu) | ⚪ seed (szew: BDOT) | Liczba kondygnacji → pow. całkowita |
| `sredniSpadekPct` | ⚪ seed (szew: NMT) | `mnoznikSpadku` (1.0 → 0.5 przy dużym spadku) |

### D. Demografia i dochód — źródło: **GUS BDL** → zasila POPYT (kwalifikacje + werdykty)

| Pole | Status | Rola w M1 |
|---|---|---|
| `liczbaMieszkancowGminy` | ✅ auto | Mianownik werdyktów komunalnych (per mieszkaniec) |
| `liczba2039` (liczebność 20–39) | ✅ auto | `nGrupa` profilu „młodzi" |
| `liczba65Plus` (liczebność 65+) | ✅ auto | `nGrupa` profilu „seniorzy" |
| `udzial2039Pct`, `udzial65PlusPct` | ✅ auto | Fallback liczebności (% × ludność) |
| `dochodPrzecietnyGmina` (mies.) | 🟡 proxy (wynagrodzenie powiat) | Trójdzielny podział K/S/R (log-normal) → `qK`, `qS` |
| `mediana2039Woj` | 🟡 auto/fallback | Odniesienie regionalne |

Podział dochodowy: progi liczone od `wartoscOdtworzeniowaM2` (× `progDochoduKomunalnyMn`
i `× progDochoduSpolecznyMn`), rozkład log-normal z `sigmaDochodu`. Wynik: liczby
bezwzględne `nKomunalny` (segment K) i `nSpoleczny` (segment S).

### E. Migracje — źródło: **GUS BDL** → zasila ATRAKCYJNOŚĆ MIGRACYJNĄ

| Pole | Status | Rola w M1 |
|---|---|---|
| `naplywZameldowanNa1000` | ✅ auto | **A1 (zmierzone)** — bramka wiarygodności dla A2/A3 |
| `odplywMlodychNa1000` | ✅ auto | **A3** — zatrzymany odpływ młodych |
| `saldoMigracjiMlodzi` | 🟡 proxy (saldo ogółem) | Fallback A1, gdy brak napływu brutto |

A1 zmierzone „otwiera bramę" dla estymowanych A2 (potencjał z tańszej oferty) i A3.
Wartość atrakcyjności = `A1 + waga2·A2 + waga3·A3` (sufit 100).

### F. Modyfikatory (centrowane w 1,0) — źródło: **GUS BDL / rynek**

| Pole | Status | Rola w M1 |
|---|---|---|
| `trendLudnosc` (`rosnaca`/`stabilna`/`malejaca`) | ✅ auto | `M_trend`, `napiecie01` |
| `populacjaStabilna` | ✅ auto | Kara senioralna przy wyludnianiu |
| `trend65Plus` (`rosnacy`/…) | ⚪ niepobierane | Kara senioralna (z `populacjaStabilna`) |
| `bezrobociePct` | ✅ auto | `pull01` (pull gospodarczy → atrakcyjność) |
| `liczbaPodmiotowGosp` (na 1000) | ✅ auto | `pull01` |
| `pustostanyPct` | ⚪ niepobierane (neutral 0.55) | `napiecie01` (napięcie mieszkaniowe) |

### G. Rynek — źródło: **config-rynek** (tabele regionalne) → luka cenowa

| Pole | Status | Rola w M1 |
|---|---|---|
| `wartoscOdtworzeniowaM2` | 🟡 tabela regionalna | Pułap czynszu; progi podziału dochodowego |
| `czynszRynkowyM2` (mies.) | 🟡 tabela / ⚪ biała plama | `lukaCenowaPct` (czynsz vs pułap) → `M_luka`, atrakcyjność |

---

## 3. Wyniki M1 — co M1 produkuje (→ wejście do M2)

Silnik M1 (`WynikPoziom1`) zwraca:

| Wynik | Opis | Wykorzystanie w M2 |
|---|---|---|
| `podstawa` (`PROGNOZA`/`MPZP`, źródło) | Skąd wzięto wskaźniki | M2 startuje od tego samego rozróżnienia |
| `prognoza` (`PrognozaPotencjalu`) | Pow. zabudowy, kondygnacje, PUM, liczba mieszkań, pewność, flagi | Punkt wyjścia obwiedni M2 |
| `pojemnosc` (`PojemnoscP1`) | `maxPowZabudowyM2`, `pumM2`, szac. liczba mieszkań (młodzi/seniorzy) | Porównanie z obwiednią M2 |
| `ocenaPopytu` (4 werdykty + kwalifikacje + atrakcyjność) | Popyt społeczny/komunalny × profil | Uzasadnienie profilu/typologii |
| `profilRekomendowany` (`mlodzi`/`seniorzy`/`oba`/`zaden`) | Kierunek projektu | **Determinuje warianty zabudowy M2** |
| `funkcjaMieszkaniowaDozwolona` | Bramka sprzeczności | Blokada w M2 |
| `werdykt`, `pewnosc`, `tryb`, `flagi` | Zbiorczy wynik przesiewu | Nagłówek studium |

---

## 4. Szablon do zestawienia M2 (czego M2 potrzebuje DODATKOWO)

M2 wyprowadza **model zabudowy** (obwiednia → warianty → typologia) i przenosi
z M1 twarde bramki środowiskowe/formalne. Pola z `DaneDzialki` **odłożone przez
M1**, a konsumowane przez M2 (`poziom2.ts`, `uwarunkowania.ts`):

### Nowe wejścia M2 (dziś głównie deklaratywne/niepobierane — do zaprojektowania jak w M1)

| Sekcja | Pola `DaneDzialki` | Źródło docelowe | Status dziś |
|---|---|---|---|
| Wskaźniki planistyczne | `wskaznikiPlanistyczne` (intensywność, maks. kond., % zabudowy, PBC, parking, % usług) | MPZP (KIMPZP wektor) / plan ogólny | ⚪ deklaracja / fallback sąsiedztwo |
| Uwarunkowania fizyczne | `sredniSpadekPct`, `ryzykoPowodzioweSzczegolne`, `osuwisko`, `terenGorniczy` | NMT / ISOK / SOPO (WMS) | ⚪ szew |
| Uzbrojenie | `odlegloscDoSieciM`, `odlegloscDoZabudowyM` | GESUT / BDOT | ⚪ szew |
| Dostępność | `czasDojazdAglomeracjaMin`, `przystanekZCzestotliwoscia` | OSM / routing / GTFS | ⚪ szew (wpływa na normatyw parkingowy) |
| Infrastruktura społeczna | `uslugiPodstawowePieszo`, `pozWZasiegu`, `zlobkiSzkolyWZasiegu` | Overpass / POI | ⚪ szew (różne dla profili) |
| Środowisko/ochrona | `natura2000`, `ochronaWykluczajaca`, `strefaKonserwatorska` | GDOŚ / NID (WMS) | ⚪ szew (bramki) |
| Grunt/użytki | `klasaUzytku`, `gruntLesny`, `gruntRolnyKlasaIdoIII` | EGiB | ⚪ szew (bramki formalne) |
| Formalne | `dostepDrogaPubliczna`, `budynkiIstniejace` | EGiB / BDOT | ⚪ szew |

### Wskaźniki M2 wyprowadzane z powyższych
- **Obwiednia** (`Obwiednia`): `maxPowZabudowyM2`, `powCalkowitaNadziemnaM2`, `pumM2`,
  `maxKondygnacje`, źródło wskaźników, pewność.
- **Warianty** (`WariantZabudowy`): typologia, kondygnacje, liczba mieszkań, mix
  metraży, parking (normatyw obniżany przy dobrym transporcie), winda, PBC → parking podziemny.
- **Bramki / sygnały / braki** (`uwarunkowania.ts`) — środowiskowe i formalne.

> Wniosek do M2: powtórzyć wzorzec M1 — dla każdego pola ustalić **źródło (API)**,
> **status pozyskiwania** i **regułę fallbacku**, żeby M2 również pobierał dane
> automatycznie (dziś większość sekcji C–H to szwy „⚪ niepobierane").
