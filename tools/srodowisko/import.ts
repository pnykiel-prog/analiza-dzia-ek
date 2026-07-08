/**
 * Importer warstw środowiskowych (bramka E) → `src/lib/data/srodowisko_dane.json`.
 * URUCHAMIANY POZA APLIKACJĄ (wg cyklu danych: powódź ~6 lat, ochrona sporadycznie).
 * Przyjmuje eksporty GeoJSON per warstwa (w EPSG:4326 [lon,lat]) i składa atomowy
 * snapshot. Normalizuje do lekkiej postaci: { type, properties{typ,nazwa}, geometry }.
 *
 * Źródła (WFS, GetFeature → outputFormat=application/json&srsName=EPSG:4326):
 *   Powódź MZP/MRP (Q10/Q1/Q0,2%): https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WFS
 *   Ochrona przyrody (Natura 2000, parki, rezerwaty, OChK): https://sdi.gdos.gov.pl/wfs
 *   Osuwiska (SOPO): endpoint PIG-PIB do weryfikacji.
 *
 * Redukcja rozmiaru (WAŻNE — bundling JSON): przed importem warto uprościć
 * geometrie (np. mapshaper `-simplify 5% keep-shapes`) i przyciąć do potrzebnych pól.
 *
 * Użycie:
 *   npx tsx tools/srodowisko/import.ts \
 *     --powodz-q10 q10.geojson --powodz-q1 q1.geojson --powodz-q02 q02.geojson \
 *     --ochrona ochrona.geojson --osuwiska osuwiska.geojson   (flagi: --out)
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/srodowisko_dane.json");
const args = process.argv.slice(2);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const DATA = new Date().toISOString().slice(0, 10);

const MAPA_FLAG: Record<string, string> = {
  "--powodz-q10": "powodz_q10",
  "--powodz-q1": "powodz_q1",
  "--powodz-q02": "powodz_q02",
  "--ochrona": "ochrona_przyrody",
  "--osuwiska": "osuwiska",
};

interface FeatureGeo { type: string; properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } }

/** Najlepsza dostępna nazwa cechy (różne schematy WFS). */
function nazwaCechy(p: Record<string, unknown> = {}): string {
  for (const k of ["nazwa", "name", "NAZWA", "NAME", "sitename", "nazwa_obsz"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "strefa";
}

function wczytajWarstwe(plik: string): FeatureGeo[] {
  const json = JSON.parse(readFileSync(resolve(plik), "utf8")) as { features?: FeatureGeo[] };
  const out: FeatureGeo[] = [];
  for (const f of json.features ?? []) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    out.push({ type: "Feature", properties: { nazwa: nazwaCechy(f.properties) }, geometry: g });
  }
  return out;
}

function main() {
  const warstwy: Record<string, { type: "FeatureCollection"; features: FeatureGeo[] }> = {
    powodz_q10: { type: "FeatureCollection", features: [] },
    powodz_q1: { type: "FeatureCollection", features: [] },
    powodz_q02: { type: "FeatureCollection", features: [] },
    ochrona_przyrody: { type: "FeatureCollection", features: [] },
    osuwiska: { type: "FeatureCollection", features: [] },
  };
  let jakiekolwiek = false;
  for (const [flaga, klucz] of Object.entries(MAPA_FLAG)) {
    const plik = wartosc(flaga);
    if (!plik) continue;
    warstwy[klucz].features = wczytajWarstwe(plik);
    jakiekolwiek = true;
    console.log(`${klucz}: ${warstwy[klucz].features.length} cech z ${plik}`);
  }
  if (!jakiekolwiek) {
    console.error("Podaj co najmniej jedną warstwę: --powodz-q10/-q1/-q02, --ochrona, --osuwiska (pliki GeoJSON w EPSG:4326). Opcje: --out");
    process.exit(2);
  }

  const wynik = {
    meta: {
      opis: "Warstwy środowiskowe (bramka E) — przecięcie geometrii działki ze strefą. Import z WFS (ISOK/GDOŚ/SOPO).",
      data_importu: DATA,
      zrodla: ["ISOK/Wody Polskie (WFS)", "GDOŚ Geoserwis (WFS)", "PIG-PIB/SOPO (WFS)"],
      uwaga: "Wynik = flaga przesiewowa, NIE rozstrzygnięcie prawne. Warstwa niezaładowana → do weryfikacji (CAP na warunkową).",
    },
    warstwy,
  };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify(wynik));
  renameSync(tmp, OUT);
  console.log(`Zapisano snapshot środowiskowy → ${OUT}`);
}

main();
