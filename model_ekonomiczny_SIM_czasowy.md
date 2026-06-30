# Model ekonomiczny SIM — ujęcie czasowe i reżimowe (aktualizacja podejścia)

Ten dokument **zmienia metodę** liczenia z poprzedniej wersji. Powód: działka analizowana dziś nie wejdzie w budowę wcześniej niż za 12–18 miesięcy (projekt, decyzje planistyczne, PnB, nabór finansowania), a oddanie nastąpi za 3–4 lata. Do tego czasu zmienią się: program finansowania, wartość odtworzeniowa (podstawa pułapu czynszu), koszty budowy i stopy. **Liczenie na dzisiejszych parametrach zafałszowuje wynik.**

Zasada nadrzędna (nowa): wszystkie parametry i wartości liczymy na **datę naboru finansowania / startu budowy i oddania**, a nie na dzień analizy.

---

## 1. Co się zmienia względem poprzedniej wersji

| Element | Poprzednio | Teraz |
|---|---|---|
| Reżim finansowania | parametry „na dziś" (SBC 2026) | parametry z **momentu realizacji** (program 2027+) |
| Czas | pomijany | jawna **oś czasu realizacji** wyznacza daty |
| Wartości (koszt, wart. odtworzeniowa, dochody) | dzisiejsze | **zindeksowane** do dat budowy/oddania |
| Wynik | punktowy | **scenariuszowy** (reżim × stopa × indeksacja) |

---

## 2. Kontekst regulacyjny horyzontu realizacji

- **Obecny program SBC kończy się w 2026 r.** — jesienna edycja 2026 jest ostatnią w dotychczasowej formule.
- **Od 2027 r. planowany jest nowy program** wspierania społecznego budownictwa czynszowego (opracowywany przez MRiT z BGK).
- **Sygnalizowane kontury nowego reżimu** (na razie najpełniej opisane dla spółdzielni; dla SIM do potwierdzenia): bezzwrotny grant rzędu **15%**, kredyt **~2%**, okres do **50 lat**, czynsz celowany **15–30 zł/m²**, dodatkowo ścieżka „społecznego budownictwa własnościowego".
- **Horyzont unijny**: plan „Cztery Ściany" (>400 mld € na 2026–2029) jako potencjalne dodatkowe granty/gwarancje.

**Kluczowa obserwacja:** nowy reżim jest prawdopodobnie **korzystniejszy** — wydłużenie okresu kredytu z 30 do 50 lat radykalnie obniża ratę roczną i poprawia DSCR. Inwestycje, które przy 30 latach się nie spinają, w nowym reżimie mogą się domknąć.

---

## 3. Oś czasu realizacji (nowy, pierwszoplanowy element modelu)

Parametryzowane fazy wyznaczają `datę_startu_budowy` i `datę_oddania`:

| Faza | Czas (parametr) | Uwaga |
|---|---|---|
| Nabycie + analiza (T0) | 0 | dziś |
| Projekt + decyzje planistyczne + PnB | ~6–12 mies | zależne od MPZP/planu ogólnego vs WZ |
| Nabór i umowa finansowania | ~3–6 mies | edycje BGK; w nowym programie zasady do potwierdzenia |
| Budowa | ~18–30 mies | |
| Oddanie + rozliczenie | — | start eksploatacji |

Bufor prawny obecnego finansowania: rozpoczęcie inwestycji ≤3 lata od wniosku, wypłata kredytu ≤36 mies — ale **forma programu i tak zmienia się od 2027**, więc to nie zwalnia z liczenia na nowy reżim.

---

## 4. Wybór reżimu „as-of" (scenariusze)

Model dobiera scenariusz wg `daty_startu` i pozwala je porównać:

| Scenariusz | Kiedy | Parametry (startowe, parametryzowane) |
|---|---|---|
| A — obecny SBC | tylko jeśli nabór do jesieni 2026 | kredyt do 80%, ~2% (60 rat), do 30 lat; grant do 35%; pułap 5% wart. odtw. |
| B — nowy program 2027+ (**domyślny**) | start 2027 i później | kredyt ~2%, okres do 50 lat; grant ~15% (do potwierdzenia dla SIM); czynsz celowany 15–30 zł/m² |
| C — upside unijny „Cztery Ściany" | 2026–2029 | dodatkowe granty/gwarancje — jako scenariusz korzystny |

Scenariusz B ma **jawną flagę niepewności** — szczegóły rozporządzeń nowego programu nie są jeszcze ostateczne.

---

## 5. Indeksacja w „czasie martwym" (lead time)

Wszystko liczone na właściwą datę, nie na dziś:

| Wielkość | Indeksowana do | Kierunek wpływu |
|---|---|---|
| Koszt budowy, grunt, uzbrojenie | data budowy | rośnie → gorzej |
| Wartość odtworzeniowa (podstawa pułapu czynszu) | data oddania/eksploatacji | rośnie → **podnosi pułap → lepiej** |
| Dochody grupy docelowej (zdolność czynszowa) | data oddania | rośnie |
| Stopa procentowa | scenariuszowo | scenariusz |

Istotna interakcja: rosnąca wartość odtworzeniowa **podnosi pułap czynszu** w momencie oddania, częściowo kompensując wzrost kosztów budowy.

---

## 6. Zmieniony algorytm domknięcia

Logika jak poprzednio (czynsz ≤ pułap, DSCR ≥ 1, wyliczenie wymaganej dotacji), ale:
1. parametry programu z **reżimu daty startu** (domyślnie scenariusz B),
2. koszty i wartości **zindeksowane** do właściwych dat,
3. rata liczona dla **okresu z nowego reżimu** (np. 50 lat) — niższa niż przy 30 latach,
4. wynik podawany jako **przedział** (konserwatywny / oczekiwany / korzystny) wg scenariusza reżimu, stopy i indeksacji.

```
wymagana dotacja(reżim, data) =
    koszt_zindeksowany
  − ( max_kredyt_obsługiwalny(czynsz ≤ pułap_zindeksowany ; okres_reżimu)
      + dostępne partycypacje + granty_reżimu )
```

---

## 7. Planistyka w tym horyzoncie (wpływ na timeline i wykonalność)

Do startu budowy reżim planistyczny będzie już „nowy": plany ogólne wiążące (po 31.08.2026), nowe WZ — ważność 5 lat, wymóg położenia w OUZ, wymóg prawa do dysponowania nieruchomością na cele budowlane. To wpływa na ścieżkę (MPZP/plan ogólny vs WZ) i może wydłużyć fazę projektową — ujmujemy jako ryzyko w osi czasu.

---

## 8. Wynik

- Werdykt ekonomiczny **z datą i scenariuszem reżimu**.
- Przedział: konserwatywny / oczekiwany / korzystny.
- Wymagana dotacja policzona w **nowym programie**, nie w obecnym.
- Wrażliwość na: wybór reżimu, okres kredytu (30 vs 50 lat), stopę, indeksację kosztów, tempo wzrostu wartości odtworzeniowej.

---

## 9. Uwagi i niepewność

- **Nie zakładać dzisiejszych liczb jako pewnych** dla inwestycji startującej w 2027+. Domyślny scenariusz to nowy program, nie SBC 2026.
- Szczegóły programu 2027 nie są jeszcze ostateczne — model pozostaje **parametryczny i scenariuszowy**, z jawną niepewnością; konfigurację aktualizujemy po publikacji rozporządzeń.
- Wydłużenie okresu kredytu i utrzymanie ~2% to najsilniejsze dźwignie poprawiające wykonalność — warto je modelować jako osobny czynnik wrażliwości.
- RFRM pozostaje zlikwidowany; ewentualny nowy instrument wkładu gminy wpisujemy, gdy się pojawi.
