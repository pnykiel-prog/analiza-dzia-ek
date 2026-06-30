# Model ekonomiczny SIM — Poziom 2 (pełny)

Cel: dla rekomendowanego programu zabudowy policzyć, czy inwestycja w formule SIM **domyka się finansowo** przy czynszu nieprzekraczającym ustawowego pułapu, a jeśli nie — ile dotacji/partycypacji wymaga. Model łączy się z rekomendacją zabudowy (liczba mieszkań, PUM, koszt) i z modułem cenowym Poziomu 1 (pułap czynszu, czynsz rynkowy).

> **Uwaga o zmienności:** wszystkie parametry programów (procenty grantu, max udział kredytu, oprocentowanie, okres) są **parametryzowane**, nie zaszyte na sztywno — rozporządzenia do programu SBC zmieniają się corocznie. Wartości startowe poniżej odpowiadają stanowi na 2026 r.

---

## 1. Parametry programowe (stan 2026, parametryzowane)

| Parametr | Wartość startowa | Uwaga |
|---|---|---|
| Max udział kredytu zwrotnego BGK (SBC) | do 80% kosztu przedsięwzięcia | reszta = montaż własny inwestora |
| Oprocentowanie kredytu | WIBOR 3M bez marży; **stabilizacja 2,00%/rok** (umowy po 15.06.2022) | min. 0% |
| Prowizja za udzielenie | 0,75% kwoty kredytu, jednorazowo | |
| Okres kredytu | długoterminowy (do ~30 lat) | wpływa wprost na ratę |
| Grant z Funduszu Dopłat — SIM na wynajem (niezwiększające zasobu gminy) | do 35% kosztów przedsięwzięcia | wypłata z góry, nie refundacja |
| Grant z Funduszu Dopłat — mieszkania komunalne | do 80% | dla wariantu komunalnego (np. najubożsi seniorzy) |
| Partycypacja najemcy | ≤ 30% kosztu budowy lokalu | zwrotna, waloryzowana; próg 20%/25% → najem z dojściem do własności |
| RFRM (wkład gminy na udziały) | **zlikwidowany 20.12.2024** | pole parametryczne na wypadek reaktywacji |
| Pułap czynszu | 5%/rok wartości odtworzeniowej (4% dla starszych kredytów) | + do 1%/rok na wybrane koszty utrzymania |
| Standard energetyczny (warunek grantów KPO) | EP ≤ 52 kWh/(m²·rok), reguła DNSH | dla finansowania z KPO |
| Blokada zbycia/zmiany przeznaczenia | 25 lat od rozliczenia | ograniczenie prawne |

---

## 2. Koszt przedsięwzięcia (wejścia)

```
koszt przedsięwzięcia =
    grunt (lub wkład aportem gminy/KZN)
  + budowa (pod klucz — patrz korekta wykończenia)
  + uzbrojenie terenu
  + koszty projektowe i przygotowawcze
  + koszty finansowe okresu budowy (prowizja 0,75% + odsetki)
  + rezerwa na ryzyko
```

Źródła: budowa/grunt z rekomendacji zabudowy i modułu cenowego; uzbrojenie z proxy/gestorów (Poziom 2); rezerwa jako % (parametr).

---

## 3. Montaż finansowy (źródła pokrycia kosztu)

Struktura, która musi zsumować się do 100% kosztu i respektować limity każdego źródła:

| Źródło | Limit | Charakter |
|---|---|---|
| Grant z Funduszu Dopłat | do 35% (SIM) / 80% (komunalne) | bezzwrotny |
| Kredyt zwrotny BGK | do 80% kosztu | zwrotny, ~2% |
| Partycypacja najemców | ≤ 30% kosztu lokalu | zwrotna |
| Partycypacja gminy / wkład gruntowy (gmina, KZN) | wg umowy | wkład/aport |
| Partycypacja pracodawców | wg umowy | dla lokali pracowniczych |
| Środki własne SIM | reszta | |

Reguła: `grant + kredyt + partycypacje + wkład = koszt przedsięwzięcia`. Grant obniża bazę, którą trzeba sfinansować kredytem i partycypacją.

---

## 4. Przychody i koszty operacyjne (rocznie)

**Przychód z czynszu** (ograniczony pułapem):
```
czynsz max /m²/mc = wartość odtworzeniowa /m² × 5% ÷ 12
przychód roczny    = czynsz /m²/mc × PUM × 12 × (1 − pustostany/zaległości)
```
Czynsz ustala się tak, by pokrył eksploatację + remonty + spłatę kredytu, **ale nie wyżej niż pułap**. To jest sedno napięcia: jeśli koszty obsługi przewyższają pułap, luki nie zamknie czynsz — tylko grant/partycypacja/niższy koszt.

**Koszty operacyjne:** eksploatacja, fundusz remontowy, zarząd, podatek od nieruchomości, ubezpieczenie. (Część kosztów utrzymania można pokryć dodatkową opłatą do 1%/rok wartości odtworzeniowej.)

---

## 5. Obsługa długu i wykonalność

```
rata roczna kredytu = annuita( kwota kredytu ; oprocentowanie ; okres )
DSCR = (przychód z czynszu − koszty operacyjne) / rata roczna kredytu
```

- **DSCR ≥ 1** → inwestycja obsługuje dług przy danym czynszie.
- **DSCR < 1 przy czynszie = pułap** → potrzebny większy grant, większa partycypacja, niższy koszt lub dłuższy okres. To wprost wylicza **wymaganą dotację**.

---

## 6. Domknięcie i wymagana dotacja (główny wynik)

Algorytm:
1. Policz koszt przedsięwzięcia i pułap czynszu.
2. Ustaw czynsz = min(czynsz pokrywający koszty; pułap).
3. Przy maksymalnym dopuszczalnym kredycie policz DSCR.
4. Jeśli DSCR < 1 → zwiększaj grant (do 35%) i partycypację (do limitów), aż DSCR ≥ 1.
5. Wynik: **minimalny montaż dotacji/partycypacji**, przy którym inwestycja się spina — albo komunikat „niewykonalne w obecnych limitach".

```
wymagana dotacja = koszt przedsięwzięcia − (max kredyt obsługiwalny czynszem ≤ pułap + dostępne partycypacje)
```

---

## 7. Wskaźniki wynikowe

| Wskaźnik | Znaczenie |
|---|---|
| Czynsz wynikowy /m² vs pułap vs rynek | spięcie z Poziomem 1 (W5) — ile poniżej rynku |
| DSCR | wykonalność obsługi długu |
| Struktura montażu (% grant / kredyt / partycypacja) | jak finansowana inwestycja |
| Wymagana partycypacja gminy / dotacja | obciążenie sektora publicznego |
| Czynsz vs zdolność czynszowa grupy docelowej (dochody GUS) | dostępność dla najemcy |
| Okres zwrotu / NPV społeczny | opcjonalnie, dla porównania wariantów |

**Analiza wrażliwości** (obowiązkowa na Poziomie 2): zmiana oprocentowania, kosztu budowy, poziomu pustostanów, wartości odtworzeniowej i % grantu — pokazuje, jak krucha lub odporna jest rentowność.

---

## 8. Przykład poglądowy (ilustracja napięcia)

Program: 40 mieszkań, PUM 2 000 m², budowa pod klucz 9 500 zł/m² → ~19 mln; grunt + uzbrojenie + projekt + koszty finansowe ~4 mln → **koszt ~23 mln**.

- Grant 35% → ~8,05 mln.
- Kredyt np. 55% → ~12,65 mln; rata @2%/30 lat ≈ 560 tys./rok ≈ ~23 zł/m²/mc.
- Eksploatacja + remonty ~11 zł/m²/mc → koszt łączny ~34 zł/m²/mc.
- Pułap (wartość odtworzeniowa 7 766 zł/m² × 5% ÷ 12) ≈ **32,4 zł/m²/mc**.

Wniosek: przy tym montażu koszt obsługi (~34) lekko przekracza pułap (~32) → DSCR < 1. Domknięcie wymaga **podniesienia grantu/partycypacji** (np. partycypacja najemców 15% obniża kredyt i ratę poniżej pułapu) albo obniżenia kosztu budowy. To dokładnie ten sygnał, który Poziom 1 zapowiadał flagą „wysoka dotacja".

---

## 9. Dane wejściowe i automatyzacja

| Wejście | Źródło | Pozyskanie |
|---|---|---|
| Parametry programów (grant, kredyt, oprocentowanie) | BGK / rozporządzenia | 🟡 (tabela do utrzymania, zmiany coroczne) |
| Wartość odtworzeniowa | wojewoda / BGK | 🟡 → 🟢 |
| Koszt budowy, grunt, uzbrojenie | rekomendacja zabudowy / gestorzy / użytkownik | 🔴/🟡 |
| Dochody grupy docelowej (zdolność czynszowa) | GUS BDL | 🟢 |
| Czynsz rynkowy (odniesienie) | portale / dane komercyjne | 🟡/🔴 |
| Założenia montażu (okres, pustostany, rezerwa) | użytkownik | 🔴 |

---

## 10. Uwagi i ryzyka

- **RFRM zlikwidowany (12.2024)** — wkład gminy na udziały trzeba dziś sfinansować inaczej (środki własne, grant). Pole zostawione parametrycznie.
- **Coroczna zmienność rozporządzeń SBC** — model musi czytać parametry z konfiguracji, nie z kodu. Program SBC przedłużono do 2026 r.; edycje naboru: marzec i wrzesień.
- **Termin KPO 31.08.2026** dla części finansowania — wpływa na harmonogram, jeśli źródłem jest KPO (wymóg DNSH, EP ≤ 52).
- **Blokada 25 lat** i zwrotność partycypacji to zobowiązania, nie wolne środki — ważne przy ocenie ryzyka gminy.
- **Stabilizacja 2%** dotyczy umów po 15.06.2022; dla scenariuszy „co jeśli stopa wzrośnie" i tak warto liczyć wrażliwość bez stabilizacji.
- Model jest **wstępnym studium wykonalności**, nie wnioskiem kredytowym — finalne warunki ustala BGK w naborze.
