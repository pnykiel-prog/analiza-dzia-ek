/**
 * Importer warstwy uciążliwości otoczenia → `src/lib/data/uciazliwosci_dane.json`.
 * URUCHAMIANY POZA APLIKACJĄ (okresowo, 2×/rok). Klasyfikuje eksport Overpass (OSM)
 * na typy: przemysł, kolej, droga szybkiego ruchu, wysypisko/oczyszczalnia, lotnisko.
 * Kanał O — ŁAGODNA KARA (nie bramka). Plik w repo to SEED (pusty).
 *
 * Zapytanie Overpass Turbo (cała PL, eksport „surowe dane OSM"):
 *   [out:json][timeout:900];
 *   area["ISO3166-1"="PL"][admin_level=2]->.pl;
 *   ( nwr(area.pl)[landuse=industrial]; nwr(area.pl)[man_made=works]; nwr(area.pl)[power=plant];
 *     way(area.pl)[railway=rail]; way(area.pl)[highway~"^(motorway|trunk)$"];
 *     nwr(area.pl)[landuse=landfill]; nwr(area.pl)[amenity=waste_transfer_station];
 *     nwr(area.pl)[man_made=wastewater_plant]; nwr(area.pl)[aeroway=aerodrome]; );
 *   out tags center;
 *
 * Użycie: npx tsx tools/uciazliwosci/import.ts --osm ./uciazliwosci.json   (flagi: --out)
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/uciazliwosci_dane.json");
const args = process.argv.slice(2);
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const DATA = new Date().toISOString().slice(0, 10);

type Typ = "uc_przemysl" | "uc_kolej" | "uc_droga" | "uc_wysypisko" | "uc_lotnisko";
interface Obiekt { id: string; typ: Typ; nazwa: string; lat: number; lon: number; zrodlo: "OSM"; data_importu: string }

/** Tag OSM → typ uciążliwości (lub null). */
function typUciazliwosci(t: Record<string, string>): Typ | null {
  if (t.landuse === "industrial" || t.man_made === "works" || t.power === "plant") return "uc_przemysl";
  if (t.railway === "rail") return "uc_kolej";
  if (t.highway === "motorway" || t.highway === "trunk") return "uc_droga";
  if (t.landuse === "landfill" || t.amenity === "waste_transfer_station" || t.man_made === "wastewater_plant") return "uc_wysypisko";
  if (t.aeroway === "aerodrome") return "uc_lotnisko";
  return null;
}

interface ElementOSM { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function main() {
  const osmy = wartosci("--osm");
  if (!osmy.length) { console.error("Podaj --osm <plik.json> (eksport Overpass). Opcje: --out"); process.exit(2); }

  const rekordy: Obiekt[] = [];
  const widziane = new Set<string>();
  for (const plik of osmy) {
    const json = JSON.parse(readFileSync(resolve(plik), "utf8")) as { elements?: ElementOSM[] };
    for (const e of json.elements ?? []) {
      const t = e.tags ?? {};
      const typ = typUciazliwosci(t);
      if (!typ) continue;
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      const id = `OSM:${e.type}:${e.id}`;
      if (widziane.has(id)) continue;
      widziane.add(id);
      rekordy.push({ id, typ, nazwa: t.name ?? typ, lat, lon, zrodlo: "OSM", data_importu: DATA });
    }
  }

  const liczby: Record<string, number> = {};
  for (const r of rekordy) liczby[r.typ] = (liczby[r.typ] ?? 0) + 1;

  const wynik = {
    meta: {
      opis: "Statyczna warstwa uciążliwości otoczenia (kanał O — łagodna kara). Import z OSM (Overpass).",
      data_importu: DATA,
      zrodla: ["OSM"],
      liczby,
      uwaga: "Kara łagodna (modyfikator), nie bramka. Brak danych → kanał O neutralny.",
    },
    rekordy,
  };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify(wynik));
  renameSync(tmp, OUT);
  console.log(`Zapisano ${rekordy.length} uciążliwości → ${OUT}`);
  console.log("Rozkład:", JSON.stringify(liczby));
}

main();
