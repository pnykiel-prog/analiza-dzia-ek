# Poziom 1 — pełny system scoringu (szybki przesiew)

Cel: na podstawie samego identyfikatora działki, wyłącznie z danych automatycznych, w kilka sekund zwrócić werdykt **dla dwóch profili osobno** (budownictwo dla młodych / senioralne) wraz z listą flag i wskaźnikiem pewności. Wynik stanowi wsad do Poziomu 2.

---

## 1. Zasady ogólne

1. **Bramki przed punktacją.** Najpierw warstwa twardych wykluczeń (Warstwa 0). Punktacja liczona jest tylko dla działek, które przeszły bramki.
2. **Dwa wyniki, nie jeden.** Liczymy `score_młodzi` i `score_seniorzy` osobno (te same wymiary, inne wagi). Profil rekomendowany wynika z porównania.
3. **Brak danych ≠ „nie".** Każda brakująca dana → traktowana jako neutralna (mediana) w punktacji, a bramka z brakiem danych → status „do weryfikacji", nigdy „wykluczone". Braki obniżają tylko **wskaźnik pewności**.
4. **Wszystkie progi są kalibrowalne.** Liczby poniżej to punkty startowe do strojenia na danych, nie wartości ostateczne.
5. **Skala.** Każda metryka → 0–100. Wymiar = średnia ważona swoich metryk. Wynik profilu = średnia ważona wymiarów (0–100).

---

## 2. Warstwa 0 — bramki (twarde wykluczenia)

| Bramka | Źródło | Wynik gdy spełniona | Gdy brak danych |
|---|---|---|---|
| Brak dostępu do drogi publicznej | BDOT10k / OSM | warunkowo (możliwa służebność) | do weryfikacji |
| Obszar szczególnego zagrożenia powodzią | ISOK / Hydroportal | fail / warunkowo | do weryfikacji |
| Grunt leśny (Ls) lub rolny kl. I–III bez przeznaczenia budowlanego | EGiB | warunkowo (odrolnienie/odlesienie) | do weryfikacji |
| Rezerwat / park narodowy / wykluczająca forma ochrony | GDOŚ Geoserwis | fail | do weryfikacji |
| Natura 2000 | GDOŚ Geoserwis | warunkowo (flaga) | do weryfikacji |
| Teren górniczy / osuwisko (SOPO) | MIDAS / SOPO | warunkowo (flaga) | do weryfikacji |
| Przeznaczenie w MPZP / planie ogólnym sprzeczne z funkcją mieszkaniową | KIMPZP / Rejestr Urbanistyczny | fail | **do weryfikacji** (biała plama ≠ wykluczenie) |

**Reguła werdyktu z bramek:**
- jakikolwiek `fail` → werdykt końcowy „czerwony / wykluczone" (punktacji nie liczymy),
- jakikolwiek `warunkowo` → werdykt ograniczony maksymalnie do „żółty / warunkowo" + flaga,
- same „do weryfikacji" → punktujemy normalnie, ale obniżamy pewność.

---

## 3. Pięć wymiarów oceny (W1–W5)

### W1 — Dopuszczalność i otoczenie planistyczne
Miękka część tego, co nie jest twardą bramką.

| Metryka | Punktacja (start) | Źródło |
|---|---|---|
| Status planistyczny | MPZP mieszkaniowy = 100 · plan ogólny/OUZ sprzyjający = 75 · brak danych = 50 (neutralnie) | KIMPZP / Rejestr Urbanistyczny |
| Spójność z zabudową sąsiedztwa (warunek „dobrego sąsiedztwa" dla WZ) | zabudowa mieszkaniowa w sąsiedztwie = 100 · brak = 30 | BDOT10k / EGiB |

### W2 — Popyt demograficzny (różnicuje profile)
Uwaga interpretacyjna: wysoki udział 65+ sam w sobie bywa objawem wyludniania (źle), a nie szansy. Dlatego popyt senioralny punktujemy jako **rosnącą lub dużą populację 65+ w gminie, która jednocześnie nie wymiera**; popyt „dla młodych" — jako **napływ młodych + rynek pracy**.

| Metryka | Profil | Punktacja (start) | Źródło |
|---|---|---|---|
| Udział 20–39 lat vs mediana woj./kraju | młodzi | powyżej mediany = 100, poniżej = liniowo w dół | GUS BDL |
| Saldo migracji (szczególnie 25–39) | młodzi | dodatnie = 100 · zero = 55 · ujemne = 20 | GUS BDL |
| Udział 65+ i jego trend | seniorzy | rosnący udział przy stabilnej populacji = 100 · rosnący przy wyludnianiu = 50 | GUS BDL |
| Trend liczby ludności (5–10 lat) | wspólna | rosnąca = 100 · stabilna = 65 · malejąca = 30 | GUS BDL |
| Rynek pracy (bezrobocie, podmioty gosp.) w zasięgu dojazdu | młodzi | niskie bezrobocie / wiele firm = wyżej | GUS BDL |

### W3 — Dostępność komunikacyjna (sub-metryki różne dla profili)

| Metryka | Profil | Punktacja (start) | Źródło |
|---|---|---|---|
| Czas dojazdu do centrum najbliższej aglomeracji | młodzi (wysoka waga) | ≤30 min = 100 · 30–45 = 70 · 45–60 = 40 · >60 = 15 | routing na OSM |
| Najbliższy przystanek z sensowną częstotliwością (≥X kursów/dobę, ≤800 m) | młodzi | jest = 100 · brak = 25 | GTFS / OSM |
| Bliskość istniejącej, uzbrojonej tkanki z usługami podstawowymi (pieszo) | seniorzy (wysoka waga) | w zasięgu spaceru = 100 · izolacja = 20 | OSM / BDOT10k |

### W4 — Teren i proxy kosztów uzbrojenia

| Metryka | Profil | Punktacja (start) | Źródło |
|---|---|---|---|
| Średni spadek terenu | wspólna; **silniej karze profil senioralny** | <3% = 100 · 3–8% = 75 · 8–12% = 45 · >12% = 20 | NMT |
| Odległość do istniejącej zabudowy/sieci (proxy kosztu przyłączy) | wspólna | w tkance = 100 · 100–300 m = 70 · 300–500 m = 40 · >500 m = 15 | BDOT10k / OSM |
| Powierzchnia/kształt — czy mieści sensowny program wielorodzinny | wspólna | tak = 100 · graniczna = 50 · za mała = 20 | ULDK / EGiB |

### W5 — Luka dostępności cenowej / ekonomia SIM
Liczymy dwa sygnały. Wymaga: wartości odtworzeniowej (wojewoda/BGK), czynszu rynkowego /m², ceny nowych lokali /m².

**Pułap czynszu SIM** = wartość odtworzeniowa /m² × 5% ÷ 12 (lub 4% dla kredytu BGK).

| Sygnał | Definicja | Punktacja (start) | Rola |
|---|---|---|---|
| **Luka najemcy** | (czynsz rynkowy − pułap SIM) / czynsz rynkowy | ≥45% = 100 · 30–45% = 80 · 15–30% = 55 · 5–15% = 30 · <5% = 10 | **pozytywny** — większa luka = większa wartość społeczna i popyt |
| **Wymagana dotacja (wykonalność)** | proxy: (lokalna cena budowy/nabycia /m² + wykończenie) / wartość odtworzeniowa /m² | ≤110% = 100 · 110–130% = 70 · 130–160% = 40 · >160% = 15 | **dampener/flaga** — wysoki koszt vs niski pułap = czynsz objęty limitem nie pokryje inwestycji, potrzebna duża dotacja |

Wynik W5 = średnia ważona obu sygnałów (np. 60% luka najemcy / 40% wykonalność). Gdy „wymagana dotacja" wpada w >160% → dodatkowo flaga „wysoka dotacja / ryzyko rentowności" i obniżenie werdyktu o jeden poziom.

Korekta wykończenia: ceny nowych mieszkań podawaj w stanie deweloperskim + dolicz wykończenie (≈1 000–2 500 zł/m²), bo SIM oddaje lokal pod klucz — dopiero wtedy porównanie jest „jak z jak".

---

## 4. Wagi wymiarów per profil

| Wymiar | Waga — młodzi | Waga — seniorzy |
|---|---|---|
| W1 Dopuszczalność/planistyka | 10 | 10 |
| W2 Popyt demograficzny | 20 | 25 |
| W3 Dostępność komunikacyjna | 25 | 15 |
| W4 Teren i koszty | 15 | 20 |
| W5 Luka cenowa / ekonomia | 30 | 30 |
| **Suma** | **100** | **100** |

Logika: dla młodych decyduje dojazd do pracy (W3) i przystępność cenowa (W5); dla seniorów rośnie znaczenie terenu/dostępności bez barier (W4) i samego rozmiaru populacji 65+ (W2), a maleje waga dojazdu do aglomeracji.

---

## 5. Agregacja, werdykt i pewność

**Wynik profilu** = Σ(waga_wymiaru × wynik_wymiaru) ÷ 100 → skala 0–100.

**Pasma werdyktu (per profil, kalibrowalne):**
- ≥ 70 → zielony
- 45–69 → żółty
- < 45 → czerwony

**Nałożenie bramek:** `fail` → czerwony niezależnie od punktów; `warunkowo` → maksymalnie żółty.

**Profil rekomendowany:**
- `max(score_młodzi, score_seniorzy)` wyznacza kierunek,
- „oba" gdy obydwa ≥ próg zielony i różnią się ≤10 pkt,
- „żaden" gdy obydwa < próg czerwony.

**Wskaźnik pewności** = udział wymiarów/bramek opartych na realnych danych (a nie na medianie z braku). Niski wskaźnik → werdykt prezentowany jako „wstępny, do potwierdzenia w Poziomie 2". To zabezpiecza przed fałszywym „nie" przy białych plamach (zwłaszcza planistycznych i przy lokalnym czynszu rynkowym).

---

## 6. Schemat wyniku (wejście do Poziomu 2)

Poziom 1 zwraca obiekt, z którego korzysta Poziom 2 (nie zaczyna od zera):

```
{
  dzialka_id,
  bramki: { status: pass|warunkowo|fail, flagi: [...] },
  score_mlodzi: 0-100,
  score_seniorzy: 0-100,
  profil_rekomendowany: mlodzi|seniorzy|oba|zaden,
  werdykt: zielony|zolty|czerwony,
  pewnosc: 0-100,
  kluczowe_liczby: {
    pulap_czynszu_SIM_m2,
    czynsz_rynkowy_m2,
    luka_najemcy_pct,
    relacja_koszt_do_wart_odtworzeniowej_pct,
    czas_dojazdu_aglomeracja_min,
    sredni_spadek_pct
  },
  flagi: [ ... ]   // np. "Natura 2000", "wysoka dotacja", "biała plama planistyczna"
}
```

---

## 7. Przykład poglądowy

Działka pod miastem wojewódzkim, w OUZ, z dostępem do drogi, spadek 4%, 35 min do centrum aglomeracji, gmina z dodatnim saldem migracji młodych, wartość odtworzeniowa 7 766 zł/m² → pułap SIM ≈ 32 zł/m²; czynsz rynkowy ≈ 60 zł/m² → luka najemcy ≈ 47% (100 pkt). Cena budowy z wykończeniem ≈ 9 500 zł/m² ÷ 7 766 ≈ 122% (70 pkt) → W5 ≈ 88.

Wynik młodzi (W3, W5 wysokie) → zielony; seniorzy nieco niżej (dojazd mniej istotny, ale brak silnej populacji 65+) → żółty. Profil rekomendowany: młodzi.

---

## 8. Uwagi do kalibracji

- **Najsłabsze ogniwo to lokalny czynsz rynkowy** (W5) — w mniejszych miejscowościach ogłoszeń bywa za mało. Tam W5 liczymy z obniżoną pewnością, a lukę oznaczamy jako szacunkową.
- **Interakcja W2×W5** jest celowa: napływ młodych + duża luka cenowa to najmocniejszy łączny sygnał „za" budownictwem dla młodych. Po kalibracji warto rozważyć premię za współwystępowanie.
- **Progi i wagi** należy nastroić na zbiorze działek z znanym wynikiem (gdzie SIM/inwestycje społeczne powstały i się powiodły lub nie).
- Wartość odtworzeniowa, dochody i demografia są w pełni automatyzowalne i wiarygodne — to stabilny rdzeń, na którym można oprzeć werdykt nawet przy brakach w pozostałych danych.
