/**
 * Importer statycznej warstwy sklepów spożywczych → `src/lib/data/sklepy_dane.json`.
 * URUCHAMIANY POZA APLIKACJĄ (2×/rok, u siebie). Warstwowe źródło (wytyczne sklepy):
 *   lokalizatory sieci (baza) + OSM (niezależne) + [REGON] → dedup → geokod → normalizacja.
 *
 * Użycie (Node 22+, bez dodatkowych zależności):
 *   npx tsx tools/sklepy/import.ts --siec biedronka.csv --siec dino.csv --osm osm.json --regon regon.csv
 *   flagi:
 *     --siec <plik.csv>   lokalizator sieci: kolumny nazwa/siec,adres,teryt[,lat,lon] (powt.)
 *     --osm  <plik.json>  eksport Overpass (elements z tag shop + lat/lon lub center)
 *     --regon <plik.csv>  REGON PKD 47.11.Z: nazwa,adres,teryt (zaszumione — kompletność)
 *     --out <plik>        domyślnie src/lib/data/sklepy_dane.json
 *     --no-geocode        pomiń geokodowanie (tylko rekordy z gotowymi współrzędnymi)
 *
 * Dedup: sklep z sieci i z OSM to ten sam punkt → priorytet sieć > OSM > REGON,
 * łączenie po bliskości współrzędnych (< 50 m). Geokoder GUGiK współdzielony z warstwą usług.
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { geokoduj, zapiszCacheGeokodowania } from "../uslugi-stale/geocode";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/sklepy_dane.json");

const args = process.argv.slice(2);
const flaga = (n: string) => args.includes(n);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const GEOKODUJ = !flaga("--no-geocode");
const DATA = new Date().toISOString().slice(0, 10);

type Zrodlo = "siec" | "OSM" | "REGON";
interface Sklep { id: string; kategoria: "sklep"; nazwa: string; adres: string; lat?: number; lon?: number; teryt_gmina: string; siec: string; zrodlo: Zrodlo; data_importu: string }
const PRIORYTET: Record<Zrodlo, number> = { siec: 0, OSM: 1, REGON: 2 };

// ── CSV ──────────────────────────────────────────────────────────────────────
function parsujCsv(tekst: string): Record<string, string>[] {
  const linie = tekst.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!linie.length) return [];
  const delim = (linie[0].match(/;/g)?.length ?? 0) >= (linie[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const podziel = (l: string) => { const o: string[] = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === delim && !q) { o.push(cur); cur = ""; } else cur += c; } o.push(cur); return o; };
  const naglowki = podziel(linie[0]).map((h) => h.trim().toLowerCase());
  return linie.slice(1).map((l) => { const p = podziel(l); const o: Record<string, string> = {}; naglowki.forEach((h, i) => (o[h] = (p[i] ?? "").trim())); return o; });
}
const pole = (row: Record<string, string>, ...frazy: string[]): string => {
  for (const f of frazy) { const k = Object.keys(row).find((h) => h.includes(f)); if (k && row[k]) return row[k]; }
  return "";
};
const num = (s: string): number | undefined => { const v = Number((s || "").replace(",", ".")); return Number.isFinite(v) && v !== 0 ? v : undefined; };

function zCsv(sciezka: string, zrodlo: Zrodlo, domyslnaSiec: string): Sklep[] {
  return parsujCsv(readFileSync(sciezka, "utf8")).map((row, i) => {
    const siec = pole(row, "siec", "sieć") || domyslnaSiec;
    const nazwa = pole(row, "nazwa", "firma", "podmiot") || siec;
    const ulica = pole(row, "ulica", "adres"), nr = pole(row, "numer", "nr");
    const kod = pole(row, "kod pocztowy", "kod"), miejsc = pole(row, "miejscowo", "miasto");
    const adres = pole(row, "adres") || [[ulica, nr].filter(Boolean).join(" "), [kod, miejsc].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return { id: `${zrodlo}:${siec}:${pole(row, "id") || i}`, kategoria: "sklep", nazwa, adres, teryt_gmina: pole(row, "teryt"), siec, zrodlo, data_importu: DATA, lat: num(pole(row, "lat", "szeroko")), lon: num(pole(row, "lon", "dlugo", "długo")) };
  });
}

function zOsm(sciezka: string): Sklep[] {
  const j = JSON.parse(readFileSync(sciezka, "utf8")) as { elements?: any[] };
  const SPOZYWCZE = new Set(["supermarket", "convenience", "grocery", "greengrocer"]);
  return (j.elements ?? [])
    .filter((e) => SPOZYWCZE.has(e?.tags?.shop))
    .map((e, i) => {
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      const t = e.tags ?? {};
      const adres = [[t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return { id: `OSM:${e.type ?? "n"}:${e.id ?? i}`, kategoria: "sklep" as const, nazwa: t.name || t.brand || "sklep", adres, teryt_gmina: "", siec: t.brand || "niezależny", zrodlo: "OSM" as Zrodlo, data_importu: DATA, lat, lon };
    });
}

// ── Dedup po bliskości (< 50 m), priorytet sieć > OSM > REGON ─────────────────
function haversineM(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function dedup(sklepy: Sklep[]): Sklep[] {
  const zeWsp = sklepy.filter((s) => s.lat != null && s.lon != null) as (Sklep & { lat: number; lon: number })[];
  zeWsp.sort((a, b) => PRIORYTET[a.zrodlo] - PRIORYTET[b.zrodlo]); // najpierw sieć
  const siatka = new Map<string, (Sklep & { lat: number; lon: number })[]>();
  const CELA = 0.0006; // ~60 m
  const klucz = (la: number, lo: number) => `${Math.round(la / CELA)}:${Math.round(lo / CELA)}`;
  const out: Sklep[] = [];
  for (const s of zeWsp) {
    const cx = Math.round(s.lat / CELA), cy = Math.round(s.lon / CELA);
    let duplikat = false;
    for (let dx = -1; dx <= 1 && !duplikat; dx++) for (let dy = -1; dy <= 1 && !duplikat; dy++) {
      for (const p of siatka.get(`${cx + dx}:${cy + dy}`) ?? []) if (haversineM(s.lat, s.lon, p.lat, p.lon) < 50) { duplikat = true; break; }
    }
    if (duplikat) continue;
    (siatka.get(klucz(s.lat, s.lon)) ?? siatka.set(klucz(s.lat, s.lon), []).get(klucz(s.lat, s.lon))!).push(s);
    out.push(s);
  }
  return out;
}

async function main() {
  const sieci = wartosci("--siec"), osmy = wartosci("--osm"), regony = wartosci("--regon");
  if (!sieci.length && !osmy.length && !regony.length) {
    console.error("Podaj co najmniej jedno źródło: --siec <csv> (powt.) / --osm <json> / --regon <csv>. Opcje: --out --no-geocode");
    process.exit(2);
  }
  let wszystkie: Sklep[] = [];
  for (const f of sieci) { console.error(`→ sieć ${f}…`); wszystkie.push(...zCsv(f, "siec", "")); }
  for (const f of osmy) { console.error(`→ OSM ${f}…`); wszystkie.push(...zOsm(f)); }
  for (const f of regony) { console.error(`→ REGON ${f}…`); wszystkie.push(...zCsv(f, "REGON", "niezależny")); }

  // Geokoduj brakujące współrzędne (adres → GUGiK).
  let bezWsp = 0;
  if (GEOKODUJ) {
    for (const s of wszystkie) {
      if ((s.lat == null || s.lon == null) && s.adres) { const w = await geokoduj(s.adres); if (w) [s.lon, s.lat] = w; }
      if (s.lat == null || s.lon == null) bezWsp++;
    }
    zapiszCacheGeokodowania();
  } else bezWsp = wszystkie.filter((s) => s.lat == null || s.lon == null).length;

  const rekordy = dedup(wszystkie);
  const perZr = (z: Zrodlo) => rekordy.filter((r) => r.zrodlo === z).length;
  const meta = { opis: "Statyczna warstwa sklepów (kanał A) — sieci + OSM + REGON.", data_importu: DATA, zrodla: ["siec", "OSM", "REGON"], liczby: { siec: perZr("siec"), OSM: perZr("OSM"), REGON: perZr("REGON") }, bez_wspolrzednych: bezWsp };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ meta, rekordy }, null, 0));
  renameSync(tmp, OUT);
  console.error("─".repeat(50));
  console.error(`ZAPISANO ${rekordy.length} sklepów → ${OUT}`);
  console.error(`  sieć ${meta.liczby.siec} · OSM ${meta.liczby.OSM} · REGON ${meta.liczby.REGON} · bez współrzędnych: ${bezWsp}`);
}

main().catch((e) => { console.error("Błąd importu sklepów:", e); process.exit(1); });
