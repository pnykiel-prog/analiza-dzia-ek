import { NextResponse } from "next/server";
import { pobierzDaneDzialki, raportPokrycia } from "@/lib/data/service";
import { uruchomAnalize } from "@/lib/engine";
import type { Konfiguracja } from "@/lib/config";

/**
 * End-to-end analiza działki: Działka → P1 → P2 → P3.
 * GET  — z domyślną konfiguracją.
 * POST — z konfiguracją nadesłaną z edytora (override progów/wag/reżimów).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return analizuj(decodeURIComponent(params.id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let konfig: Partial<Konfiguracja> | undefined;
  try {
    const body = await req.json();
    konfig = body?.konfiguracja;
  } catch {
    konfig = undefined;
  }
  return analizuj(decodeURIComponent(params.id), konfig);
}

async function analizuj(id: string, konfig?: Partial<Konfiguracja>) {
  const dane = await pobierzDaneDzialki(id);
  if (!dane) {
    return NextResponse.json({ blad: `Nie znaleziono działki o identyfikatorze ${id}` }, { status: 404 });
  }
  const wynik = uruchomAnalize(dane, konfig);
  const pokrycie = raportPokrycia(dane);
  return NextResponse.json({ ...wynik, pokrycie });
}
