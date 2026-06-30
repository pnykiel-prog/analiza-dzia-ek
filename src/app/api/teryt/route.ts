import { NextResponse } from "next/server";
import { pobierzWojewodztwa, pobierzPowiaty, pobierzGminy, pobierzObreby } from "@/lib/data/uldk";
import { WOJEWODZTWA, powiaty, gminy, obreby, terytGminy } from "@/lib/teryt";

/**
 * Kaskada TERYT. Próbuje ULDK (realne kody dla całej Polski); przy braku
 * odpowiedzi (np. blokada egress / ULDK niedostępny) wraca do mini-słownika.
 *
 * GET /api/teryt?poziom=wojewodztwa
 * GET /api/teryt?poziom=powiaty&wojTeryt=14&wojNazwa=mazowieckie
 * GET /api/teryt?poziom=gminy&powiatTeryt=1418&wojNazwa=...&powiatNazwa=...
 * GET /api/teryt?poziom=obreby&gminaTeryt=146509_8&wojNazwa=...&powiatNazwa=...&gminaNazwa=...
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const poziom = u.searchParams.get("poziom");
  const wojTeryt = u.searchParams.get("wojTeryt") ?? "";
  const powiatTeryt = u.searchParams.get("powiatTeryt") ?? "";
  const gminaTeryt = u.searchParams.get("gminaTeryt") ?? "";
  const wojNazwa = u.searchParams.get("wojNazwa") ?? "";
  const powiatNazwa = u.searchParams.get("powiatNazwa") ?? "";
  const gminaNazwa = u.searchParams.get("gminaNazwa") ?? "";

  try {
    if (poziom === "wojewodztwa") {
      const z = await pobierzWojewodztwa();
      if (z.length) return NextResponse.json({ pozycje: z, zrodlo: "uldk" });
      return NextResponse.json({ pozycje: WOJEWODZTWA.map((w) => ({ teryt: w.kod, nazwa: w.nazwa })), zrodlo: "fallback" });
    }
    if (poziom === "powiaty") {
      if (wojTeryt) {
        const z = await pobierzPowiaty(wojTeryt);
        if (z.length) return NextResponse.json({ pozycje: z, zrodlo: "uldk" });
      }
      return NextResponse.json({ pozycje: powiaty(wojNazwa).map((n) => ({ teryt: "", nazwa: n })), zrodlo: "fallback" });
    }
    if (poziom === "gminy") {
      if (powiatTeryt) {
        const z = await pobierzGminy(powiatTeryt);
        if (z.length) return NextResponse.json({ pozycje: z, zrodlo: "uldk" });
      }
      const lista = gminy(wojNazwa, powiatNazwa).map((n) => ({ teryt: terytGminy(wojNazwa, powiatNazwa, n) ?? "", nazwa: n }));
      return NextResponse.json({ pozycje: lista, zrodlo: "fallback" });
    }
    if (poziom === "obreby") {
      if (gminaTeryt) {
        const z = await pobierzObreby(gminaTeryt);
        if (z.length) return NextResponse.json({ pozycje: z, zrodlo: "uldk" });
      }
      return NextResponse.json({ pozycje: obreby(wojNazwa, powiatNazwa, gminaNazwa).map((n) => ({ teryt: n, nazwa: n })), zrodlo: "fallback" });
    }
    return NextResponse.json({ blad: "Nieznany poziom kaskady." }, { status: 400 });
  } catch {
    // Twardy fallback do mini-słownika dla pierwszego poziomu.
    if (poziom === "wojewodztwa") {
      return NextResponse.json({ pozycje: WOJEWODZTWA.map((w) => ({ teryt: w.kod, nazwa: w.nazwa })), zrodlo: "fallback" });
    }
    return NextResponse.json({ pozycje: [], zrodlo: "fallback" });
  }
}
