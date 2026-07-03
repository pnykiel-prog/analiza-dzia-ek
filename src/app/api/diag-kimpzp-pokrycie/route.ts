import { NextResponse } from "next/server";
import { wgs84ToPl1992 } from "@/lib/geo";
import { sondaKimpzp } from "@/lib/data/connectors/kimpzp";

/**
 * Diagnostyka POKRYCIA KIMPZP — sonduje krajowy serwis w centrach największych
 * miast (miasta na prawach powiatu / stolice województw) i wskazuje „dziury"
 * (jak Warszawa): miejsca, gdzie KIMPZP zwraca pusto mimo pewnego istnienia MPZP.
 * To sygnał, gdzie potrzebny jest dedykowany fallback (lokalny WMS gminy).
 *
 * Użycie:  GET /api/diag-kimpzp-pokrycie
 * Bezpieczne: tylko odczyt publicznego WMS.
 */
function json(obj: unknown): NextResponse {
  return new NextResponse(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Największe miasta (centra) — lon, lat (WGS84). Centrum gęstej zabudowy niemal
// zawsze objęte MPZP → pusty wynik = luka pokrycia krajowego KIMPZP dla tego miasta.
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

export async function GET() {
  const wyniki = await Promise.all(
    MIASTA.map(async (m) => {
      const [x, y] = wgs84ToPl1992(m.lon, m.lat);
      const s = await sondaKimpzp(x, y);
      return { miasto: m.nazwa, status: s.status, przeznaczenie: s.przeznaczenie, symbol: s.symbol ?? null };
    })
  );
  const dziury = wyniki.filter((w) => w.status === "pusto").map((w) => w.miasto);
  const niejasne = wyniki.filter((w) => w.status === "niejasne").map((w) => w.miasto);
  const blad = wyniki.filter((w) => w.status === "blad").map((w) => w.miasto);
  const maPlany = wyniki.filter((w) => w.status === "ma_plany").map((w) => w.miasto);

  return json({
    opis: "Sonda pokrycia KIMPZP w centrach największych miast (1 punkt/miasto).",
    sprawdzono: MIASTA.length,
    liczbaDziur: dziury.length,
    dziury, // miasta jak Warszawa — pusto mimo pewnego MPZP → potrzebny lokalny fallback
    niejasne, // treść bez rozpoznanej metryki (raster/nietypowy format) — do sprawdzenia ręcznie
    blad, // serwis nie odpowiedział — spróbuj ponownie
    maPlany, // KIMPZP realnie zwraca MPZP
    wyniki,
    uwaga:
      "Sonda pojedynczego punktu (centrum). Wynik 'pusto' w centrum dużego miasta silnie wskazuje lukę pokrycia; " +
      "'ma_plany' potwierdza działanie. Małe gminy są zwykle objęte krajowym KIMPZP i nie są tu sondowane.",
  });
}
