# Diagnoza: „atrakcyjność migracyjna = 0" dla Katowic

**Data:** 2026-07-09
**Zakres:** dlaczego korekta migracyjna P1 wychodziła zerowa/neutralna dla Katowic mimo napływu młodych; co naprawiono; jaka decyzja pozostaje otwarta.

## 1. Objaw

Dla działki w Katowicach pole „atrakcyjność migracyjna" (0–100) pokazywało **0**, a panel „Korekta migracyjna" — mnożnik neutralny **×1,00**, mimo że Katowice mają realny napływ młodych mieszkańców.

## 2. Diagnoza — trzy nakładające się przyczyny

Weryfikacja przez `/api/diag-gus?gmina=Katowice&woj=śląskie` odsłoniła kolejne warstwy:

### 2a. Model wymagał BILANSU, a miał tylko część danych
Korekta migracyjna liczy się z salda na 1000 mieszkańców (`napływ − odpływ` albo saldo netto). Pierwszy diag pokazał:
- `naplywZameldowanNa1000: 11.41` ✅ (napływ pobrany),
- `odplywMlodychNa1000` ❌ `null`,
- `saldoMigracjiMlodzi` ❌ `null`.

Mając **sam napływ**, model nie umiał policzyć wyniku netto → mnożnik neutralny ×1,00 → pole zerowane. Napływ 11,41 był ignorowany.

### 2b. Zapytanie GUS pinowało rok 2023 (opóźnienie publikacji)
Konektor odpytywał `data/by-unit` z `year=2023`. Zameldowania mają rocznik 2023, ale **saldo (`1365234`) i wymeldowania (`80123`) są publikowane z opóźnieniem** — dla Katowic 2023 jeszcze ich nie było → `null`. To brak *rocznika*, nie brak zmiennej.

### 2c. „Saldo młodych" per gmina w GUS NIE ISTNIEJE
Katalog BDL (`?vars=saldo migracji`) potwierdził: rozkłady salda **wg grup wieku** (`72193` = 20-29, `72192` = 30-44) istnieją **wyłącznie na poziomie 3 (podregion)**, nie na poziomie gminy (6). Na poziomie gminy dostępne jest tylko saldo **ogółem** (wszystkie grupy wieku). Napływu samych młodych **nie da się wyodrębnić per gmina** — to twarde ograniczenie rejestru.

### 2d. Pole 0–100 przycinało ujemne do zera (efekt uboczny)
Zdeprecjonowane pole `atrakcyjnoscMigracyjna.wartosc = clamp(…, 0, 100)` nie umie pokazać ujemnego salda — dla gminy kurczącej się per saldo zawsze da 0. Sygnał ze znakiem żyje w panelu „Korekta migracyjna" (×mnożnik + saldo/1000).

## 3. Naprawy (wdrożone)

| PR | Zmiana | Efekt |
|---|---|---|
| **#173** | Fallback korekty z samego napływu (napływ vs benchmark, słabszy współczynnik, flaga `zNaplywu`, niższa pewność) | Gmina z samym napływem przestaje być neutralna |
| **#174** | Fallback roczny w konektorze GUS: gdy saldo/napływ/odpływ `null` dla bieżącego roku → sięgnij rok-1, rok-2 (tylko te zmienne) | Katowice pobrały odpływ i saldo z ostatniego opublikowanego rocznika |
| **(ten PR)** | Kolejność źródeł: **saldo netto PIERWSZE**, potem napływ−odpływ, potem sam napływ | Naprawa błędu mieszania lat: po fallbacku rocznym napływ (2023) i odpływ (rok wcześniej) dawały różnicę bez sensu; saldo netto to jedna, spójna liczba z jednego roku |

### Kaskada źródeł korekty migracyjnej (stan docelowy)
1. saldo netto (jeden rok, spójne) — **preferowane**,
2. napływ − odpływ (oba na 1000),
3. sam napływ vs benchmark (fallback),
4. neutralny ×1,00 tylko przy całkowitym braku danych.

## 4. Wynik końcowy dla Katowic (po naprawach)

Drugi diag (po fallbacku rocznym):
- `naplywZameldowanNa1000: 11.41`, `odplywMlodychNa1000: 11.4`, **`saldoMigracjiMlodzi: -488`**.

Saldo netto ogółem: −488 / 279 190 × 1000 = **−1,75/1000** → mnożnik **≈ ×0,95** (lekko obniża popyt).

**To wynik poprawny, ale przeciwny pierwotnej intuicji:** mimo napływu młodych, Katowice per **całkowite saldo** tracą ludność (potwierdza `trendLudnosc: "malejaca"`). Miasto rdzeniowe oddaje mieszkańców przedmieściom i za granicę; napływ młodych nie równoważy tego w saldzie ogółem — a salda samych młodych GUS nie daje na poziomie gminy (§2c).

## 5. Decyzja otwarta — jak traktować taki przypadek

| Opcja | Opis | Koszt / ryzyko |
|---|---|---|
| **A. Zostaw saldo ogółem (×0,95)** | Uczciwe względem danych gminnych; nie kredytuje napływu młodych, bo saldo netto jest ujemne | Zero — stan po tym PR |
| **B. Dołóż sygnał „napływ młodych" z podregionu** | Osobny, jawny modyfikator z poziomu 3 (saldo 20-29/30-44, id `72193`/`72192`); podregion katowicki prawdopodobnie ma dodatnie saldo młodych → skoryguje w górę | Nowy fetch (poziom 3) + logika łączenia gmina↔podregion + weryfikacja na Vercel; sygnał regionalny, nie gminny (grubszy) |
| **C. Użyj salda migracji WEWNĘTRZNEJ zamiast ogółem** | id `80125`/`498816` — pomija emigrację zagraniczną, która ciągnie saldo w dół; może dać wynik bliższy zera/dodatni | Jedna zmiana ID + weryfikacja; nadal wszystkie grupy wieku |

**Rekomendacja:** A jako stan bazowy (poprawny i najprostszy). Jeśli produktowo zależy nam na jawnym „kredytowaniu" miast akademickich za napływ młodych — B jest właściwe, ale to świadoma decyzja o dodaniu regionalnego (podregionowego) sygnału obok gminnego. C to tanie sprawdzenie, czy sama zagranica zaniża wynik.
