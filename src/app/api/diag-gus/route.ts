import { NextResponse } from "next/server";
import { KONFIG_KONEKTORY } from "@/lib/data/connectorsConfig";
import { konektorGUS, diagJednostki, diagZmienne } from "@/lib/data/connectors/gus";
import type { Teren } from "@/lib/data/connectors/types";
import { rozwiazDzialki } from "@/lib/data/resolver";

/** Maskowanie klucza API w dowolnej odpowiedzi diagnostyki. */
function odpowiedz(obj: unknown): NextResponse {
  let txt = JSON.stringify(obj, null, 2);
  const klucz = KONFIG_KONEKTORY.gus.clientId;
  if (klucz) txt = txt.split(klucz).join("***");
  return new NextResponse(txt, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

/**
 * Diagnostyka konektora GUS BDL — pokazuje DOKŁADNIE to, co dostaje aplikacja:
 * wynik `konektorGUS.pobierz` dla podanej gminy. Jedno, jednoznaczne źródło prawdy.
 *
 * Użycie:  GET /api/diag-gus?gmina=Rzeszów&woj=podkarpackie
 *   - `woj` opcjonalne — bez niego mediana wojewódzka użyje fallbacku krajowego
 *     (w aplikacji województwo pochodzi z TERYT/ULDK, więc liczy się automatycznie).
 * Bezpieczne: tylko odczyt publicznego API; klucz API maskowany w odpowiedzi.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const gus = KONFIG_KONEKTORY.gus;

  // TRYB APLIKACJI: podaj identyfikator działki (?id=…) — uruchamiamy DOKŁADNIE ten sam
  // resolver co /nowa i pokazujemy, jaką gminę rozpoznał i czy demografia GUS trafiła do danych.
  // TRYB WYSZUKANIA ZMIENNYCH: ?vars=przeciętne miesięczne wynagrodzenia — pokazuje id/nazwę/jednostkę/poziom,
  // do potwierdzenia właściwej zmiennej (np. wynagrodzenia) i wpisania w gus.zmienneId.
  const vars = u.searchParams.get("vars");
  if (vars) return odpowiedz({ fraza: vars, wyniki: await diagZmienne(vars) });

  // TRYB SUROWYCH JEDNOSTEK: ?units=Warszawa — pokazuje, co BDL zwraca dla units/search
  // (z filtrem poziomu i bez), z id/nazwą/poziomem — do namierzenia właściwej jednostki.
  const units = u.searchParams.get("units");
  if (units) return odpowiedz(await diagJednostki(units));

  const id = u.searchParams.get("id");
  if (id) {
    const r = await rozwiazDzialki([{ wojewodztwo: "", powiat: "", gmina: "", obreb: "", numer: "", idBezposredni: id }]);
    const d = r.dane;
    const gusRaport = r.meta.raportZrodel.find((x) => x.klucz === "GUS_BDL");
    return odpowiedz({
      trybAplikacji: true,
      idWejscie: id,
      rozpoznanaGmina: d?.gmina || "(pusta!)",
      rozpoznaneWojewodztwo: d?.wojewodztwo || "(puste!)",
      powierzchniaM2: d?.powierzchniaM2 ?? null,
      demografia: {
        udzialAktywniPct: d?.udzialAktywniPct ?? null,
        udzial65PlusPct: d?.udzial65PlusPct ?? null,
        medianaAktywniWoj: d?.medianaAktywniWoj ?? null,
        bezrobociePct: d?.bezrobociePct ?? null,
        saldoMigracjiMlodzi: d?.saldoMigracjiMlodzi ?? null,
        liczbaMieszkancowGminy: d?.liczbaMieszkancowGminy ?? null,
        liczbaAktywni: d?.liczbaAktywni ?? null,
        liczba65Plus: d?.liczba65Plus ?? null,
        dochodPrzecietnyGmina: d?.dochodPrzecietnyGmina ?? null,
        udzialGospodarstwBezWlasnosciPct: d?.udzialGospodarstwBezWlasnosciPct ?? null,
        naplywZameldowanNa1000: d?.naplywZameldowanNa1000 ?? null,
        odplywMlodychNa1000: d?.odplywMlodychNa1000 ?? null,
      },
      gusRaport: gusRaport ?? "(konektor GUS nie w raporcie)",
      wniosek:
        d?.udzialAktywniPct != null
          ? "✅ Resolver ma demografię — aplikacja powinna pokazać zróżnicowany werdykt."
          : `❌ Resolver NIE ma demografii. Rozpoznana gmina: „${d?.gmina || ""}". Powód z GUS: ${gusRaport?.debug ?? gusRaport?.status ?? "brak"}.`,
    });
  }

  const gmina = u.searchParams.get("gmina") ?? "Rzeszów";
  const woj = u.searchParams.get("woj") ?? "";

  const teren: Teren = {
    id: "diag", teryt: "", wojewodztwo: woj, powiat: "", gmina,
    centroid2180: null, centroid4326: null, wktList: [], powierzchniaM2: 0,
  };

  const wynik = await konektorGUS.pobierz(teren);
  const dane = wynik.dane ?? {};
  const liczbaPol = Object.keys(dane).length;

  // Diagnostyka doboru zmiennych panelu dynamiki (mieszkania oddane / dochody własne /
  // bezrobotni) — kandydaci z variables/search, do przypięcia potwierdzonych ID.
  const dynFrazy: Record<string, string> = {
    mieszkaniaOddane: gus.zapytania.mieszkaniaOddane,
    dochodyWlasne: gus.zapytania.dochodyWlasne,
    bezrobotni: gus.zapytania.bezrobotniLiczba,
  };
  const diagnostykaDynamiki: Record<string, unknown> = {};
  for (const [k, fraza] of Object.entries(dynFrazy)) {
    diagnostykaDynamiki[k] = { fraza, kandydaci: await diagZmienne(fraza) };
  }

  const wniosek =
    wynik.status === "ok" && liczbaPol >= 4
      ? "✅ GUS DZIAŁA — konektor zwraca komplet demografii (to samo, co dostaje aplikacja). " +
        "Jeśli w /nowa nadal widać baner braku danych, przyczyną jest derywacja nazwy gminy dla KONKRETNEJ działki — podaj jej identyfikator ULDK."
      : wynik.status === "ok"
        ? "⚠ GUS zwraca tylko część danych — patrz pole `dane`."
        : `❌ GUS nie zwrócił danych: ${wynik.debug ?? "brak szczegółów"}`;

  const diag = {
    gmina,
    wojewodztwo: woj || "(nie podano — dodaj &woj=…, aby zweryfikować medianę wojewódzką)",
    clientIdUstawiony: !!gus.clientId,
    rok: gus.rok,
    status: wynik.status,
    liczbaPolDanych: liczbaPol,
    dane, // udzialAktywniPct, udzial65PlusPct, bezrobociePct, trend65Plus, trendLudnosc, saldoMigracjiMlodzi, …
    diagnostykaDynamiki, // kandydaci na ID 3 szeregów panelu dynamiki (do potwierdzenia)
    debug: wynik.debug ?? null,
    wniosek,
  };

  return odpowiedz(diag);
}
