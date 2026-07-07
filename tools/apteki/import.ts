/**
 * Importer statycznej warstwy aptek → `src/lib/data/apteki_dane.json`.
 * Źródło: OSM (`amenity=pharmacy`) — punkty mają współrzędne, więc BEZ geokodowania.
 * URUCHAMIANY POZA APLIKACJĄ (raz/dwa razy w roku) albo w sandboxie (brak egresu — OSM
 * ma współrzędne). Zastępuje niekompletny rejestr RA (brak m.in. podkarpackiego).
 *
 * Użycie (Node 22+, bez zależności):
 *   npx tsx tools/apteki/import.ts --osm apteki_osm.json [--osm drugi.json] [--out <plik>]
 *
 * Eksport OSM: overpass-turbo.eu, zapytanie w README (amenity=pharmacy, area PL), „Eksportuj → dane surowe (JSON)".
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/apteki_dane.json");

const args = process.argv.slice(2);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const DATA = new Date().toISOString().slice(0, 10);

interface Apteka { id: string; kategoria: "apteka"; nazwa: string; adres: string; lat: number; lon: number; zrodlo: "OSM"; data_importu: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zOsm(sciezka: string): Apteka[] {
  const j = JSON.parse(readFileSync(sciezka, "utf8")) as { elements?: any[] };
  const out: Apteka[] = [];
  for (const e of j.elements ?? []) {
    const t = e?.tags ?? {};
    if (t.amenity !== "pharmacy") continue;
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const adres = [[t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    out.push({ id: `OSM:${e.type ?? "n"}:${e.id ?? out.length}`, kategoria: "apteka", nazwa: t.name || t.brand || "apteka", adres, lat, lon, zrodlo: "OSM", data_importu: DATA });
  }
  return out;
}

// Dedup po bliskości (< 40 m) — ten sam punkt z node/way.
function haversineM(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function dedup(apteki: Apteka[]): Apteka[] {
  const CELA = 0.0005; // ~50 m
  const siatka = new Map<string, Apteka[]>();
  const out: Apteka[] = [];
  for (const a of apteki) {
    const cx = Math.round(a.lat / CELA), cy = Math.round(a.lon / CELA);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++) for (let dy = -1; dy <= 1 && !dup; dy++) {
      for (const p of siatka.get(`${cx + dx}:${cy + dy}`) ?? []) if (haversineM(a.lat, a.lon, p.lat, p.lon) < 40) { dup = true; break; }
    }
    if (dup) continue;
    const key = `${cx}:${cy}`;
    (siatka.get(key) ?? siatka.set(key, []).get(key)!).push(a);
    out.push(a);
  }
  return out;
}

function main() {
  const osmy = wartosci("--osm");
  if (!osmy.length) {
    console.error("Podaj co najmniej jeden eksport OSM: --osm <plik.json> (można wiele). Opcje: --out <plik>");
    process.exit(2);
  }
  let wszystkie: Apteka[] = [];
  for (const f of osmy) { console.error(`→ OSM ${f}…`); wszystkie.push(...zOsm(f)); }
  const rekordy = dedup(wszystkie);
  const meta = { opis: "Statyczna warstwa aptek (kanał A) — OSM amenity=pharmacy.", data_importu: DATA, zrodla: ["OSM"], liczby: { apteka: rekordy.length } };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ meta, rekordy }, null, 0));
  renameSync(tmp, OUT);
  console.error("─".repeat(50));
  console.error(`ZAPISANO ${rekordy.length} aptek → ${OUT} (z ${wszystkie.length} surowych, dedup <40 m)`);
}

main();
