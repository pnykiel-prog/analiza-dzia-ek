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
  const maMetryke = diag.metryka && (diag.metryka.symbol || diag.metryka.standard);
  const wniosek =
    diag.surowa == null
      ? "❌ Serwis nie zwrócił treści (niedostępny). Silnik potraktuje to jako do-weryfikacji, nie wykluczone."
      : maMetryke
        ? `✅ Gmina WEKTOROWA — KIMPZP realnie pobiera MPZP: symbol ${diag.metryka!.symbol ?? diag.metryka!.standard}, przeznaczenie ${diag.przeznaczenie ?? "?"}.`
        : diag.pusty
          ? "⚠ Pusty wynik — w tym punkcie KIMPZP nie ma planu (możliwa luka pokrycia krajowego, np. Warszawa). Do weryfikacji, nie wykluczone."
          : "⚠ Jest treść, ale bez rozpoznanej metryki (raster/nietypowy format) — patrz surowaOdpowiedz.";

  return json({
    id,
    gmina: u.gmina,
    powiat: u.powiat,
    wojewodztwo: u.wojewodztwo,
    powierzchniaM2: u.powierzchniaM2,
    centroid2180: c,
    formatUzyty: diag.formatUzyty,
    dlugoscOdpowiedzi: diag.dlugosc,
    pustyWynik: diag.pusty,
    rozpoznanePrzeznaczenie: diag.przeznaczenie ?? "(nie rozpoznano)",
    metrykaPlanu: diag.metryka,
    kimpzpUrl: diag.url,
    surowaOdpowiedz: diag.surowa,
    wniosek,
  });
}
