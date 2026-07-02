import { NextResponse } from "next/server";
import { KONFIG_KONEKTORY } from "@/lib/data/connectorsConfig";
import { konektorGUS } from "@/lib/data/connectors/gus";
import type { Teren } from "@/lib/data/connectors/types";

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
  const gmina = u.searchParams.get("gmina") ?? "Rzeszów";
  const woj = u.searchParams.get("woj") ?? "";
  const gus = KONFIG_KONEKTORY.gus;

  const teren: Teren = {
    id: "diag", teryt: "", wojewodztwo: woj, powiat: "", gmina,
    centroid2180: null, centroid4326: null, wktList: [], powierzchniaM2: 0,
  };

  const wynik = await konektorGUS.pobierz(teren);
  const dane = wynik.dane ?? {};
  const liczbaPol = Object.keys(dane).length;

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
    dane, // udzial2039Pct, udzial65PlusPct, bezrobociePct, trend65Plus, trendLudnosc, saldoMigracjiMlodzi, …
    debug: wynik.debug ?? null,
    wniosek,
  };

  // Maskujemy klucz API w całej odpowiedzi (diagnostyka bywa wklejana).
  let txt = JSON.stringify(diag, null, 2);
  if (gus.clientId) txt = txt.split(gus.clientId).join("***");
  return new NextResponse(txt, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}
