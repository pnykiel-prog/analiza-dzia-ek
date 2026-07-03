# GRUNT — Zestawienie kompletu danych Poziomu 2 (M2)

Katalog danych M2 wzorem `dane-m1.md`: dla każdego pola — **źródło (auto)**,
**status pozyskania**, **manual_fallback**, **rola**. M2 pogłębia ocenę działki
z M1 o wszystko, co decyduje o powodzeniu inwestycji **poza finansami** (to M3).

Cecha kluczowa M2 (wg `wytyczne_claude_code_poziom2_1.md`): klient **widzi, co
pobrano automatycznie, a czego brakuje**, i może ręcznie uzupełnić braki lub je
pominąć — dopiero potem uruchamia analizę. Pominięcie nigdy nie blokuje.

Źródła prawdy w kodzie (docelowo):
- `src/lib/engine/poziom2.ts` — model zabudowy (obwiednia → warianty),
- `src/lib/engine/uwarunkowania.ts` — bramki, sygnały, braki, kluczowe liczby,
- `src/lib/data/connectors/*` — konektory M2 (WMS środowiskowe, GESUT, OSM/Overpass, EGiB, KIMPZP-wskaźniki),
- `src/lib/types.ts` — `DaneDzialki` (sekcje C–J to pola M2), `WskaznikiPlanistyczne`,
- (nowe) silnik uzgodnienia danych + model statusu pól (M2a).

---

## 0. Wejście z M1 (nie liczyć ponownie)

M1 oddaje i M2 **przejmuje** (nie przelicza): `prognoza` (pow. zabudowy,
kondygnacje, PUM, mieszkania), `pojemnosc`, **4 werdykty popytowe +
atrakcyjność migracyjna**, `profilRekomendowany` (steruje wariantami zabudowy),
bramka funkcji, pewność/flagi. Szczegóły wyjścia M1 → `docs/dane-m1.md` §3.

---

## 1. Przepływ M2: pobierz → pokaż co masz → uzupełnij braki → analizuj

```
E1  Wejście z M1
E2  AUTO: jedno przejście po konektorach M2 (każdy: jedna próba + timeout) → mapa statusu pól
E3  EKRAN UZGODNIENIA DANYCH (3 sekcje: A pozyskane · B do uzupełnienia · C niedostępne)
E4  Klient uzupełnia lub pomija (może pominąć wszystko)
E5  ANALIZA M2 (renderuje się po uzgodnieniu; „Przelicz" po dalszych uzupełnieniach)
```

Determinizm dziedziczony z M1: jedno przejście pobrania, każdy konektor **jedna
próba + timeout + degradacja**, bez ponawiania i rekurencji; stan zawsze terminalny.

---

## 2. Model statusu pola (rdzeń „automatycznego rozpoznania braków")

Po E2 każde pole M2 ma:

| Atrybut | Wartości | Znaczenie |
|---|---|---|
| **status** | `pozyskane` · `brak` · `pominiete` | auto OK / nie pobrano lub błąd / klient kliknął Pomiń |
| **manual_fallback** | `on` · `off` · `gate` | pole ręczne + Pomiń / brak pola (tylko niższa pewność) / pole ręczne bramkowe (można **dodać** ograniczenie, nie **znieść** bez dokumentu) |
| **zrodlo** | np. `KIMPZP`, `GESUT`, `OSM`, `ręczne` | prowenancja |
| **pewnosc** | 0–100 | znacznik pewności |
| **rola** | `bramka` · `wskaznik` · `koszt` | jak pole wpływa na wynik |

Mapa statusu wprost dzieli pola na **pozyskane** i **do uzupełnienia** — to jest
„rozpoznanie, których danych brakuje".

---

## 3. Ekran uzgodnienia danych (E3) — trzy sekcje

- **A. Pozyskano automatycznie** — pole, wartość, źródło, pewność. Pola `A±` edytowalne (override + ślad audytowy); reszta tylko do odczytu.
- **B. Do uzupełnienia ręcznego** — pola `status=brak` i `manual_fallback ∈ {on, gate}`. Każde: etykieta, pole, **podpowiedź skąd wziąć** („z wypisu z MPZP", „warunki od gestora", „operat"), **[Pomiń]**. Pola `gate` z ostrzeżeniem (wymóg źródła — nie znosi bramki deklaracją).
- **C. Niedostępne automatycznie** — pola `status=brak` i `manual_fallback=off` (demografia, statystyka). Informacyjnie, bez pola; obniżają pewność.

Przycisk **„Uruchom analizę M2"** aktywny zawsze. Po uzupełnieniu → **„Przelicz"** z diffem.

---

## 4. Katalog danych M2 (pole → źródło → manual_fallback → rola → status w kodzie)

Legenda statusu w kodzie: ✅ konektor gotowy · 🟡 częściowo/proxy · ⚪ szew (pole w `DaneDzialki`, konektor do zrobienia).

### Wskaźniki planistyczne (uściślają model zabudowy i pojemność — §5)

| Pole (`DaneDzialki`) | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `wskaznikiPlanistyczne` (intensywność, maks. wys./kond., % zabudowy, PBC, parking, % usług) | MPZP/plan ogólny (KIMPZP wektor, POG) | `on` | wskaźnik | ⚪ (KIMPZP daje `mpzpMeta`: maks. wys./intensywność — do zmapowania) |

### Fizyka terenu

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `sredniSpadekPct` | NMT (WMS/GUGiK) | `on` | koszt + dostępność (seniorzy) | ⚪ |
| `ryzykoPowodzioweSzczegolne` | ISOK / Wody Polskie (WMS) | `gate` | bramka | ⚪ |
| `osuwisko` | PIG SOPO (WMS) | `gate` | bramka/flaga | ⚪ |
| `terenGorniczy` | PIG MIDAS (WMS) | `gate` | bramka/flaga | ⚪ |

### Uzbrojenie

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `odlegloscDoSieciM` (+ typy sieci) | GESUT/KIUT, BDOT (WMS) | `on` | inwentaryzacja + proxy kosztu | ⚪ |
| `odlegloscDoZabudowyM` | BDOT | `on` | proxy „w tkance" | ⚪ |
| warunki i koszt przyłączenia | — (od gestora) | `on` | koszt (dane twarde) | ⚪ (tylko ręczne) |

### Dostęp i dostępność komunikacyjna

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `dostepDrogaPubliczna` | BDOT/EGiB/OSM | `gate` | bramka | ⚪ |
| `czasDojazdAglomeracjaMin`, węzły | OSM/routing | `off`→proxy | mnożnik popytu (młodzi) | ⚪ |
| `przystanekZCzestotliwoscia` | OSM/GTFS | `on` | mnożnik popytu | 🟡 (Overpass POI) |

### Infrastruktura społeczna (mnożniki popytu per profil)

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `pozWZasiegu` (POZ, apteki) | RPWDL / Overpass | `on` | mnożnik (seniorzy) | 🟡 (Overpass) |
| `uslugiPodstawowePieszo` | Overpass | `on` | mnożnik (seniorzy) | 🟡 (Overpass) |
| `zlobkiSzkolyWZasiegu` | RSPO / Overpass | `on` | mnożnik (młodzi) | 🟡 (Overpass) |

### Środowisko i ochrona

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `natura2000` | GDOŚ (WMS) | `gate` | bramka/flaga | ⚪ |
| `ochronaWykluczajaca` (rezerwat/PN) | GDOŚ (WMS) | `gate` | bramka | ⚪ |
| `strefaKonserwatorska` (zabytki) | NID (WMS) | `gate` | flaga (ograniczenia) | ⚪ |

### Grunt i prawo

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `klasaUzytku`, `gruntLesny`, `gruntRolnyKlasaIdoIII` | EGiB | `gate` | bramka (ochrona gruntów) | ⚪ |
| własność, KW, obciążenia | — (KW/akt) | `on` | wykonalność + wejście do ankiety (wniesienie gruntu) | ⚪ (tylko ręczne) |

### Potencjał rozwoju lokalizacji

| Pole | Źródło (auto) | manual_fallback | Rola | Kod |
|---|---|---|---|---|
| `pustostanyPct`, dynamika budownictwa | GUS BDL | `off` | rozwój lokalizacji | ⚪ |
| pracodawcy, inwestycje, ZPI/LzG | BIP/kontekst | `on` | pull + dźwignie współpracy | ⚪ (tylko ręczne) |

Wszystko przez **backend/proxy** (CORS); każdy konektor: jedna próba + timeout.

---

## 5. Rozszerzone dane planistyczne (MPZP) — auto gdzie pokryte, inaczej ręcznie

M1 używał KIMPZP jako **bramki** (jest/brak) + adnotacji. M2 **pozyskuje realne
wskaźniki**:
- plan wektorowy / plan ogólny udostępnia wskaźniki → **auto** (`pozyskane`, sekcja A);
- plan rastrowy / brak danych → **pole ręczne** (`on`, sekcja B) z podpowiedzią „z wypisu z MPZP" + Pomiń.

Skutek: model zabudowy i pojemność z M1 (szacunek z sąsiedztwa) są w M2
**uściślane realnymi wskaźnikami planu** — z wyższą pewnością. Gdy klient je
pominie, zostaje szacunek z M1 z flagą „potencjał orientacyjny".

> Uwaga (diagnoza pokrycia KIMPZP): dla ~6 dużych miast serwis nie działa
> (Kraków, Gdańsk, Lublin, Bielsko-Biała, Opole, Sosnowiec) → tam wskaźniki
> planu trafiają do sekcji B (ręcznie). Warszawa: `mpzpMeta` z parametrami
> (maks. wys./intensywność) auto.

---

## 6. Analiza M2 (renderuje się po uzgodnieniu) — per profil (młodzi/seniorzy)

1. **Domknięcie popytu usługami:** `popyt_realizowalny = popyt_z_M1 × mnożnik_usług_i_dostępności(profil)`.
2. **Koszt uzbrojenia (proxy):** odległość do sieci × stawki; drogie uzbrojenie obniża przydatność. (Pełny montaż = M3.)
3. **Bramki:** powódź, osuwisko/górnicze, Natura 2000/konserwator, dostęp do drogi, rola I–III/las → pass / warunkowo / fail. `gate` nie znosi się deklaracją bez dokumentu.
4. **Dostępność i potencjał rozwoju** — wymiary oceny.
5. **Teren** (spadek → koszt + dostępność bez barier).
6. **Rekomendacja modelu zabudowy** — z wskaźników planu (§5) lub szacunku M1; sterowana `profilRekomendowany`; 1–3 warianty (typologia, liczba mieszkań, mix, parking, powierzchnie wspólne) → wejście do M3.
7. **Werdykt profesjonalny per profil** + lista braków (pominięte/`on` niepobrane) + pewność.

---

## 7. Pewność i pominięcia

- `pominiete`/`brak` → obniża pewność, flaga „do weryfikacji"; **nigdy nie blokuje**.
- Bramki `gate` niepotwierdzone → „do sprawdzenia", nie „wykluczone" ani „czyste".
- Wartość ręczna → źródło `ręczne`, pewność „user-sourced", ślad audytowy.
- Panel jakości priorytetyzuje pominięte/`on` wg wpływu na werdykt + „Przelicz" z diffem.

---

## 8. Schemat wyniku M2 (wejście do ankiety i M3)

```
{
  z_M1: { prognoza, pojemnosc, werdykty, atrakcyjnosc, profilRekomendowany },
  dane_M2: { <pole>: { wartosc, status, zrodlo, pewnosc, manual_fallback } },
  popyt_realizowalny: { mlodzi, seniorzy },      // po mnożniku usług
  koszt_uzbrojenia_proxy, dostepnosc, potencjal_rozwoju, teren,
  bramki: { powodz, osuwisko, natura2000, droga, rola_las },
  model_zabudowy: { warianty: [...] },
  wlasnosc: { kw?, obciazenia? },                 // do ankiety
  werdykt_M2: { mlodzi, seniorzy },
  braki: [ <pola do uzupełnienia> ],
  pewnosc
}
```

---

## 9. Kolejność wdrożenia (kryteria akceptacji)

- **M2a — silnik uzgodnienia danych.** Jedno przejście pobrania + mapa statusu + ekran E3 (3 sekcje, Pomiń przy `on`/`gate`) + analiza z dowolnym podzbiorem.
  *Akceptacja:* klient widzi co pozyskano/czego brak; może wszystko pominąć i dostać analizę; pola `off` bez opcji ręcznej.
- **M2b — konektory auto.** GESUT, NMT, OSM/Overpass, GDOŚ/ISOK/PIG/NID, EGiB, KIMPZP-wskaźniki. *Akceptacja:* bramki działają; usługi domykają popyt; koszt uzbrojenia liczony; każde źródło jedna próba.
- **M2c — model zabudowy + werdykt profesjonalny.** Uściślenie pojemności wskaźnikami planu; warianty wg `profilRekomendowany`; werdykt per profil + braki + pewność.
- **M2d — panel jakości + „Przelicz" + eksport.**

---

## 10. Mapa modułów (repo, stack TypeScript/Next — adaptacja Python z wytycznych §11)

| Wytyczne (Python) | GRUNT (TypeScript) | Zawartość |
|---|---|---|
| `docs/dane-m2.md` | `docs/dane-m2.md` | ten katalog |
| `level2/schemas.py` | `src/lib/types.ts` (rozszerzenie: `PoleM2`, `StatusPolaM2`, `WynikUzgodnienia`) | model statusu pól + wynik M2 (§8) |
| `level2/reconcile.py` | `src/lib/engine/uzgodnienieM2.ts` | przejście pobrania + mapa statusu (rdzeń „rozpoznania braków") |
| `level2/connectors/` | `src/lib/data/connectors/{nmt,isok,pig,gdos,nid,gesut,egib,kimpzpWskazniki}.ts` | każdy: jedna próba + timeout, mock/live |
| `level2/services.py` | `src/lib/engine/uslugiM2.ts` | mnożnik usług/dostępności (domknięcie popytu) |
| `level2/infrastructure.py` | `src/lib/engine/uzbrojenieM2.ts` | koszt uzbrojenia proxy + bramka drogi |
| `level2/gates.py` | `src/lib/engine/uwarunkowania.ts` (rozszerzenie) | bramki środowiskowe/gruntowe |
| `level2/building_model.py` | `src/lib/engine/poziom2.ts` (rozszerzenie) | rekomendacja zabudowy (wskaźniki planu / szacunek M1) |
| `level2/pipeline.py` | `src/lib/engine/poziom2.ts` (orkiestracja E1–E5) | przepływ terminalny |
| frontend E3 | `src/components/UzgodnienieM2.tsx` + `/nowa` | ekran uzgodnienia (3 sekcje + Pomiń) → analiza |
