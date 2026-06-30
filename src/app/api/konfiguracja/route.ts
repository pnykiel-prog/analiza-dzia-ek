import { NextResponse } from "next/server";
import { domyslnaKonfiguracja } from "@/lib/config";
import { KATALOG_ZRODEL } from "@/lib/data/adapters";
import { WARTOSC_ODTWORZENIOWA, MEDIANA_RYNKOWA } from "@/lib/config-rynek";

/** Domyślna konfiguracja (parametry edytowalne) + katalog źródeł danych + tabele M3. */
export async function GET() {
  return NextResponse.json({
    konfiguracja: domyslnaKonfiguracja(),
    zrodla: KATALOG_ZRODEL,
    wartoscOdtworzeniowa: WARTOSC_ODTWORZENIOWA,
    medianaRynkowa: MEDIANA_RYNKOWA,
  });
}
