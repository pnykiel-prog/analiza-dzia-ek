# Rekomendacja modelu zabudowy — specyfikacja modułu

Cel: dla działki, która przeszła analizę, zaproponować **korzystny model zabudowy** w 1–3 wariantach — z parametrami liczbowymi, uzasadnieniem dopasowania do profilu i flagami ryzyka. To rekomendacja parametryczna (wsad do projektu koncepcyjnego), a nie projekt architektoniczny.

Zasada nadrzędna: model jest **wyprowadzany**, nie wymyślany. Najpierw twarda obwiednia (ile wolno i co się zmieści), potem dopasowanie do profilu (młodzi / seniorzy).

---

## 1. Wejścia

| Grupa | Konkretne dane | Skąd |
|---|---|---|
| Ograniczenia planistyczne | wsk. intensywności zabudowy, max wysokość/kondygnacje, max pow. zabudowy, min pow. biologicznie czynna (PBC), linie zabudowy, wymagane miejsca parkingowe, dopuszczalny udział usług | MPZP / plan ogólny (Poziom 2) |
| Działka | powierzchnia, kształt/proporcje, front, spadek | ULDK / NMT |
| Profil | młodzi / seniorzy / oba | Poziom 1 |
| Kontekst | typologia i wysokość zabudowy sąsiedztwa, transport, usługi | BDOT10k / OSM |
| Ekonomia | pułap czynszu SIM, dostępny budżet/dotacja | moduł cenowy (Poziom 2) |

---

## 2. Krok 1 — obwiednia zabudowy

Formuły (z parametrów planistycznych):

```
max pow. zabudowy        = pow. działki × wsk. powierzchni zabudowy
pow. całkowita nadziemna = pow. działki × wsk. intensywności zabudowy
PUM (pow. użytkowa mieszk.) ≈ pow. całkowita × współczynnik efektywności (0,75–0,85)
max liczba kondygnacji   = min( z wysokości , z intensywności / pow. zabudowy )
```

Ograniczenia dodatkowe:
- **PBC** ogranicza sumę zabudowy + parkingu naziemnego → przy wysokim wymaganym PBC parking schodzi pod ziemię (istotny koszt — flaga).
- **Kształt/spadek**: wąska lub skośna działka obniża efektywność rzutu; spadek >8–12% wymusza tarasowanie/podpiwniczenie (koszt — flaga).
- **Linie zabudowy i front** wyznaczają realny obrys.

**Fallback bez MPZP (biała plama):** wskaźniki szacujemy z analizy sąsiedztwa — średnia wysokość i intensywność zabudowy w otoczeniu (logika „dobrego sąsiedztwa" z WZ). Wynik oznaczamy obniżoną pewnością.

---

## 3. Krok 2 — dobór typologii

| Typologia | Kiedy pasuje | Uwagi |
|---|---|---|
| Niska wielorodzinna (3–4 kond.) | niska/średnia intensywność, mniejsze miasta, oba profile | dla seniorów winda wymagana mimo niskiej zabudowy |
| Średniowysoka wielorodzinna (5–8 kond., winda) | wyższa intensywność, obrzeża aglomeracji | sprzyja profilowi „młodzi" (gęstość, dojazd) |
| Pierzejowa/kwartałowa z parterem usługowym (mixed-use) | tkanka miejska, dobry transport | „młodzi"; parter usług ożywia i poprawia ekonomię |
| Punktowiec vs klatkowy/galeriowiec | wybór układu komunikacji | punktowiec = mniej mieszkań/klatkę, ale elastyczny; galeriowiec sprzyja dostępności (seniorzy) |
| Senioralna / wspomagana | profil senioralny | pełna dostępność bez barier, parter usług opiekuńczych, świetlica; zawsze winda |

Wybór: typologia musi mieścić się w obwiedni (kondygnacje, intensywność) **i** pasować do profilu oraz skali sąsiedztwa (konflikt skali → flaga).

---

## 4. Krok 3 — program pod profil

| Aspekt | Młodzi | Seniorzy |
|---|---|---|
| Struktura metraży | kawalerki 25–35 m² (duży udział), 2-pok 40–50 m², część 3-pok | 1-pok 35–45 m², 2-pok 45–55 m²; bez małych kawalerek |
| Intensywność | wyższa | umiarkowana |
| Winda | wg wysokości | **zawsze**, niezależnie od wysokości |
| Dostępność | standardowa | bez progów, szerokie drzwi/korytarze, łazienki dostosowane, dojścia bez barier |
| Parking | obniżony przy dobrym transporcie (0,5–1/lokal) + rowerownia | dla opiekunów/służb, dojazd karetki, miejsca przy wejściu |
| Przestrzenie wspólne | coworking, rowerownia, pralnia | świetlica/jadalnia, gabinet opieki/pielęgniarki |
| Parter | usługi/handel | usługi opiekuńcze, ewentualnie POZ |
| Otoczenie | place, mała architektura | zieleń, ławki, cisza, bliskość POZ |
| Opcje | elastyczne układy | mieszkania wspomagane |

```
liczba mieszkań ≈ (PUM − pow. wspólne/usługowe) / średni metraż profilu
```

Dla profilu „oba" generujemy warianty pod oba profile i pokazujemy różnice (typowo: dla młodych więcej, mniejszych mieszkań i wyższa intensywność; dla seniorów mniej, większych, z pełną dostępnością).

---

## 5. Krok 4 — wynik i flagi

**Warianty (1–3):** np. „maks. liczba mieszkań" / „zrównoważony z parterem usługowym" / „senioralny w pełni dostępny". Każdy z parametrami: liczba kondygnacji, pow. zabudowy, PUM, liczba mieszkań, mix metraży, miejsca parkingowe (+ podziemny tak/nie), pow. wspólne/usługowe.

**Flagi ryzyka:**
- wysokie PBC wymusza parking podziemny (koszt),
- działka zbyt mała na efektywny budynek z windą,
- spadek wymusza tarasowanie/podpiwniczenie,
- konflikt skali z sąsiedztwem,
- brak MPZP → obwiednia z sąsiedztwa, niska pewność,
- wysoka wymagana dotacja (z modułu cenowego W5).

**Spięcie z ekonomią:** liczba mieszkań × przewidywany czynsz SIM vs koszt budowy → czy program domyka się finansowo (i ile partycypacji/grantu wymaga). To łączy rekomendację z modułem cenowym Poziomu 2.

---

## 6. Dane i automatyzacja

| Wejście | Źródło | Pozyskanie |
|---|---|---|
| Wskaźniki planistyczne | MPZP / plan ogólny | 🟡 (lub 🟢 fallback z BDOT) |
| Obwiednia z sąsiedztwa (brak MPZP) | BDOT10k (wysokości budynków) | 🟢 |
| Geometria/kształt/spadek działki | ULDK / NMT | 🟢 |
| Profil | Poziom 1 | 🟢 |
| Metraże, efektywność, normatyw parkingowy | założenia/kalibracja | 🔴 |
| Koszt budowy, dotacja | moduł cenowy / użytkownik | 🔴 |

---

## 7. Uwagi do kalibracji

- Współczynnik efektywności (0,75–0,85), metraże i normatyw parkingowy są kalibrowalne — wpływają wprost na szacowaną liczbę mieszkań.
- To rekomendacja parametryczna: zastępuje wstępne „czucie" liczbami wyjściowymi i ramą wariantów, ale projekt koncepcyjny pozostaje po stronie architekta.
- Najwięcej wartości moduł daje w fallbacku bez MPZP — pokazuje realną obwiednię tam, gdzie inwestor musiałby inaczej czekać na wypis/wyrys; dlatego warto zadbać o jakość analizy sąsiedztwa.
