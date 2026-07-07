/**
 * Bramka wielkości/kształtu działki + forma zabudowy (M1).
 * ========================================================
 * Wchodzi w M1 zaraz po geometrii z ULDK, PRZED liczeniem popytu i pełnej
 * pojemności. Rozstrzyga trzy rzeczy (wytyczne_claude_code_bramka_wielkosci_forma):
 *
 *  1. FIZYCZNA WYKONALNOŚĆ (twarda bramka, odrzuca BEZ pytania) — czy zmieści się
 *     choćby minimalna zabudowa niska. NIE → M1 bez werdyktów, komunikat
 *     „nie nadaje się" lub „rozważ scalenie".
 *  2. FORMA ZABUDOWY — liczymy pojemność w formie NISKIEJ (≤2 kond.) i WYSOKIEJ
 *     tym samym łańcuchem, rekomendujemy efektywniejszą (najwięcej lokali).
 *  3. PRÓG OPŁACALNOŚCI (miękki, punkt decyzyjny — NIE odrzuca) — lokali < próg
 *     (niska 20 / wysoka 40) → obserwacja o mniejszej skali + pytanie
 *     „analizować dalej?". Konflikt progów (wysoka poniżej, niska w progu) →
 *     decyzja wraca do klienta.
 *
 * Działa na PEWNEJ geometrii z ULDK, więc może bramkować stanowczo (to nie
 * przypadek „brak danych → niższa pewność").
 */

import type { BramkaWielkosci, DaneDzialki, FormaZabudowy, PojemnoscForma, SasiedztwoDane } from "../types";
import type { KonfiguracjaPoziom1 } from "../config";
import { KONFIG_POZIOM1 } from "../config";
import { prognozaPotencjalu } from "./potencjal";

/** Pojemność jednej formy zabudowy — wspólny łańcuch Pz→GFA→PU→PUM→mieszkania. */
function pojemnoscFormy(
  d: DaneDzialki,
  sasiedztwo: SasiedztwoDane,
  mpzp: "jest" | "brak" | "nieznane",
  forma: FormaZabudowy,
  cfg: KonfiguracjaPoziom1
): PojemnoscForma {
  const p = prognozaPotencjalu({
    powierzchniaM2: d.powierzchniaM2,
    zwartosc: d.zwartoscKsztaltu ?? null,
    minSzerokoscM: d.minSzerokoscM ?? d.frontM ?? null,
    sasiedztwo,
    mpzp,
    metrazSredniM2: cfg.metrazSredniM2,
    wspolczynnikEfektywnosci: cfg.wspolczynnikEfektywnosci,
    cfg: cfg.potencjal,
    forma,
    maxKondygnacje: forma === "niska" ? cfg.bramka.maxKondygnacjeNiska : undefined,
    udzialWspolne: cfg.bramka.udzialWspolne[forma],
    udzialUslugi: cfg.bramka.udzialUslugi,
  });
  const powCalkowitaM2 = Math.round(p.powierzchniaZabudowyM2 * p.szacowaneKondygnacje);
  return {
    forma,
    kondygnacje: p.szacowaneKondygnacje,
    powZabudowyM2: p.powierzchniaZabudowyM2,
    powCalkowitaM2,
    puM2: Math.round(powCalkowitaM2 * cfg.wspolczynnikEfektywnosci),
    pumM2: p.pumM2,
    mieszkania: p.mieszkania,
    // „Skala" bramki = liczba lokali dla najmniejszego metrażu (młodzi) — górna, orientacyjna.
    lokali: p.mieszkania.mlodzi,
  };
}

const OPIS_FORMY: Record<FormaZabudowy, string> = {
  niska: "niska (do 2 kondygnacji)",
  wysoka: "wysoka (powyżej 2 kondygnacji)",
};

/**
 * Bramka wielkości/kształtu. `sasiedztwo` i `mpzp` są przekazywane z P1, by obie
 * formy liczyły się na tym samym sygnale co reszta prognozy.
 */
export function liczBramkeWielkosci(
  d: DaneDzialki,
  sasiedztwo: SasiedztwoDane,
  mpzp: "jest" | "brak" | "nieznane",
  cfg: KonfiguracjaPoziom1 = KONFIG_POZIOM1
): BramkaWielkosci {
  const b = cfg.bramka;
  const niska = pojemnoscFormy(d, sasiedztwo, mpzp, "niska", cfg);
  const wysoka = pojemnoscFormy(d, sasiedztwo, mpzp, "wysoka", cfg);
  const lokali = { niska: niska.lokali, wysoka: wysoka.lokali };

  // ── 1. Fizyczna wykonalność ─────────────────────────────────────────────────
  // Nie mieści się nawet minimalna niska zabudowa (0 lokali) lub działka za wąska.
  const szer = d.minSzerokoscM ?? d.frontM ?? null;
  const zaWaska = szer != null && szer < b.minSzerokoscBudowlanaM;
  const fizycznieWykonalna = niska.mieszkania.mlodzi >= 1 && !zaWaska;

  if (!fizycznieWykonalna) {
    // Za mała powierzchniowo (nie kształtem) i mieszcząca się w progu scalenia → sugeruj scalenie.
    const scalenie = !zaWaska && d.powierzchniaM2 > 0 && d.powierzchniaM2 < b.progScalenieM2;
    return {
      wynik: scalenie ? "scalenie" : "nieprzydatna",
      komunikat: scalenie
        ? "Ta działka jest zbyt mała samodzielnie, ale sąsiaduje z innymi — połączenie z sąsiednimi mogłoby spełnić wymagania."
        : "Ta działka jest zbyt mała lub zbyt wąska, by posadowić zabudowę — nie nadaje się pod budownictwo społeczne.",
      fizycznieWykonalna: false,
      formaRekomendowana: "niska",
      niska,
      wysoka,
      lokali,
      ponizejProguOplacalnosci: true,
      progOplacalnosci: b.progOplacalnosciNiska,
      konfliktProgow: false,
    };
  }

  // ── 2. Forma rekomendowana = najefektywniejsza (najwięcej lokali) ────────────
  // Ten sam footprint: wysoka ma ≥ kondygnacji niskiej, więc zwykle ≥ lokali; przy remisie
  // (sąsiedztwo niskie, ≤2 kond.) rekomendujemy niską — tańszą i prostszą do uzgodnienia.
  const formaRekomendowana: FormaZabudowy = wysoka.lokali > niska.lokali ? "wysoka" : "niska";
  const progRek = formaRekomendowana === "wysoka" ? b.progOplacalnosciWysoka : b.progOplacalnosciNiska;
  const rek = formaRekomendowana === "wysoka" ? wysoka : niska;

  // ── 3. Próg opłacalności (miękki punkt decyzyjny) ───────────────────────────
  const rekPonizej = rek.lokali < progRek;
  // Konflikt: rekomendowana (wysoka) poniżej swojego progu, ale niska w swoim progu.
  const konflikt =
    rekPonizej && formaRekomendowana === "wysoka" && niska.lokali >= b.progOplacalnosciNiska;

  if (konflikt) {
    return {
      wynik: "konflikt",
      komunikat:
        `Forma wysoka: więcej lokali (${wysoka.lokali}), ale poniżej typowego progu opłacalności ` +
        `(${b.progOplacalnosciWysoka}). Forma niska: mniej lokali (${niska.lokali}), ale w progu ` +
        `(${b.progOplacalnosciNiska}). W którym kierunku analizować?`,
      fizycznieWykonalna: true,
      formaRekomendowana,
      niska,
      wysoka,
      lokali,
      ponizejProguOplacalnosci: true,
      progOplacalnosci: progRek,
      konfliktProgow: true,
      notaSkali: `Forma wysoka poniżej typowego progu opłacalności (${wysoka.lokali} lokali).`,
    };
  }

  if (rekPonizej) {
    return {
      wynik: "nizsza_oplacalnosc",
      komunikat:
        `Wstępnie możliwa skala zabudowy na tej działce (${rek.lokali} lokali) jest mniejsza niż ` +
        `typowa dla opłacalnej inwestycji społecznej (${progRek}). Czy przeprowadzić pełną analizę?`,
      fizycznieWykonalna: true,
      formaRekomendowana,
      niska,
      wysoka,
      lokali,
      ponizejProguOplacalnosci: true,
      progOplacalnosci: progRek,
      konfliktProgow: false,
      notaSkali: `Skala poniżej typowego progu opłacalności (${rek.lokali} lokali).`,
    };
  }

  return {
    wynik: "ok",
    komunikat: `Rekomendowana forma zabudowy: ${OPIS_FORMY[formaRekomendowana]} — orientacyjnie ${rek.lokali} lokali.`,
    fizycznieWykonalna: true,
    formaRekomendowana,
    niska,
    wysoka,
    lokali,
    ponizejProguOplacalnosci: false,
    progOplacalnosci: progRek,
    konfliktProgow: false,
  };
}
