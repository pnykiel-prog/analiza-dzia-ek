# GRUNT — pełna logika oceny działki pod budownictwo społeczne

**Dokument do recenzji merytorycznej (zewnętrzny ekspert).**
Cel: opisać *co* liczy aplikacja, *jak* liczy i *jakimi parametrami/wagami*, tak
aby można było logicznie ocenić, czy przyjęte założenia i wartości są prawidłowe.

Wszystkie wartości liczbowe w tym dokumencie pochodzą **wprost z kodu** (pliki
`src/lib/config.ts`, `src/lib/finanse/parametry_finansowania.json`,
`src/lib/data/wartoscOdtworzeniowa.ts`) i silników (`src/lib/engine/*`,
`src/lib/finanse/*`). Parametry są celowo wyniesione do warstwy konfiguracji —
są **kalibrowalne**, nie zaszyte w logice.

Na końcu (sekcja 9) zebrano **pytania kalibracyjne** — miejsca, w których ocena
eksperta jest najbardziej potrzebna.

---

## 0. Jak czytać ocenę

Ocena jest **trójpoziomowa i kaskadowa**. Każdy poziom odpowiada na inne pytanie
i może działać niezależnie (przy niepełnych danych obniża się „pewność", a nie
blokuje wynik):

| Poziom | Pytanie | Natura |
|---|---|---|
| **M1 — Przesiew** | Czy na tej działce *fizycznie* da się budować i czy jest *popyt*? | Bramka wielkości + model popytu (4 werdykty) |
| **M2 — Przydatność** | Czy *lokalizacja* (usługi, uzbrojenie, dojazd) domyka popyt w realny wynik? | Kanały A–F, werdykt przydatności per profil |
| **M3 — Model finansowy** | *Kto* buduje i czy *montaż finansowy się spina*? | Koszt vs źródła (grant/kredyt/partycypacja/wkład) |

Dwa **profile** przewijają się przez całość: **młodzi** (20–39 lat) i **seniorzy**
(65+). Wiele progów i wag różni się per profil (seniorzy są wrażliwsi na
walkability/transport, młodzi na migrację i dojazd do aglomeracji).

**Zasada danych:** brak danej ≠ zła danina. „Nieznane" obniża pewność, a nie
punktację. Twardo dyskwalifikują tylko: fizyczna niewykonalność (M1) oraz bramki
bezwzględne A/E (M2). Wszystko inne *skaluje*.

---

## 1. Dane wejściowe i ich źródła

| Dana | Źródło | Rola |
|---|---|---|
| Geometria działki (WKT, powierzchnia, front, zwartość kształtu) | ULDK (GUGiK) | Bramka wielkości, pojemność |
| Ludność gminy, 20–39, 65+, dochód, migracje, podmioty gosp., bezrobocie, pustostany, trendy | GUS BDL (po **kodzie TERYT**) | Model popytu M1 |
| Przeznaczenie (MPZP/symbole) | KIMPZP | Dopuszczalność zabudowy, pojemność |
| Odległości pieszo (sklep, apteka, POZ, szkoła, przedszkole), otoczenie, transport | OSM / warstwy statyczne | Kanały A/otoczenie/transport M2 |
| Odległość do sieci, spadek terenu | WMS / NMT | Kanał B (koszt uzbrojenia) M2 |
| Dojazd do aglomeracji / model pierścieni | routing / model klas miast | Kanał C M2 |
| Wartość odtworzeniowa [zł/m²] | Warstwa WO (obwieszczenia wojewodów) | Progi dochodowe M1, pułap czynszu M3 |
| Czynsz rynkowy, ceny gruntu | Rejestr cen / benchmark regionalny | Luka cenowa M1, koszt gruntu M3 |

> **Uwaga poprawnościowa:** gmina do zapytań GUS jest wyprowadzana z **kodu TERYT**
> zawartego w identyfikatorze działki (6 cyfr WWPPGG), a jednostka BDL jest
> **zakotwiczona po TERYT**, nie po samej nazwie gminy (w Polsce dziesiątki gmin
> ma identyczne nazwy). Warstwa WO i benchmarki regionalne kluczują po
> kanonicznym województwie + gminie z tego samego słownika.

---

## 2. M1 — Bramka wielkości / kształtu i forma zabudowy

Wchodzi **zaraz po geometrii z ULDK, przed popytem**. Działa na *pewnej* geometrii,
więc może bramkować stanowczo. Rozstrzyga trzy rzeczy.

### 2.1. Fizyczna wykonalność (twarda bramka — odrzuca bez pytania)
Działka przechodzi, gdy zmieści się choćby **minimalna zabudowa niska (≥1 lokal)**
oraz nie jest **za wąska**.

| Parametr | Wartość | Znaczenie |
|---|---|---|
| `minSzerokoscBudowlanaM` | **6 m** | Poniżej — budynek się nie mieści (bramka fizyczna) |
| `progScalenieM2` | **500 m²** | Za mała powierzchniowo, ale ≥ scalenie → sugestia „połącz z sąsiednimi", nie „nieprzydatna" |

Wynik: `nieprzydatna` (za mała/wąska) / `scalenie` (mała, ale nadaje się do scalenia).

### 2.2. Forma zabudowy — niska vs wysoka
Pojemność liczona **tym samym łańcuchem** (patrz §5) dla formy **niskiej**
(≤ 2 kondygnacje) i **wysokiej** (> 2). Rekomendowana = ta z **większą liczbą
lokali** (przy remisie — niska, bo tańsza i prostsza do uzgodnienia).

| Parametr | Wartość |
|---|---|
| `maxKondygnacjeNiska` | 2 |
| Udział powierzchni wspólnych — niska / wysoka | 8% / 16% |
| Udział usług w parterze | 5% |

Realny udział PUM w powierzchni całkowitej (GFA): η=0,80 × (1 − wspólne − usługi)
→ **niska ≈ 0,70**, **wysoka (młodzi) ≈ 0,63**.

### 2.3. Próg opłacalności (miękki punkt decyzyjny — NIE odrzuca)
Jeśli rekomendowana forma daje **mniej lokali niż typowy próg**, pojawia się
obserwacja + pytanie „analizować dalej?". Konflikt progów (wysoka poniżej swojego,
niska w swoim) → decyzja wraca do klienta.

| Parametr | Wartość |
|---|---|
| `progOplacalnosciNiska` | **20 lokali** |
| `progOplacalnosciWysoka` | **40 lokali** |

Wyniki: `ok` / `nizsza_oplacalnosc` / `konflikt`.

---

## 3. M1 — Model popytu (4 werdykty, 2 natury)

To serce M1. Zamiast dwóch profili — **siatka 4 werdyktów** o dwóch naturach:

- **SPOŁECZNE** (młodzi / seniorzy) — ocena *projektu na działce* (popyt vs pojemność),
- **KOMUNALNE** (młodzi / seniorzy) — *skala potrzeby w gminie* (per mieszkaniec vs mediana regionalna), bez pojemności.

**Rekomendowany kierunek** = kafel o najwyższym score. Pasma: **≥65 zielony
(„Nadaje się"), ≥40 żółty („Warunkowo"), <40 czerwony**.

### 3.1. Kto się kwalifikuje — trójdzielny podział dochodowy (K / S / R)
Model bierze wartość odtworzeniową (WO) i dochód przeciętny gminy, nakłada
rozkład **log-normal** dochodów i dzieli grupę na trzy koszyki:

```
próg dolny  = WO/m² × 0,5      (dochód < próg → KOMUNALNY)
próg górny  = WO/m² × 1,4      (dolny ≤ dochód < górny → SPOŁECZNY; ≥ górny → RYNEK)
qK = LogNormalCDF(próg dolny; średnia = dochód gminy, σ = 0,6)
qS = LogNormalCDF(próg górny) − qK
nKomunalny = liczebność grupy × qK
nSpoleczny = liczebność grupy × qS
```

| Parametr | Wartość | Uwaga |
|---|---|---|
| `progDochoduKomunalnyMn` | 0,5 | mnożnik WO → próg dolny |
| `progDochoduSpolecznyMn` | 1,4 | mnożnik WO → próg górny |
| `sigmaDochodu` (σ log) | 0,6 | kształt rozkładu dochodów (regionalny) |
| `dochodFallback` | 6500 zł/mc | gdy brak danych GUS |
| `wartoscOdtwFallback` | 5000 zł/m² | gdy brak WO |

> **Do oceny eksperta:** progi dochodowe są wyrażone jako *mnożnik WO/m²* — to
> proxy (WO w zł/m² traktowane jako miesięczny próg dochodu gospodarstwa). σ=0,6
> to typowa rozpiętość log-normalna dochodów. Zob. pytanie K1.

### 3.2. Luka cenowa (sygnał popytu na najem regulowany)
```
pułap czynszu SIM = WO/m² × 0,05 / 12          (5% WO rocznie)
luka% = (czynsz rynkowy − pułap) / czynsz rynkowy × 100
```
Luka ≥ 30% → flaga „realny popyt na najem społeczny".

### 3.3. Kafle SPOŁECZNE
```
fSila       = clamp(qS / 0,22 ; 0,3 … 1,3)                  # siła segmentu społ. vs benchmark
fWystarcz   = clamp01( nSpoleczny / (pojemnoscMieszkan × 5) )
popytWew    = clamp( 100 × fWystarcz × fSila )
baza        = waga_wew × popytWew + waga_zew × atrakcyjnoscMigracyjna
score       = clamp( baza × M_luka × M_napięcie )
```

| Parametr | Młodzi | Seniorzy |
|---|---|---|
| Waga wewnętrzna / zewnętrzna (migracja) | **0,55 / 0,45** | **0,85 / 0,15** |
| `margines` (kwalifikujących na 1 mieszkanie = pełna wystarczalność) | 5 | 5 |
| `qBenchS` (benchmark udziału społecznego) | 0,22 | 0,22 |

Modyfikatory (centrowane w 1,0):
```
M_luka      = 0,75 + 0,5 × clamp01(luka/100)               # zakres 0,75–1,25
M_napięcie  = skala(napięcie01 ; 0,8 … 1,2)
napięcie01  = clamp01( 0,6 × pustostanyIdx + 0,4 × trendIdx )
```

> **Kluczowy mechanizm interpretacyjny:** popyt wewnętrzny (`popytWew`) jest
> *identyczny* dla młodych i seniorów, gdy oba segmenty przekraczają pojemność
> (fWystarcz=1) — bo qS nie zależy od profilu. Różnicę robi wtedy **waga
> migracji** (45% młodzi vs 15% seniorzy). Profil oparty mocniej na migracji
> (młodzi) dostaje niżej, gdy atrakcyjność migracyjna < popyt wewnętrzny.

### 3.4. Kafle KOMUNALNE (skala potrzeby, bez pojemności i migracji)
```
gęstość     = nKomunalny / ludność gminy × 1000
ratio       = gęstość / benchKomNa1000(=8)
scoreBase   = clamp( 50 × ratio )                          # ratio=1 (mediana) → 50 pkt
score       = clamp( scoreBase × M_napięcieKom × M_trend(profil) )
```

| Parametr | Wartość |
|---|---|
| `benchKomNa1000` (mediana regionalna na 1000 mieszk.) | **8** |
| `M_napięcieKom` (zakres) | 0,8 – **1,4** (mocniej w górę niż społeczne) |
| `M_trend` młodzi (zakres) | 0,85 – 1,15 |
| `M_trend` seniorzy (zakres) | **0,6 – 1,1** (ostrzej w dół) |
| Kara „pułapka senioralna" | ×0,7 gdy 65+ rośnie przy niestabilnej populacji |

> **Mechanizm:** komunalny-seniorzy jest celowo tłumiony w gminach z wzorcem
> starzenia przy wyludnianiu (mieszkania komunalne dla samych seniorów utrwalają
> odpływ). Stąd np. wysoka gęstość (nasycony scoreBase=100) może zejść do ~44
> przez sam mnożnik trendu.

### 3.5. Atrakcyjność migracyjna (A1 mierzone → bramka dla A2/A3 estymowanych)
```
A1 = clamp( napływ_zameldowań/1000 / 20 × 50 )             # zmierzone (bench=20/1000 → 50)
brama = clamp01( A1/100 × 0,7 + lukaNorm × 0,3 )           # wiarygodność „życzeniowej" migracji
A2 = brama × clamp01( 0,5×lukaNorm + 0,5×pull ) × 100      # potencjał odblokowany tańszą ofertą
A3 = brama × clamp01( 0,5×odpływNorm + 0,5×lukaNorm ) × 100 # zatrzymany odpływ młodych
wartość = clamp( A1 + 0,6×A2 + 0,4×A3 ; 0 … 100 )
```
`pull` = rynek pracy (niskie bezrobocie + gęstość podmiotów). Benchmarki: napływ
20/1000, odpływ 15/1000. Pewność maleje z udziałem estymowanych A2/A3.

> **Do oceny eksperta:** A1 opiera się na zmierzonym napływie; A2/A3 są
> estymowane i „bramkowane" przez A1 — celowo, by uniknąć życzeniowej migracji
> w gminach bez realnego napływu. Zob. pytanie K2.

---

## 4. M2 — Kanały przydatności (A–F)

M2 domyka popyt M1 w **werdykt przydatności per profil**. Trzy rodzaje odległości
działają **różnymi kanałami** (to było źródłem wcześniejszego błędu):

```
popytRealizowalny = clamp( popytM1 × A × C × T × O )
ekonFaktor        = 0,7 + 0,3 × (B / 100)                  # B skaluje, nie zeruje
score(M2)         = clamp( popytRealizowalny × ekonFaktor )
```
Jeśli profil nieobsługiwalny (bramka A) lub działka niedopuszczalna (bramka E) →
**score = 0**. Pasma jak w M1 (65 / 40).

### 4.1. Kanał A — dostępność usług pieszo (bramka + mnożnik)
Każda krytyczna usługa ma **własne progi** (komfort, dyskwalifikacja). Faktor
usługi = 1,0 (≤ komfort) → 0,3 (liniowo do dyskwalifikacji); ≥ dyskwalifikacja →
**bramka (mnożnik 0, weakest-link)**. Mnożnik kanału A = średnia faktorów.

| Usługa | Profil | Komfort [m] | Dyskwalifikacja [m] |
|---|---|---|---|
| Przychodnia POZ | seniorzy | 500 | 5000 |
| Apteka | seniorzy | 400 | 3500 |
| Sklep spożywczy | seniorzy / młodzi | 400 / 600 | 3000 / 4000 |
| Szkoła | młodzi | 1000 | 8000 |
| Przedszkole/żłobek | młodzi | 1000 | 8000 |

`minFaktorUslugi` = 0,3 (dolna wartość gradientu). Brak danej → nie dyskwalifikuje
(tylko niższa pewność).

### 4.2. Kanał B — koszt uzbrojenia → przydatność ekonomiczna (0–100)
```
start = 100
jeśli odległość do sieci > 500 m:  −min(45, (odl − 500)/20)
jeśli brak danej o sieci:          −8
jeśli spadek > 8%:                 −min(25, (spadek − 8)×2)
```
Wchodzi do score jako `ekonFaktor = 0,7 + 0,3×(B/100)` — czyli **B waży maks. 30%**
wyniku i nigdy nie zeruje.

### 4.3. Kanał C — modyfikator popytu (aglomeracja, potencjał, pustostany)
```
m = 1
× modyfikator bliskości aglomeracji (model pierścieni, per profil)
× podmioty gosp.:  >140 → ×1,05 ;  <80 → ×0,95
× trend ludności:  malejąca → ×0,9 ;  rosnąca → ×1,05
× pustostany > 8% → ×0,9
wynik: clamp(m ; 0,40 … 1,30)
```

**Model bliskości aglomeracji** (pierścienie skalowane klasą miasta A–D):

| Klasa | Rdzeń [km] | Zasięg [km] | Siła bazowa |
|---|---|---|---|
| A | 20 | 60 | 100 |
| B | 10 | 35 | 70 |
| C | 8 | 20 | 45 |
| D | 4 | 10 | 25 |

Amplituda modyfikatora wokół 1,0: młodzi ±0,40, seniorzy ±0,15. Bonus drugiego
ośrodka: 0,10.

### 4.4. Kanał T — transport zbiorowy (łagodny bonus, nigdy kara)
Do **+10%** popytu. „Nie ma"/brak danych → mnożnik 1,0 (neutralny) + flaga
informacyjna. Bonus z walkability (najbliższy przystanek) i jakości (najlepszy:
linie × kursy/dzień).

| Parametr | Seniorzy | Młodzi |
|---|---|---|
| Walkability: komfort / zero [m] | 300 / 1500 | 500 / 2500 |
| Wagi: walk / jakość / noc | 0,65 / 0,33 / 0,02 | 0,40 / 0,50 / 0,10 |
| Pełna jakość: linii / kursów/dzień | ≥5 / ≥40 | ≥5 / ≥40 |

### 4.5. Kanał O — otoczenie / jakość życia (łagodny bonus, nigdy kara)
Do **+6%** popytu. Kategorie: zieleń, plac zabaw, poczta, bank. Komfort ≤500 m,
zero ≥2000 m.

| Waga kategorii | Młodzi | Seniorzy |
|---|---|---|
| Zieleń | 0,45 | 0,35 |
| Plac zabaw | 0,40 | 0,00 |
| Poczta | 0,05 | 0,35 |
| Bank | 0,10 | 0,30 |

### 4.6. Kanał E — bramki bezwzględne
Środowisko/grunt/droga (Natura 2000, powódź, osuwiska…). **Obecnie zaparkowane**
(`BRAMKI_SRODOWISKOWE_AKTYWNE = false`) — źródła WMS niedostępne, więc nie wchodzą
do oceny. Gdy aktywne: `fail` → score profilu = 0.

### 4.7. Synteza i rekomendacja
Werdykt per profil (score + pasmo). **Rekomendacja** = najlepszy z profili
jednocześnie *obsługiwalnych* (A) i *dopuszczalnych* (E); „brak", gdy żaden.

---

## 5. Model pojemności zabudowy (łańcuch Pz → GFA → PUM → mieszkania)

Wspólny dla bramki formy (M1) i pełnej pojemności (P2):
```
powierzchnia zabudowy (Pz) = powierzchnia działki × pokrycie(kształt, sąsiedztwo, MPZP)
GFA = Pz × liczba kondygnacji
PUM = GFA × η(0,80) × (1 − wspólne − usługi)
liczba mieszkań = PUM / metraż średni(profil)
```

| Parametr | Wartość |
|---|---|
| `wspolczynnikEfektywnosci` (η) | 0,80 |
| `gornyLimitPokrycia` | 0,45 |
| Kondygnacje fallback (brak sąsiedztwa) | 2 |
| Zwartość / efektywność neutralna (brak geometrii) | 0,70 / 0,85 |
| Min. szerokość dla wielorodzinnej | 18 m |
| Metraż średni: młodzi / seniorzy | 41 / 45 m² |
| `progMieszkanViable` | 15 |

**Fallback sąsiedztwa (brak MPZP):** intensywność 0,9; max 4 kondygnacje;
max pow. zabudowy 35%; min PBC 30%.

Mix metraży (P2): młodzi — kawalerka 30 m² (45%), 2-pok 45 m² (40%), 3-pok 60 m²
(15%); seniorzy — 1-pok 40 m² (55%), 2-pok 50 m² (45%). Normatyw parkingowy:
młodzi 0,7 / seniorzy 0,5 miejsca/lokal. Parking pod ziemię, gdy PBC > 40%;
tarasowanie, gdy spadek > 10%.

---

## 6. M3 — Model finansowy (montaż SIM)

**Jeden silnik** składa montaż z parametrów **wg zasobu** (nie płaska stawka).
Pytanie „kto buduje" (typ inwestora × typ zasobu × forma współpracy × reżim) NIE
zmienia przydatności działki — wpływa tylko na montaż.

### 6.1. Koszt inwestycji (jedna definicja, spójna z raportem)
```
budowa           = koszt budowy/m² (suwak) × powierzchnia (PUM całkowite)
grunt            = wartość działki (tylko gdy ZAKUP; 0 gdy aport/posiadana)
uzbrojenie       = 50 000 + 800 × odległość do sieci [m]   (albo 150 000 gdy brak danej)
projekt          = 8% × budowa
koszty finansowe = szacKredyt × 0,75% + szacKredyt × oproc × (24/12) × 0,5
rezerwa          = 5% × (budowa + uzbrojenie)
RAZEM            = suma powyższych
```
Suwak kosztu budowy: 4000–15000 zł/m², domyślnie 9500, krok 250. (W raporcie
inicjowany wartością WO lokalizacji.)

### 6.2. Zdolność kredytowa — TYLKO ze strumienia czynszowego
Dwa strumienie przychodu SIM **się nie mieszają**: czynszowy (≤5% WO/rok) spłaca
kredyt; operacyjny (utrzymanie/remonty) finansuje się osobno → koszty operacyjne
**NIE** są odejmowane od zdolności kredytowej.
```
czynsz/m²/mc        = WO/m² × 5% / 12
przychód czynszowy  = czynsz/m² × PUM mieszkalna × 12 × (1 − pustostany 5%)
przychód na spłatę  = przychód czynszowy × (1 − bufor 12,5%)        # DSCR ~1,11–1,15
annuityFactor       = (1 − (1+o)^−n) / o
kredyt ze zdolności = przychód na spłatę × annuityFactor
```

| Założenie | Wartość |
|---|---|
| Stopa pułapu czynszu | 5% WO/rok |
| Pustostany | 5% |
| Bufor bezpieczeństwa (DSCR) | 12,5% |
| Rezerwa na ryzyko | 5% (budowa+uzbrojenie) |
| Koszty projektowe | 8% budowy |
| Koszty operacyjne | 11 zł/m²/mc (strumień operacyjny — poza zdolnością) |
| Faza budowy | 24 mies. (proj./decyzje 9, nabór 5) |

### 6.3. Kolejność domykania źródeł (kredyt maksymalizowany)
```
1. APORT (gdy działka wnoszona aportem/LzG)   = wartość działki
2. GRANT      = min( grant% × RAZEM , pozostała luka )         # grant NIE finansuje gruntu
3. PARTYCYPACJA = min( part% × RAZEM , pozostała luka )         # auto: max gdzie przysługuje
4. KREDYT     = min( zdolność czynszowa , limit programowy × RAZEM , luka )
5. WKŁAD WŁASNY = luka − kredyt                                 # pozycja DOMYKAJĄCA
```
Etykieta wkładu: „gminy" (podmioty gminne) / „inwestora" (pozostali).

### 6.4. Grant wg zasobu — tabele (kluczowe dla wyniku)

**Reżim obecny (SBC do jesieni 2026), instrument BSK:**

| Kategoria zasobu | Grant base | Grant max |
|---|---|---|
| komunalny / socjalny | **50%** | **85%** (wg rodzaju inwestycji) |
| społeczny czynszowy | 20% | 35% |
| pustostany (remont) | — | 80% |

Dodatkowo (gdy efektywność energetyczna): FEnIKS +22%, OZE/ciepłownictwo +4,5%.
BSK **niedostępny bez roli/współpracy gminy** (grant idzie przez gminę); dla SIM
prywatnego/spółdzielni „trudno dostępny" (realistyczna dolna granica).

**Reżim przyszły (program 2027+), instrument NOWY_GRANT:**

| Kategoria zasobu | Grant |
|---|---|
| społeczny czynszowy | 20% |
| spółdzielczy lokatorski | 15% |
| komunalny | base 60%, **max 80%** (max wymaga **Lokal za Grunt** lub **ZPI**) |
| socjalny | max 80% (tbc) |

### 6.5. Kredyt i partycypacja per reżim

| Parametr | Obecny (SBC) | Przyszły (BGK) | Upside UE |
|---|---|---|---|
| Oprocentowanie | 2–4% (zmienne, WIBOR+dopłata) | 1–2% (stałe) | ~2% |
| Okres | 30 lat | **50 lat** | 50 lat |
| Max udział CAPEX | 80% | 70–80% (tbc) | 80% |
| Prowizja | 0,75% | 0,75% | 0,75% |
| Max grant | 35% | 15% | 30% |

**Partycypacja najemcy** (z `resource_types`): społeczny czynszowy — obecny max
**30%**, przyszły max **10%** (0% dla najemców <35 lat); spółdzielczy lokatorski
20–40%; socjalny/komunalny **0%**. Gwarancja InvestEU (nowe podmioty, reżim
obecny) → kredyt ≤ 70% CAPEX, pokrycie 30%.

**Reżim domyślny:** B (program 2027+). Wydłużenie okresu do 50 lat radykalnie
obniża ratę → większa zdolność kredytowa przy tym samym czynszu.

### 6.6. Formy współpracy z gminą (odblokowują granty, NIE zmieniają montażu bazowego)
Lokal za Grunt (ustawa 16.12.2020) i ZPI (od 2023) → warunek maksymalnego grantu
komunalnego (80%) w reżimie przyszłym. Aport gruntu → grunt poza bazą finansowania.
Filtrowane per podmiot bez wpływu na sam silnik montażu.

---

## 7. Wartość odtworzeniowa (WO) — warstwa danych

WO/m² (obwieszczenia wojewodów, okres 1.04–30.09.2026) jest **wspólnym parametrem**
dla trzech miejsc: progi dochodowe M1, pułap czynszu M3, inicjalizacja suwaka
kosztu. Miasta wydzielone mają własną, wyższą stawkę; reszta województwa —
stawkę wojewódzką; brak wpisu → benchmark rynkowy. Przykłady: Katowice 7902,
Rzeszów 8935 zł/m² (reszta śląskie 7054, podkarpackie 7170).

---

## 8. Zbiorcze zestawienie progów pasm (werdykty)

| Werdykt | Zielony („Nadaje się") | Żółty („Warunkowo") | Czerwony |
|---|---|---|---|
| M1 popyt (4 kafle) | ≥ 65 | 40–64 | < 40 |
| M2 przydatność (per profil) | ≥ 65 | 40–64 | < 40 |
| (Scoring legacy W1–W5) | ≥ 70 | 45–69 | < 45 |

---

## 9. Pytania kalibracyjne do eksperta

Miejsca, w których ocena merytoryczna jest najbardziej potrzebna:

**M1 — popyt**
- **K1.** Progi dochodowe jako *mnożnik WO/m²* (0,5 i 1,4) oraz σ=0,6 rozkładu
  log-normal — czy to poprawne proxy podziału K/S/R? Czy nie należy kotwiczyć
  progów wprost w dochodzie gospodarstwa (np. z GUS powiatowego), a WO zostawić
  tylko czynszowi?
- **K2.** Atrakcyjność migracyjna: benchmark napływu 20/1000 i odpływu 15/1000,
  wagi A2/A3 (0,6 / 0,4), „brama" 0,7/0,3 — czy skala i bramkowanie estymatów są
  realistyczne?
- **K3.** Wagi wewnętrzny/zewnętrzny (młodzi 0,55/0,45; seniorzy 0,85/0,15) —
  czy udział migracji dla młodych (45%) nie jest za wysoki?
- **K4.** `margines` = 5 kwalifikujących na 1 mieszkanie jako „pełna
  wystarczalność" — kalibracja?
- **K5.** Mediana komunalna 8/1000 i kara „pułapki senioralnej" ×0,7 — progi?

**M1 — bramka wielkości**
- **K6.** Progi opłacalności 20 (niska) / 40 (wysoka) lokali oraz min. szerokość
  6 m i próg scalenia 500 m² — zgodne z praktyką inwestycyjną SIM?

**M2 — kanały**
- **K7.** Progi dyskwalifikacji usług (POZ 5000 m, apteka 3500 m, szkoła 8000 m…)
  — czy odległości „bramkujące" są poprawne dla seniorów/rodzin?
- **K8.** Waga kanału B (koszt uzbrojenia) jako maks. 30% wyniku (`0,7 + 0,3×B`)
  oraz kary (sieć −(odl−500)/20 do −45; spadek −(s−8)×2 do −25) — proporcje?
- **K9.** Pierścienie aglomeracji (rdzeń/zasięg/siła klas A–D) i amplitudy
  profilu (młodzi ±0,40) — kalibracja zasięgów [km]?
- **K10.** Bonusy transport (+10%) / otoczenie (+6%) — rzędy wielkości?

**M3 — finanse**
- **K11.** Pułap czynszu 5% WO/rok, bufor DSCR 12,5%, pustostany 5% — zgodne
  z realiami SIM/TBS?
- **K12.** Rozdział strumieni (operacyjny poza zdolnością kredytową) — czy to
  poprawne założenie kredytowe, czy zbyt optymistyczne?
- **K13.** Proxy uzbrojenia (50 000 + 800 zł/m przyłącza), projekt 8%, rezerwa 5%
  — kalibracja?
- **K14.** Tabele grantów wg zasobu (komunalny obecny 50–85%, przyszły 60–80%;
  społeczny 20–35% / 20%) — zgodność z aktualnym stanem prawnym i praktyką BGK?
- **K15.** Domyślny reżim B (2027+, wiele parametrów `tbc`) — czy nie prezentować
  domyślnie reżimu obecnego (pewniejsze dane), a przyszły jako scenariusz?

---

*Dokument wygenerowany na podstawie stanu kodu w gałęzi produkcyjnej. Wszystkie
parametry są edytowalne w `src/lib/config.ts` oraz
`src/lib/finanse/parametry_finansowania.json`.*
