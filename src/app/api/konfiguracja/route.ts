import { NextResponse } from "next/server";
import { domyslnaKonfiguracja } from "@/lib/config";
import { KATALOG_ZRODEL } from "@/lib/data/adapters";

/** Domyślna konfiguracja (parametry edytowalne) + katalog źródeł danych. */
export async function GET() {
  return NextResponse.json({
    konfiguracja: domyslnaKonfiguracja(),
    zrodla: KATALOG_ZRODEL,
  });
}
