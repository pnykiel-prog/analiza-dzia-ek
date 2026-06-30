import { NextResponse } from "next/server";
import { rozwiazDzialki, medianaRegionalna } from "@/lib/data/resolver";
import type { PozycjaDzialki } from "@/lib/teryt";

/**
 * Rozwiązuje pozycje identyfikacyjne (TERYT + numer) w scalony „teren inwestycji".
 * Pobiera dane automatyczne (provider przykładowy), waliduje istnienie i
 * przyleganie, zwraca scalone dane + metadane (pola auto, N rynkowe, błędy).
 */
export async function POST(req: Request) {
  let body: { pozycje?: PozycjaDzialki[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ blad: "Nieprawidłowy JSON." }, { status: 400 });
  }
  const pozycje = body?.pozycje;
  if (!Array.isArray(pozycje) || pozycje.length === 0) {
    return NextResponse.json({ blad: "Brak pozycji identyfikacyjnych." }, { status: 400 });
  }

  const wynik = await rozwiazDzialki(pozycje);
  const woj = wynik.dane?.wojewodztwo || pozycje[0]?.wojewodztwo || "";
  const gmina = wynik.dane?.gmina || pozycje[0]?.gmina || "";
  return NextResponse.json({ ...wynik, medianaRegionalna: medianaRegionalna(woj, gmina) });
}
