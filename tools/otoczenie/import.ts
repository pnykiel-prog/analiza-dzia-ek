/**
 * Importer warstwy otoczenia / jakości życia → `src/lib/data/otoczenie_dane.json`.
 * URUCHAMIANY POZA APLIKACJĄ (okresowo). Klasyfikuje eksport Overpass (OSM) na 4 kategorie:
 *   zielen (park/las/rekreacja), plac_zabaw, poczta, bank/bankomat. Modyfikator + sygnały (nie bramka).
 *
 * Zapytanie Overpass Turbo (cała PL, eksport „surowe dane OSM"):
 *   [out:json][timeout:900];
 *   area["ISO3166-1"="PL"][admin_level=2]->.pl;
 *   ( nwr(area.pl)[leisure=park]; nwr(area.pl)[leisure=playground]; nwr(area.pl)[landuse=recreation_ground];
 *     nwr(area.pl)[natural=wood]; nwr(area.pl)[landuse=forest]; nwr(area.pl)[amenity=post_office];
 *     nwr(area.pl)[amenity=bank]; nwr(area.pl)[amenity=atm]; );
 *   out tags center;
 *
 * Użycie: npx tsx tools/otoczenie/import.ts --osm ./otoczenie.json   (flagi: --out)
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/otoczenie_dane.json");
const args = process.argv.slice(2);
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const DATA = new Date().toISOString().slice(0, 10);

type Kat = "zielen" | "plac_zabaw" | "poczta" | "bank";
interface Obiekt { id: string; kategoria: Kat; nazwa: string; lat: number; lon: number; zrodlo: "OSM"; data_importu: string }

/** Tag OSM → kategoria otoczenia (lub null). */
function kategoria(t: Record<string, string>): Kat | null {
  if (t.leisure === "playground") return "plac_zabaw";
  if (t.leisure === "park" || t.leisure === "garden" || t.landuse === "recreation_ground" || t.natural === "wood" || t.landuse === "forest") return "zielen";
  if (t.amenity === "post_office") return "poczta";
  if (t.amenity === "bank" || t.amenity === "atm") return "bank";
  return null;
}

function haversineM(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function main() {
  const osmy = wartosci("--osm");
  if (!osmy.length) { console.error("Podaj --osm <plik.json> (eksport Overpass). Opcje: --out"); process.exit(2); }
  const surowe: Obiekt[] = [];
  for (const f of osmy) {
    const j = JSON.parse(readFileSync(f, "utf8")) as { elements?: any[] };
    for (const e of j.elements ?? []) {
      const kat = kategoria(e?.tags ?? {});
      if (!kat) continue;
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") continue;
      surowe.push({ id: `OSM:${e.type ?? "n"}:${e.id ?? surowe.length}`, kategoria: kat, nazwa: (e.tags?.name ?? kat), lat, lon, zrodlo: "OSM", data_importu: DATA });
    }
    console.error(`→ OSM ${f}: ${surowe.length} obiektów łącznie…`);
  }

  // Dedup per kategoria po bliskości < 40 m (siatka).
  const CELA = 0.0005;
  const wgKat = new Map<Kat, Obiekt[]>();
  const siatka = new Map<string, Obiekt[]>();
  const rekordy: Obiekt[] = [];
  for (const o of surowe) {
    const cx = Math.round(o.lat / CELA), cy = Math.round(o.lon / CELA);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++) for (let dy = -1; dy <= 1 && !dup; dy++) {
      for (const p of siatka.get(`${o.kategoria}:${cx + dx}:${cy + dy}`) ?? []) if (haversineM(o.lat, o.lon, p.lat, p.lon) < 40) { dup = true; break; }
    }
    if (dup) continue;
    const k = `${o.kategoria}:${cx}:${cy}`;
    (siatka.get(k) ?? siatka.set(k, []).get(k)!).push(o);
    rekordy.push(o);
    wgKat.set(o.kategoria, [...(wgKat.get(o.kategoria) ?? []), o]);
  }

  const meta = { opis: "Warstwa otoczenia / jakości życia (OSM).", data_importu: DATA, zrodla: ["OSM"], liczby: Object.fromEntries([...wgKat].map(([k, v]) => [k, v.length])) };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ meta, rekordy }, null, 0));
  renameSync(tmp, OUT);
  console.error("─".repeat(50));
  console.error(`ZAPISANO ${rekordy.length} obiektów → ${OUT}`);
  console.error(`  ${[...wgKat].map(([k, v]) => `${k} ${v.length}`).join(" · ")}`);
}

main();
