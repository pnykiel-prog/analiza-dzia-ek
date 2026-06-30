# Dane wejściowe do analizy potencjału działek
### Budownictwo społeczne dla młodych i budownictwo senioralne

**Cel dokumentu:** katalog danych wejściowych potrzebnych do oceny przydatności działki, wraz ze źródłem każdej z nich oraz oznaczeniem sposobu pozyskania.

**Legenda sposobu pozyskania:**
- 🟢 **Auto** — pobieranie automatyczne przez API / usługę WMS/WFS / plik do pobrania (programowo).
- 🟡 **Pół-auto** — dostępne cyfrowo, ale wymaga ujednolicenia, mapowania ID, ręcznego dociągnięcia z gminnego źródła lub uzupełnienia braków.
- 🔴 **Ręczne** — wymaga zapytania do urzędu/gestora, danych płatnych, pomiarów w terenie albo wprowadzenia przez użytkownika.

> **Założenie projektowe:** identyfikatorem wejściowym jest numer ewidencyjny działki (TERYT + obręb + nr) lub punkt na mapie. Od niego „rozwijają się" wszystkie pozostałe zapytania przestrzenne.

---

## A. Identyfikacja i geometria działki

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Geometria, granice, powierzchnia działki | **ULDK** (Usługa Lokalizacji Działek Katastralnych, GUGiK) | 🟢 Auto | REST API; zwraca geometrię po identyfikatorze działki lub po współrzędnych. Punkt startowy całej analizy. |
| Numer ewidencyjny, obręb, gmina (TERYT) | **ULDK / EGiB** | 🟢 Auto | TERYT spina dane z GUS i innymi rejestrami. |
| Klasa użytków, kontur użytku | **EGiB** (Ewidencja Gruntów i Budynków) przez Krajową Integrację EGiB | 🟢 Auto / 🟡 | WMS krajowy; szczegółowość zależy od powiatu. Kluczowe: grunty rolne/leśne wymagają odrolnienia/odlesienia. |
| Klasa bonitacyjna gruntu | **EGiB** | 🟡 Pół-auto | Istotne dla kosztu/możliwości wyłączenia z produkcji rolnej (grunty kl. I–III). |
| Budynki istniejące na działce | **EGiB / BDOT10k** | 🟢 Auto | |

---

## B. Status planistyczny i prawny *(decyduje o samej możliwości zabudowy)*

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Miejscowy Plan Zagospodarowania Przestrzennego (MPZP) — przeznaczenie, wskaźniki | **KIMPZP** (Krajowa Integracja MPZP, GUGiK) + **Rejestr Urbanistyczny** (od 1.07.2026) | 🟡 Pół-auto | Pokrycie MPZP w Polsce niepełne (ok. 1/3 powierzchni kraju). Tam gdzie jest — daje twarde wskaźniki zabudowy. |
| Plan ogólny gminy / strefa planistyczna / OUZ | **Krajowy Rejestr Planów Ogólnych** (GUGiK) + **Rejestr Urbanistyczny** | 🟡 Pół-auto | Zastępuje studium (od 31.08.2026). Strefa planistyczna i Obszar Uzupełnienia Zabudowy decydują, czy w ogóle można uzyskać WZ. Stan wdrożenia różni się między gminami. |
| Decyzje o warunkach zabudowy (WZ) w sąsiedztwie | **Rejestr Urbanistyczny** (docelowo) / urząd gminy | 🟡 / 🔴 | Do czasu pełnego wdrożenia RU — często zapytanie do gminy. |
| Forma władania / własność, obciążenia, hipoteki | **Księgi Wieczyste (EKW)** | 🔴 Ręczne | Brak publicznego API masowego; potrzebny nr KW. Wprowadzenie ręczne. |
| Roszczenia, służebności, prawo pierwokupu | KW / urząd / **KZN** | 🔴 Ręczne | |

---

## C. Uwarunkowania fizyczne terenu

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Ukształtowanie, spadki terenu | **NMT** (Numeryczny Model Terenu, GUGiK) | 🟢 Auto | Z NMT liczymy nachylenie — istotne dla kosztów i dla budownictwa senioralnego (dostępność, brak barier). |
| Ekspozycja / nasłonecznienie | wyliczane z **NMT** | 🟢 Auto | |
| Ryzyko powodziowe / zalewowe | **ISOK / Hydroportal** (Wody Polskie) | 🟢 Auto | Mapy zagrożenia i ryzyka powodziowego jako WMS. |
| Wody gruntowe, geologia, nośność | **CBDG / Geoportal PIG-PIB** | 🟡 Pół-auto | Kontekst ogólny automatycznie; rzeczywiste warunki posadowienia = badania geotechniczne. |
| Badania geotechniczne (odwierty) | wykonawca / projekt | 🔴 Ręczne | Dane wprowadzane przez użytkownika. |
| Tereny osuwiskowe (SOPO) | **SOPO** (PIG-PIB) | 🟢 Auto | |

---

## D. Infrastruktura techniczna (uzbrojenie) *(główny składnik kosztów uzbrojenia)*

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Sieci istniejące (mapa zasadnicza: wod-kan, en., gaz, ciepło, telekom) | **Geoportal powiatowy / mapa zasadnicza (GESUT)** | 🟡 Pół-auto | Dostępność i jakość WMS różni się powiatami. |
| Odległość do najbliższej sieci (na typ medium) | wyliczane z GESUT/BDOT + analizy GIS | 🟡 Pół-auto | Proxy kosztu przyłączenia — kluczowy wskaźnik ekonomiczny. |
| Warunki i koszt przyłączenia | **gestorzy sieci** (operatorzy wod-kan, OSD energia/gaz) | 🔴 Ręczne | Formalne warunki przyłączenia = zapytanie do gestora. |
| Dostępność światłowodu / internetu | **Punkt Informacyjny ds. Telekomunikacji (UKE)** | 🟡 Pół-auto | |
| Drogi dojazdowe / dostęp do drogi publicznej | **BDOT10k / OSM** | 🟢 Auto | Brak dostępu do drogi publicznej = bariera prawna zabudowy. |

---

## E. Dostępność komunikacyjna *(kluczowa dla młodych — dojazd do pracy)*

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Sieć drogowa, węzły, drogi krajowe | **OSM / GDDKiA** | 🟢 Auto | |
| Odległość / czas dojazdu do centrum aglomeracji | routing (OSRM / OpenTripPlanner / Valhalla) na danych OSM | 🟢 Auto | Izochrony dojazdu samochodem i transportem zbiorowym. |
| Przystanki transportu zbiorowego + częstotliwość | **GTFS** organizatorów transportu / OSM | 🟡 Pół-auto | GTFS tam, gdzie publikowany; częstotliwość kursów to mocny predyktor sukcesu. |
| Dworce/stacje kolejowe, SKM | **OSM / dane przewoźników** | 🟢 Auto | |
| Natężenie ruchu (GPR) | **GDDKiA — Generalny Pomiar Ruchu** | 🟡 Pół-auto | |

---

## F. Demografia i rynek pracy *(rdzeń oceny popytu — różny dla młodych i seniorów)*

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Liczba i struktura wieku ludności (gmina) | **GUS — Bank Danych Lokalnych (BDL)** | 🟢 Auto | REST API. Udział 20–39 lat → popyt „dla młodych"; udział 60+/65+ → popyt senioralny. |
| Prognoza ludności | **GUS BDL / prognozy GUS** | 🟢 Auto | Trend demograficzny gminy/powiatu. |
| Przyrost naturalny, saldo migracji | **GUS BDL** | 🟢 Auto | Migracje młodych „do/od" gminy — sygnał potencjału rozwoju. |
| Bezrobocie, liczba podmiotów gospodarczych | **GUS BDL** | 🟢 Auto | Rynek pracy w zasięgu dojazdu. |
| Dochody gosp. domowych / siła nabywcza | **GUS BDL** (ograniczone) / dane komercyjne | 🟡 Pół-auto | Na poziomie gminy ograniczone; siatka komercyjna lub estymacja. |
| Dane w siatce (grid 1 km) | **Portal Geostatystyczny GUS / NSP 2021** | 🟡 Pół-auto | Pozwala zejść poniżej granic administracyjnych. |

---

## G. Infrastruktura społeczna i usługi *(różnicuje się silnie wg grupy docelowej)*

**Wspólne:**

| Dane | Źródło | Pozyskanie |
|---|---|---|
| Sklepy spożywcze, usługi codzienne, gastronomia | **OSM (Overpass API)** | 🟢 Auto |
| Tereny zielone, parki, rekreacja | **OSM / BDOT10k** | 🟢 Auto |
| Apteki | **OSM / rejestr aptek** | 🟡 Pół-auto |

**Profil „dla młodych":**

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Żłobki | **rejestr żłobków (MRiPS / empatia)** | 🟡 Pół-auto | Kluczowy czynnik dla młodych rodzin. |
| Przedszkola, szkoły | **RSPO** (Rejestr Szkół i Placówek Oświatowych) | 🟢 Auto | |
| Place zabaw, miejsca pracy w dojeździe | **OSM / GUS** | 🟢 Auto | |

**Profil „senioralny":**

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Przychodnie POZ, podmioty lecznicze | **RPWDL** (Rejestr Podmiotów Wykon. Działalność Leczniczą) | 🟡 Pół-auto | Bliskość opieki zdrowotnej = warunek krytyczny. |
| Szpitale, oddziały geriatryczne | **RPWDL** | 🟡 Pół-auto | |
| DPS, dzienne domy opieki, usługi opiekuńcze | **rejestry wojewody / gmina** | 🔴 Ręczne | |
| Dostępność bez barier (spadki, krawężniki) | wyliczane z **NMT / OSM** | 🟡 Pół-auto | |
| Cisza / brak uciążliwości (hałas, ruch) | **mapy akustyczne / GIOŚ** | 🟡 Pół-auto | |

---

## H. Środowisko i ograniczenia prawne

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Formy ochrony przyrody, Natura 2000, parki | **GDOŚ — Geoserwis** | 🟢 Auto | WMS/WFS. Wykluczenia lub ograniczenia zabudowy. |
| Jakość powietrza | **GIOŚ — powietrze.gios.gov.pl** | 🟢 Auto | API pomiarowe. |
| Hałas (mapy akustyczne aglomeracji) | **GIOŚ / gminy** | 🟡 Pół-auto | |
| Zabytki, strefy ochrony konserwatorskiej | **NID — geoportal zabytków** | 🟢 Auto | WMS. Konserwator może blokować/ograniczać. |
| Strefy ochronne, linie wysokiego napięcia, gazociągi | **BDOT10k / GESUT** | 🟡 Pół-auto | Ograniczenia zabudowy i odległości. |
| Złoża / tereny górnicze | **MIDAS (PIG-PIB)** | 🟢 Auto | |

---

## I. Potencjał rozwojowy i rynek nieruchomości

| Dane | Źródło | Pozyskanie | Uwagi |
|---|---|---|---|
| Dynamika budownictwa, pozwolenia na budowę | **GUS BDL** | 🟢 Auto | Sygnał „rozgrzania" lokalnego rynku. |
| Zasób i pustostany mieszkaniowe | **GUS BDL / NSP 2021** | 🟢 Auto | |
| Ceny transakcyjne nieruchomości | **RCiWN** (Rejestr Cen i Wartości Nieruchomości, starosta) | 🔴 Ręczne | Dane u starosty, często odpłatnie / brak otwartego API. Alternatywa: serwisy komercyjne. |
| Ceny ofertowe | portale ogłoszeniowe (scraping/API komercyjne) | 🟡 Pół-auto | Proxy, z ostrożnością. |
| Plany inwestycyjne gminy, strategia rozwoju | **BIP gminy / strategie rozwoju** | 🔴 Ręczne | Od 1.07.2026 część w Rejestrze Urbanistycznym. |
| Programy wsparcia (SBC, SIM/TBS, KZN, BGK) | **BGK / KZN** | 🔴 Ręczne | Dostępność finansowania i gruntów Skarbu Państwa. |

---

## J. Dane ekonomiczne inwestycji *(w większości wejście użytkownika)*

| Dane | Źródło | Pozyskanie |
|---|---|---|
| Cena nabycia gruntu | użytkownik / RCiWN | 🔴 Ręczne |
| Szacunkowe koszty budowy (stawka /m²) | dane rynkowe / wprowadzenie | 🔴 Ręczne |
| Szacunkowy koszt uzbrojenia | wyliczane (odległości z dz. D) + stawki | 🟡 Pół-auto |
| Dostępne dofinansowanie / model finansowania | użytkownik / BGK | 🔴 Ręczne |

---

## K. Dane wejściowe do rekomendacji modelu zabudowy

Rekomendacja „korzystnego modelu zabudowy" powstaje z połączenia kilku warstw już zebranych powyżej:

| Wejście | Skąd (sekcja) | Rola w rekomendacji |
|---|---|---|
| Dopuszczalne funkcje + wskaźniki (intensywność, wysokość, pow. zabudowy, pow. biologicznie czynna) | B (MPZP / plan ogólny) | **Twardy limit** tego, co wolno zbudować. |
| Wielkość, kształt, spadki działki | A, C | Determinuje typ i układ zabudowy. |
| Profil demograficzny (młodzi vs 60+) | F | Wskazuje grupę docelową i typ mieszkań. |
| Dostępność transportu i usług | E, G | Wielorodzinna o większej intensywności sprawdza się przy dobrej komunikacji. |
| Charakter zabudowy sąsiedztwa | EGiB / BDOT10k | Spójność z otoczeniem, wymogi WZ (zasada „dobrego sąsiedztwa"). |

**Przykładowe profile wyjściowe modelu (do parametryzacji w aplikacji):**
- *Dla młodych:* zabudowa wielorodzinna o mniejszych mieszkaniach, wyższa intensywność, blisko węzłów transportu, parter usługowy; priorytet: żłobki/szkoły, dojazd do pracy, cena/m².
- *Senioralny:* niska zabudowa wielorodzinna z windą i pełną dostępnością, mała skala, blisko POZ i usług, tereny zielone, niski poziom hałasu i małe spadki terenu.

---

## Podsumowanie: co automatycznie, co ręcznie

**🟢 Pobieramy automatycznie (rdzeń pipeline'u danych):**
geometria działki (ULDK), użytki/budynki (EGiB, BDOT10k), ukształtowanie i spadki (NMT), powódź (ISOK), demografia i rynek pracy (GUS BDL — API), POI i komunikacja (OSM + routing), ochrona przyrody (GDOŚ), powietrze (GIOŚ), zabytki (NID), szkoły (RSPO).

**🟡 Pół-automatycznie (cyfrowe, ale wymaga pracy integracyjnej / mają „białe plamy"):**
MPZP i plan ogólny (KIMPZP / Rejestr Urbanistyczny — różne pokrycie gmin), uzbrojenie (mapa zasadnicza GESUT, różna jakość powiatami), GTFS i częstotliwość transportu, podmioty lecznicze (RPWDL), żłobki, dane w siatce GUS, ceny ofertowe.

**🔴 Wprowadzamy ręcznie / dane zewnętrzne:**
własność i obciążenia (KW), warunki i koszt przyłączenia (gestorzy sieci), badania geotechniczne, ceny transakcyjne (RCiWN), plany/strategie gminy, parametry ekonomiczne inwestycji, dostępne programy finansowania.

---

## Uwaga o reformie planistycznej (ważne dla harmonogramu)

- **31.08.2026** — studia uwarunkowań tracą moc; obowiązują plany ogólne gmin (forma w pełni cyfrowa).
- **01.07.2026** — uruchomienie **Rejestru Urbanistycznego** (GUGiK): centralne, darmowe, zgodne z INSPIRE źródło aktów planistycznych (plany ogólne, MPZP, WZ, ZPI) w formacie GML, z dostępem przez WMS/WFS i usługą e-Wyrys.
- **Konsekwencja dla aplikacji:** dane planistyczne, dziś rozproszone po setkach gminnych geoportali, stopniowo przechodzą z kategorii 🔴/🟡 do 🟢. Warto zaprojektować warstwę dostępu do danych planistycznych elastycznie, z fallbackiem na gminne źródła i z obsługą „białych plam", bo wdrożenie w gminach jest nierównomierne.
