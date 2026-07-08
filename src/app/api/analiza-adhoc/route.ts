import { NextResponse } from "next/server";
import { uruchomAnalize } from "@/lib/engine";
import { raportPokrycia } from "@/lib/data/service";
import type { DaneDzialki } from "@/lib/types";
import type { ProfilFinansowy } from "@/lib/finanse/typy";
import type { Konfiguracja } from "@/lib/config";

/**
 * Analiza ad-hoc dla działki wprowadzonej ręcznie (panel „Nowa analiza").
 * Nie zapisuje danych — liczy pipeline P1→P2→P3 na przesłanym obiekcie.
 */
export async function POST(req: Request) {
  let body: { dane?: Partial<DaneDzialki>; konfiguracja?: Partial<Konfiguracja>; profilFinansowy?: ProfilFinansowy };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ blad: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const dane = body?.dane;
  if (!dane || typeof dane.id !== "string" || !dane.id.trim()) {
    return NextResponse.json({ blad: "Brak identyfikatora działki (pole „id”)." }, { status: 400 });
  }
  if (typeof dane.powierzchniaM2 !== "number" || !(dane.powierzchniaM2 > 0)) {
    return NextResponse.json(
      { blad: "Brak powierzchni działki — nie pobrano geometrii (działka spoza przykładowego ULDK). Podaj powierzchnię ręcznie." },
      { status: 400 }
    );
  }

  const pelne = uzupelnijBraki(dane as DaneDzialki);
  const wynik = uruchomAnalize(pelne, body?.konfiguracja, body?.profilFinansowy);
  const pokrycie = raportPokrycia(pelne);
  return NextResponse.json({ ...wynik, pokrycie });
}

/** Uzupełnia pola opcjonalne wartością null, by silnik dostał kompletny kształt. */
function uzupelnijBraki(d: DaneDzialki): DaneDzialki {
  const baza = {
    teryt: "",
    gmina: "",
    powiat: "",
    wojewodztwo: "",
    statusPlanistyczny: "brak_danych" as const,
    frontM: null,
    proporcjaBokow: null,
    budynkiIstniejace: null,
    klasaUzytku: null,
    gruntLesny: null,
    gruntRolnyKlasaIdoIII: null,
    wskaznikiPlanistyczne: null,
    zabudowaMieszkaniowaWSasiedztwie: null,
    przeznaczenieSprzeczneZMieszkaniowa: null,
    dostepDrogaPubliczna: null,
    sredniSpadekPct: null,
    ryzykoPowodzioweSzczegolne: null,
    osuwisko: null,
    terenGorniczy: null,
    odlegloscDoSieciM: null,
    odlegloscDoZabudowyM: null,
    czasDojazdAglomeracjaMin: null,
    uslugiPodstawowePieszo: null,
    pozWZasiegu: null,
    zlobkiSzkolyWZasiegu: null,
    udzialAktywniPct: null,
    medianaAktywniWoj: null,
    saldoMigracjiMlodzi: null,
    udzial65PlusPct: null,
    trend65Plus: null,
    populacjaStabilna: null,
    trendLudnosc: null,
    bezrobociePct: null,
    liczbaPodmiotowGosp: null,
    natura2000: null,
    ochronaWykluczajaca: null,
    strefaKonserwatorska: null,
    wartoscOdtworzeniowaM2: null,
    czynszRynkowyM2: null,
    cenaNowychM2: null,
    kosztBudowyM2: null,
    cenaGruntu: null,
    pustostanyPct: null,
    dochodyGospDomowe: null,
  };
  return { ...baza, ...d } as DaneDzialki;
}
