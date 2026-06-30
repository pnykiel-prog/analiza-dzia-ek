# Architektura aplikacji — dokument nadrzędny (źródło prawdy)
### Ocena potencjału działki pod budownictwo społeczne dla młodych i senioralne

Ten dokument jest **źródłem prawdy** dla całej aplikacji. Pozostałe dokumenty są jego modułami i są do niego podpięte (mapa w sekcji 9). W razie sprzeczności obowiązuje ten dokument.

---

## 0. Cel aplikacji

Ocena, czy dana działka/grunt nadaje się pod budownictwo społeczne — w dwóch profilach (dla młodych / senioralne) — a jeśli tak, czy inwestycja w formule SIM domyka się finansowo. Proces przebiega w **trzech poziomach**, od szybkiego przesiewu po studium wykonalności.

---

## 1. Zasada architektury — trzy poziomy

```
Działka
  │
  ▼
[ Poziom 1 — podstawowy ]   szybki przesiew, dane automatyczne
  │  → wstępna akceptacja + profil
  ▼
[ Poziom 2 — profesjonalny ]  ocena działki: planistyka, uzbrojenie, zabudowa
  │  → działka potwierdzona + program zabudowy
  ▼
[ Poziom 3 — model finansowy ]  montaż, reżim w czasie, domknięcie
  │  ↑ (pętla: nie domyka → inny wariant zabudowy w P2)
  ▼
Studium wykonalności + wymagana dotacja
```

Dwie rodziny pytań:
- **Poziomy 1–2: „czy działka się nadaje"** — cecha lokalizacji i gruntu, względnie stabilna w czasie.
- **Poziom 3: „czy inwestycja się spina"** — cecha montażu finansowego i reżimu prawnego, zmienna z każdą nowelizacją.

Ten rozdział jest celowy: zmiana przepisów finansowych rusza tylko konfigurację Poziomu 3, nie warstwę oceny gruntu.

---

## 2. Zasady przekrojowe (obowiązują wszystkie poziomy)

1. **Dwa profile osobno.** Każda działka oceniana jest niezależnie dla „młodych" i „seniorów" (te same wymiary, inne wagi).
2. **Bramki przed punktacją.** Twarde wykluczenia (pass/warunkowo/fail) liczone przed scoringiem.
3. **Brak danych ≠ „nie".** Braki obniżają wskaźnik pewności, nie werdykt. Biała plama planistyczna = „do weryfikacji", nigdy „wykluczone".
4. **Rozdział nadawania się od opłacalności.** „Da się zbudować" (P2) to nie to samo co „opłaca się / wymaga tyle dotacji" (P3).
5. **Liczenie na momencie realizacji, nie analizy.** Wartości i reżim prawny (zwłaszcza w P3) liczone na datę naboru/startu budowy i oddania, nie na dziś.
6. **Parametry w konfiguracji, nie w kodzie.** Progi, wagi, wskaźniki i parametry programów są edytowalne — bo się zmieniają.
7. **Wynik poziomu = wejście następnego.** Żaden poziom nie zaczyna od zera.
8. **Pętla zwrotna P3 → P2.** Program, który nie domyka się finansowo, wraca po inny wariant zabudowy.

---

## 3. Poziom 1 — podstawowy (szybki przesiew)

- **Wejście:** identyfikator działki / punkt na mapie.
- **Dane:** wyłącznie automatyczne (zero wprowadzania).
- **Liczy:** bramki + 5 wymiarów (W1 planistyka, W2 demografia, W3 dostępność, W4 teren/koszty, W5 luka cenowa — jako **lekki sygnał przesiewowy**, nie pełny rachunek), osobno dla dwóch profili.
- **Wynik:** wstępna akceptacja (zielony/żółty/czerwony) + rekomendowany profil + flagi + wskaźnik pewności.
- **Moduł szczegółowy:** `poziom1_scoring.md`.

---

## 4. Poziom 2 — profesjonalny (ocena działki, bez finansów)

- **Wejście:** wynik Poziomu 1 + dane wprowadzane ręcznie / pół-automatyczne.
- **Moduły:** pełna planistyka (wskaźniki zabudowy), własność i obciążenia (KW), szczegółowe uzbrojenie i koszt przyłączenia, geotechnika, infrastruktura społeczna z izochronami osobno dla profili, środowisko i ograniczenia, rynek (ceny, pustostany), oraz **rekomendacja modelu zabudowy** w postaci fizyczno-programowej (typologia, obwiednia, liczba mieszkań, mix metraży).
- **Granica z Poziomem 3:** spięcie ekonomiczne programu **nie liczy się tutaj** — jest przejściem do Poziomu 3.
- **Wynik:** potwierdzona ocena działki + program zabudowy (wejście do P3).
- **Moduły szczegółowe:** `rekomendacja_modelu_zabudowy.md`, `dane_wejsciowe_analiza_dzialek.md`.

---

## 5. Poziom 3 — model finansowy (spięcie finansowe)

- **Wejście:** program zabudowy z Poziomu 2 (liczba mieszkań, PUM, koszt) + parametry reżimu z konfiguracji.
- **Moduły:** koszt przedsięwzięcia, montaż finansowy (grant, kredyt zwrotny, partycypacje, wkład), **oś czasu realizacji**, **reżim „as-of" scenariuszowy** (program z momentu realizacji), indeksacja kosztów i wartości, domknięcie (czynsz ≤ pułap, DSCR ≥ 1, wymagana dotacja), analiza wrażliwości.
- **Pętla zwrotna:** gdy program nie domyka się finansowo → powrót do P2 po inny wariant.
- **Wynik:** studium wykonalności finansowej + wymagana dotacja, jako przedział (konserwatywny/oczekiwany/korzystny).
- **Moduły szczegółowe:** `model_ekonomiczny_SIM_czasowy.md` (domyślny — ujęcie czasowo-reżimowe), `model_ekonomiczny_SIM_poziom2.md` (scenariusz A — obecny program SBC, dla inwestycji startujących do jesieni 2026).

---

## 6. Warstwa danych (przekrojowa)

| Kategoria | Pozyskanie | Uwaga |
|---|---|---|
| Rdzeń automatyczny | 🟢 | ULDK/EGiB/NMT (GUGiK), GUS BDL (API), OSM + routing, GDOŚ, ISOK, RSPO |
| Pół-automatyczne | 🟡 | MPZP/plan ogólny (Rejestr Urbanistyczny), uzbrojenie (GESUT), GTFS, RPWDL, dane w siatce GUS |
| Ręczne / zewnętrzne | 🔴 | własność (KW), warunki przyłączenia (gestorzy), geotechnika, ceny transakcyjne (RCiWN), parametry ekonomiczne |
| Najsłabsze ogniwa | — | lokalny czynsz rynkowy (rzadkie dane w małych miejscowościach), ceny transakcyjne |

Trend: dane planistyczne migrują z 🔴/🟡 do 🟢 wraz z **Rejestrem Urbanistycznym** — warstwa dostępu projektowana z fallbackiem i obsługą białych plam. Szczegóły: `dane_wejsciowe_analiza_dzialek.md`.

---

## 7. Warstwa konfiguracji (przekrojowa)

Parametry, które muszą być edytowalne poza kodem:

| Grupa | Przykłady | Częstość zmian |
|---|---|---|
| Scoring P1 | progi, wagi wymiarów per profil | po kalibracji |
| Zabudowa P2 | współczynnik efektywności, metraże, normatyw parkingowy | rzadko |
| Finanse P3 | % grantu, % kredytu, oprocentowanie, okres, pułap czynszu, indeksy | **co rok / co nowelizację** |

---

## 8. Kontekst regulacyjny (stan i horyzont realizacji)

- **Planistyka:** plany ogólne wiążące po 31.08.2026; Rejestr Urbanistyczny od 01.07.2026; nowe WZ — ważność 5 lat, wymóg OUZ i prawa do dysponowania nieruchomością.
- **Finansowanie:** program SBC kończy się edycją jesienną 2026; **od 2027 nowy program** (kontury: kredyt ~2% do 50 lat, grant ~15%, czynsz celowany 15–30 zł/m² — do potwierdzenia dla SIM). RFRM zlikwidowany (12.2024). Horyzont unijny: „Cztery Ściany" (>400 mld € na 2026–2029).
- **Implikacja:** domyślny reżim Poziomu 3 dla nowych analiz to **program 2027+**, nie obecny SBC — z jawną flagą niepewności.

---

## 9. Mapa dokumentów

| Dokument | Poziom / warstwa | Status |
|---|---|---|
| `architektura_aplikacji.md` (ten plik) | nadrzędny | źródło prawdy |
| `dane_wejsciowe_analiza_dzialek.md` | warstwa danych (zasila P1–P3) | aktualny |
| `poziom1_scoring.md` | Poziom 1 | aktualny |
| `rekomendacja_modelu_zabudowy.md` | Poziom 2 | aktualny (spięcie ekonomiczne → przeniesione do P3) |
| `model_ekonomiczny_SIM_czasowy.md` | Poziom 3 (domyślny) | aktualny |
| `model_ekonomiczny_SIM_poziom2.md` | Poziom 3 (scenariusz A — SBC 2026) | aktualny jako scenariusz |
| schemat „dwupoziomowy" | — | **nieaktualny** (zastąpiony trójpoziomowym) |

---

## 10. Otwarte kwestie i dalsze kroki

- **Kalibracja** progów i wag Poziomu 1 na zbiorze działek o znanym wyniku.
- **Doprecyzowanie parametrów programu 2027** po publikacji rozporządzeń (aktualizacja konfiguracji P3).
- **Moduł wrażliwości i scenariuszy** jako osobna warstwa nad P3 (reżim × stopa × indeksacja × okres kredytu).
- **Specyfikacja techniczna integracji danych** (API, formaty, harmonogram odświeżania, obsługa białych plam).
- **Domknięcie pętli P3 → P2** — reguła generowania alternatywnych wariantów zabudowy, gdy model nie domyka.
