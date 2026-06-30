import { NextResponse } from "next/server";
import { WOJEWODZTWA, powiaty, gminy, obreby, terytGminy } from "@/lib/teryt";

/**
 * Kaskada TERYT — podpowiedzi z mini-słownika.
 *
 * Uwaga: ULDK NIE udostępnia API do listowania jednostek administracyjnych
 * (obsługuje pobranie po identyfikatorze, np. GetParcelById). Dlatego pełna
 * kaskada dla całej Polski nie może być zasilana z ULDK — tu podajemy
 * podpowiedzi ze słownika lokalnego, a dla dowolnej działki najpewniejszy jest
 * tryb „Identyfikator ULDK". (Docelowo: statyczny słownik TERYT lub TERYT z GUS.)
 *
 * GET /api/teryt?poziom=wojewodztwa|powiaty|gminy|obreby&wojNazwa=&powiatNazwa=&gminaNazwa=
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const poziom = u.searchParams.get("poziom");
  const wojNazwa = u.searchParams.get("wojNazwa") ?? "";
  const powiatNazwa = u.searchParams.get("powiatNazwa") ?? "";
  const gminaNazwa = u.searchParams.get("gminaNazwa") ?? "";

  if (poziom === "wojewodztwa") {
    return NextResponse.json({ pozycje: WOJEWODZTWA.map((w) => ({ teryt: w.kod, nazwa: w.nazwa })), zrodlo: "slownik" });
  }
  if (poziom === "powiaty") {
    return NextResponse.json({ pozycje: powiaty(wojNazwa).map((n) => ({ teryt: "", nazwa: n })), zrodlo: "slownik" });
  }
  if (poziom === "gminy") {
    const lista = gminy(wojNazwa, powiatNazwa).map((n) => ({ teryt: terytGminy(wojNazwa, powiatNazwa, n) ?? "", nazwa: n }));
    return NextResponse.json({ pozycje: lista, zrodlo: "slownik" });
  }
  if (poziom === "obreby") {
    return NextResponse.json({ pozycje: obreby(wojNazwa, powiatNazwa, gminaNazwa).map((n) => ({ teryt: n, nazwa: n })), zrodlo: "slownik" });
  }
  return NextResponse.json({ blad: "Nieznany poziom kaskady." }, { status: 400 });
}
