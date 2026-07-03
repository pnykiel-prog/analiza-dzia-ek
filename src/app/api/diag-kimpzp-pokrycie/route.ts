import { NextResponse } from "next/server";
import { wgs84ToPl1992 } from "@/lib/geo";
import { sondaKimpzp, type SygnalKimpzp } from "@/lib/data/connectors/kimpzp";

/**
 * Diagnostyka POKRYCIA KIMPZP — sonduje krajowy serwis w centrach największych
 * miast i wskazuje „dziury" (jak Warszawa): pusto mimo pewnego MPZP → potrzebny
 * lokalny fallback WMS. Łagodna równoległość (KIMPZP dławi serie zapytań).
 *
 * Użycie:
 *   GET /api/diag-kimpzp-pokrycie                      — pełny skan (24 miasta)
 *   GET /api/diag-kimpzp-pokrycie?miasta=Kraków,Łódź   — tylko wybrane (rzetelnie)
 *   GET /api/diag-kimpzp-pokrycie?raw=1                — dołącz surową odpowiedź (do parsera)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(obj: unknown): NextResponse {
  return new NextResponse(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const MIASTA: { nazwa: string; lon: number; lat: number }[] = [
  { nazwa: "Warszawa", lon: 21.012, lat: 52.23 },
  { nazwa: "Kraków", lon: 19.937, lat: 50.061 },
  { nazwa: "Łódź", lon: 19.456, lat: 51.759 },
  { nazwa: "Wrocław", lon: 17.038, lat: 51.107 },
  { nazwa: "Poznań", lon: 16.925, lat: 52.406 },
  { nazwa: "Gdańsk", lon: 18.646, lat: 54.352 },
  { nazwa: "Szczecin", lon: 14.552, lat: 53.428 },
  { nazwa: "Bydgoszcz", lon: 18.008, lat: 53.123 },
  { nazwa: "Toruń", lon: 18.598, lat: 53.013 },
  { nazwa: "Lublin", lon: 22.567, lat: 51.246 },
  { nazwa: "Białystok", lon: 23.169, lat: 53.132 },
  { nazwa: "Katowice", lon: 19.02, lat: 50.259 },
  { nazwa: "Kielce", lon: 20.628, lat: 50.866 },
  { nazwa: "Olsztyn", lon: 20.489, lat: 53.778 },
  { nazwa: "Rzeszów", lon: 21.999, lat: 50.041 },
  { nazwa: "Opole", lon: 17.933, lat: 50.667 },
  { nazwa: "Zielona Góra", lon: 15.506, lat: 51.935 },
  { nazwa: "Gorzów Wielkopolski", lon: 15.238, lat: 52.734 },
  { nazwa: "Częstochowa", lon: 19.12, lat: 50.811 },
  { nazwa: "Radom", lon: 21.147, lat: 51.402 },
  { nazwa: "Sosnowiec", lon: 19.13, lat: 50.286 },
  { nazwa: "Gdynia", lon: 18.53, lat: 54.519 },
  { nazwa: "Bielsko-Biała", lon: 19.045, lat: 49.822 },
  { nazwa: "Gliwice", lon: 18.665, lat: 50.294 },
];

/** Mapowanie z ograniczoną równoległością (pula workerów) — łagodne dla WMS. */
async function mapaOgraniczona<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const wyniki = new Array<R>(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      wyniki[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return wyniki;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// Ranking sygnałów (mniejszy = lepszy dowód pokrycia). Do łączenia wielu punktów.
const RANGA: Record<SygnalKimpzp, number> = {
  plan: 0,
  serwis_bez_planu: 1,
  brak_serwisu: 2,
  blad_serwisu: 3,
  pusto: 4,
  niejasne: 5,
  blad: 6,
};
// Punkt centrum niekiedy trafia poza plan (fałszywe „pusto") — dosondowanie w pobliżu.
const PRZESUNIECIA: [number, number][] = [
  [0, 0],
  [0.012, 0.01],
  [-0.012, -0.01],
];

function ocena(sygnal: SygnalKimpzp): "pokryte" | "dziura" | "niejednoznaczne" | "blad" {
  if (sygnal === "plan" || sygnal === "serwis_bez_planu") return "pokryte";
  if (sygnal === "brak_serwisu" || sygnal === "blad_serwisu") return "dziura";
  if (sygnal === "blad") return "blad";
  return "niejednoznaczne";
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get("raw") === "1";
  const filtr = (u.searchParams.get("miasta") ?? "").split(",").map((s) => norm(s.trim())).filter(Boolean);
  const lista = filtr.length ? MIASTA.filter((m) => filtr.includes(norm(m.nazwa))) : MIASTA;
  const rownolegle = 4;

  const wyniki = await mapaOgraniczona(lista, rownolegle, async (m) => {
    // Punkt centrum; jeśli sygnał niejednoznaczny (pusto/niejasne/blad) — dosondowanie okolicy.
    const [x0, y0] = wgs84ToPl1992(m.lon, m.lat);
    let best = await sondaKimpzp(x0, y0, { timeoutMs: 8000, proby: 2, raw });
    if (RANGA[best.sygnal] >= 4) {
      for (const [dLat, dLon] of PRZESUNIECIA.slice(1)) {
        const [x, y] = wgs84ToPl1992(m.lon + dLon, m.lat + dLat);
        const s = await sondaKimpzp(x, y, { timeoutMs: 8000, proby: 1, raw });
        if (RANGA[s.sygnal] < RANGA[best.sygnal]) best = s;
        if (best.sygnal === "plan" || best.sygnal === "serwis_bez_planu") break;
      }
    }
    return {
      miasto: m.nazwa,
      ocena: ocena(best.sygnal),
      sygnal: best.sygnal,
      przeznaczenie: best.przeznaczenie,
      symbol: best.symbol ?? null,
      ...(raw ? { raw: best.raw } : {}),
    };
  });

  const grupy = (o: string) => wyniki.filter((w) => w.ocena === o).map((w) => w.miasto);
  const dziury = grupy("dziura");
  return json({
    opis: "Sonda pokrycia KIMPZP — klasyfikacja po komunikatach serwisu, dosondowanie okolicy przy pustych.",
    sprawdzono: lista.length,
    liczbaDziur: dziury.length,
    dziury, // brak serwisu / integracja zepsuta → potrzebny lokalny fallback WMS
    pokryte: grupy("pokryte"), // serwis gminy odpowiada (jest plan lub „brak wyniku w punkcie")
    niejednoznaczne: grupy("niejednoznaczne"), // pusto/niejasne mimo dosondowania — sprawdź ręcznie
    blad: grupy("blad"),
    wyniki,
    uwaga: "Dziura = 'brak serwisu' albo błąd renderowania KIMPZP. Pokryte = serwis odpowiada. Dodaj ?raw=1 dla surowych odpowiedzi; ?miasta=A,B dla podzbioru.",
  });
}
