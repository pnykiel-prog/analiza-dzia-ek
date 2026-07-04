# GRUNT — dane Poziomu 2 (M2), wersja uproszczona

**Ta wersja zastępuje poprzednią (audyt braków).** M2 **nie pokazuje** listy „czego
nie pobrano". Co się da — pobiera automatycznie w tle. Klientowi zadaje **tylko
kilka prostych pytań** o rzeczy, których auto nie ustaliło i które klient realnie
zna. Cel: klient bez zniechęcenia przechodzi do Poziomu 3.

Źródła prawdy w kodzie:
- `src/components/PytaniaM2.tsx` — krótki formularz (jedyna interakcja ręczna),
- `src/lib/config.ts` — `KONFIG_M2` (zestaw odległości pieszo + próg pieszy),
- `src/app/nowa/page.tsx` — `przeliczZOdpowiedzi` (mapowanie odpowiedzi → `DaneDzialki`),
- `src/lib/engine/poziom2.ts` + `uwarunkowania.ts` — model zabudowy, bramki, sygnały (bez audytu braków),
- `src/lib/types.ts` — `DaneDzialki` (pola M2: `odleglosciM2`, `wysokoscOkolicyPieter`, `wskaznikiPlanistyczne`).

---

## 0. Zasada nadrzędna

„Skoro czegoś nie ma — program pyta i dostaje odpowiedź", ale **tylko o to, co
klient zna**, i **jako proste pytanie**, nie jako lista braków. Dane, których klient
nie wyprodukuje (statystyka, środowisko), **nie są pytaniami** — pobierane są
automatycznie albo cicho obniżają pewność. **Żadnej sekcji „czego nie pobrano"**
na ekranie klienckim (w raporcie PDF braki zostają jako ślad rzetelności).

---

## 1. Wejście z M1 (nie pytać ponownie)

M1 oddaje: `prognoza`/`pojemność`, 4 werdykty + atrakcyjność, `profilRekomendowany`,
**podstawę planistyczną z KIMPZP** (flaga + ewentualne wskaźniki), bramkę funkcji.
M2 tego **nie pyta ponownie**.

---

## 2. Co M2 robi automatycznie (w tle, bez pytań)

Każdy konektor: jedna próba + timeout; brak → **nie** pokazujemy jako „brak".

| Blok | Źródło (auto) | Uwaga |
|---|---|---|
| Demografia / potencjał rozwoju | GUS BDL | rozszerzenie danych z M1 |
| Środowisko / bramki | GDOŚ, ISOK, PIG, NID (WMS) | **gdy MPZP dopuszcza mieszkaniówkę → wstępnie rozstrzygnięte, nie eksponujemy**; liczą się głównie bez planu |
| Uzbrojenie: odległość do sieci | GESUT / BDOT | → **koszt uzbrojenia proxy** auto; bez pytań o warunki/koszt przyłączenia |
| Odległości do usług | OSM / Overpass | pre-wypełniają pola z §3, jeśli się uda |
| Wysokość zabudowy w okolicy | BDOT | pre-wypełnia pytanie z §3.3 |
| Dostęp do drogi | BDOT / EGiB | pre-wypełnia pytanie z §3.1 |
| Spadek terenu | NMT | z M1 |

---

## 3. Proste pytania do klienta (`PytaniaM2`) — jedyna interakcja ręczna

Wszystkie opcjonalne (puste = nieznane, dalej zawsze można). **Bez sekcji „pomiń/braki".**

1. **Dostęp do drogi publicznej?** — tak / nie / nie wiem *(tylko gdy auto nie rozstrzygnęło)*.
2. **Odległości pieszo [m]** — pre-wypełnione z OSM jeśli się udało; zestaw w `KONFIG_M2.odleglosciPieszo`
   (przystanek, sklep, apteka, POZ, szkoła, przedszkole — można rozszerzać).
3. **Wysokość zabudowy w okolicy [piętra]** — *(tylko gdy auto z BDOT nie pobrało)*.
4. **[opcjonalne, zwijane] „Masz szczegóły planistyczne (wypis z MPZP)?"**
   — domyślnie **NIE** (używamy danych z M1); **TAK** → pola: intensywność, maks. wysokość,
   % zabudowy, PBC → uściśla model zabudowy z wyższą pewnością.

---

## 4. Co USUNIĘTE z M2 (i dlaczego)

- **Księga wieczysta / własność** → pytanie jest w **ankiecie finansowej** (własna czy kupowana). Nie dublować.
- **Geotechnika / nośność** → zbyt szczegółowe na etapie wniosku.
- **Warunki i koszt przyłączenia** → nieznane na tym etapie; koszt uzbrojenia liczymy **proxy auto**.
- **Pytania środowiskowe do klienta** (Natura 2000, parki, konserwator) → klient ich nie zna; robimy **auto** lub pomijamy przy istniejącym MPZP.
- **Sekcja „czego nie pobrano" / audyt braków** → usunięte z ekranu klienckiego.

---

## 5. Mapowanie odpowiedzi → `DaneDzialki` (`przeliczZOdpowiedzi`)

- droga → `dostepDrogaPubliczna`,
- odległości [m] → `odleglosciM2` + wyprowadzenie „w zasięgu pieszym" (≤ `KONFIG_M2.progPieszoM`):
  przystanek → `przystanekZCzestotliwoscia`; sklep/apteka → `uslugiPodstawowePieszo`;
  POZ → `pozWZasiegu`; szkoła/przedszkole → `zlobkiSzkolyWZasiegu`
  (brak danej nie nadpisuje na `false` — zostaje wartość z auto/M1),
- wysokość okolicy → `wysokoscOkolicyPieter`,
- planistyka (jeśli podana) → `wskaznikiPlanistyczne` (inaczej z M1).

---

## 6. Analiza M2 (po odpowiedziach) — per profil (młodzi / seniorzy)

1. **Domknięcie popytu usługami**: `popyt_realizowalny = popyt_z_M1 × mnożnik_usług_i_dostępności(profil)` — z odległości (auto/wpisane).
2. **Koszt uzbrojenia (proxy, auto)** — obniża przydatność przy dużej odległości do sieci.
3. **Bramki środowiskowe (auto)** — deprioryzowane gdy MPZP dopuszcza mieszkaniówkę; bez planu liczą się normalnie.
4. **Dostęp do drogi** (bramka), **dostępność/aglomeracja**, **potencjał rozwoju**, **teren (spadek)**.
5. **Model zabudowy** — uściślony wskaźnikami z §3.4 gdy podane; inaczej z M1; warianty wg `profilRekomendowany`.
6. **Werdykt per profil** + pewność. **Bez listy braków** — niższa pewność wynika cicho z pustych pól.

---

## 7. Pewność (bez straszenia brakami)

Puste pola i nieudane auto → **cicho** obniżają pewność (wewnętrzna flaga „do
weryfikacji"). Klient **nie widzi** listy braków. Bramki niepotwierdzone → status
wewnętrzny „do sprawdzenia", nie „wykluczone". Opcjonalny panel jakości może
zachęcić do dopisania odległości, które najbardziej podniosą pewność — jako
zachęta, nie audyt.

---

## 8. Schemat wyniku M2 (wejście do ankiety i M3)

```
{
  z_M1: { prognoza, pojemnosc, werdykty, atrakcyjnosc, profilRekomendowany, planistyka_M1 },
  odleglosci: { przystanek?, sklep?, apteka?, poz?, szkola?, przedszkole? },   // auto lub wpisane [m]
  wysokosc_okolicy_pieter?,
  dostep_do_drogi?,
  planistyka_szczegoly?: { intensywnosc, maks_wys, pct_zabudowy, pbc },        // tylko gdy klient podał
  auto: { srodowisko_bramki, koszt_uzbrojenia_proxy, dostepnosc, potencjal, teren },
  popyt_realizowalny: { mlodzi, seniorzy },
  model_zabudowy: { warianty: [...] },
  werdykt_M2: { mlodzi, seniorzy },
  pewnosc
}
```
Własność/grunt **nie** jest tu zbierana — wchodzi dopiero w ankiecie finansowej.

---

## 9. Kolejność wdrożenia (kryteria akceptacji)

- **M2a — auto w tle + proste pytania** *(zrobione)*. Krótki formularz (§3) bez audytu braków.
  *Akceptacja:* klient widzi najwyżej kilka prostych pytań — nie listę braków; może zostawić puste i przejść do M3.
- **M2b — konektory auto**. GUS BDL, środowisko WMS, GESUT/BDOT (uzbrojenie+droga), OSM (usługi), BDOT (wysokość), NMT (spadek). Każdy po jednej próbie.
  *Akceptacja:* pola z §3 pre-wypełniane, gdy auto się uda; środowisko liczone w tle, nie jako pytanie.
- **M2c — analiza + model zabudowy**. Mnożnik usług z odległości, koszt uzbrojenia proxy, bramki, model (uściślony wskaźnikami gdy podane), werdykt per profil.
  *Akceptacja:* analiza rusza z dowolnym podzbiorem odpowiedzi; puste pola obniżają pewność cicho.

---

## 10. Mapa modułów (repo, stack TypeScript/Next)

| Wytyczne (Python) | GRUNT (TypeScript) | Zawartość |
|---|---|---|
| `docs/dane-m2.md` | `docs/dane-m2.md` | ten katalog |
| `level2/autofetch.py` | konektory M2 (M2b) + resolver | przejście pobrania w tle, pre-wypełnianie odległości |
| `level2/questions.py` | `src/components/PytaniaM2.tsx` | krótki formularz, wszystkie pola opcjonalne |
| `level2/services.py` | `src/lib/engine/*` (M2c) | mnożnik usług z odległości |
| `level2/infrastructure.py` | `src/lib/engine/*` (M2c) | koszt uzbrojenia proxy + bramka drogi |
| `level2/gates.py` | `src/lib/engine/uwarunkowania.ts` | bramki (deprioryzacja gdy MPZP) |
| `level2/building_model.py` | `src/lib/engine/poziom2.ts` | model zabudowy (wskaźniki opcjonalne / szacunek M1) |
| `level2/pipeline.py` | `src/app/nowa/page.tsx` orkiestracja | auto → pytania → analiza, terminalny |
| frontend audytu braków | **usunięte** | zostaje krótki formularz + wynik |
