import { NextResponse } from "next/server";
import { pobierzDzialkePoId } from "@/lib/data/uldk";
import { centroid } from "@/lib/geo";
import { diagKimpzp } from "@/lib/data/connectors/kimpzp";

/**
 * Diagnostyka konektora KIMPZP (Krajowa Integracja MPZP, WMS GUGiK).
 * Pokazuje, co serwis krajowy zwraca dla KONKRETNEJ działki: URL zapytania,
 * użyty format, rozpoznane przeznaczenie i surową odpowiedź (fragment).
 *
 * Użycie:  GET /api/diag-kimpzp?id=186301_1.0216.817/7
 * Bezpieczne: tylko odczyt publicznego WMS.
 */
function json(obj: unknown): NextResponse {
  return new NextResponse(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ blad: "Podaj identyfikator działki: ?id=186301_1.0216.817/7" });

  const u = await pobierzDzialkePoId(id);
  if (!u || !u.geomWkt) {
    return json({ id, blad: "ULDK nie zwrócił geometrii dla tego identyfikatora — bez geometrii nie odpytamy KIMPZP." });
  }
  const c = centroid(u.geomWkt);
  if (!c) return json({ id, blad: "Nie udało się wyliczyć centroidu z geometrii." });

  const diag = await diagKimpzp(c[0], c[1]);
  const wniosek =
    diag.surowa == null
      ? "❌ KIMPZP nie zwróciło treści (prawdopodobnie gmina rastrowa bez atrybutów albo serwis niedostępny). Silnik potraktuje to jako do-weryfikacji, nie wykluczone."
      : diag.przeznaczenie
        ? `✅ KIMPZP zwróciło atrybuty — rozpoznane przeznaczenie: ${diag.przeznaczenie}. To gmina wektorowa.`
        : "⚠ KIMPZP zwróciło treść, ale heurystyka nie rozpoznała przeznaczenia — patrz `surowaOdpowiedz` (można dostroić parser).";

  return json({
    id,
    gmina: u.gmina,
    powiat: u.powiat,
    wojewodztwo: u.wojewodztwo,
    powierzchniaM2: u.powierzchniaM2,
    centroid2180: c,
    formatUzyty: diag.formatUzyty,
    dlugoscOdpowiedzi: diag.dlugosc,
    rozpoznanePrzeznaczenie: diag.przeznaczenie ?? "(nie rozpoznano)",
    kimpzpUrl: diag.url,
    surowaOdpowiedz: diag.surowa,
    wniosek,
  });
}
