/**
 * Importer statycznej warstwy usług (kanał A) — buduje `src/lib/data/uslugi_stale.json`
 * z rejestrów urzędowych. URUCHAMIANY POZA APLIKACJĄ (raz w roku), wymaga internetu
 * (RSPO API + geokoder GUGiK). Nie jest kodem produkcyjnym na żądanie.
 *
 * Źródła i tryby:
 *   RSPO  (szkoły + przedszkola) — API na żywo, rekordy mają współrzędne.
 *   RPWDL (POZ)                  — z pliku CSV (eksport księgi); adresy → geokoder.
 *   RA    (apteki)               — z pliku CSV (eksport rejestru); adresy → geokoder.
 *
 * Użycie (Node 22+, bez dodatkowych zależności):
 *   npx tsx tools/uslugi-stale/import.ts --rspo --rpwdl poz.csv --ra apteki.csv
 *   npx tsx tools/uslugi-stale/import.ts --rspo --limit 500        # próbny bieg
 *   flagi: --out <plik> (domyślnie src/lib/data/uslugi_stale.json), --no-geocode
 *
 * Uwaga: napisane wg udokumentowanych kształtów API/CSV. Przy pierwszym biegu
 * sprawdź podsumowanie (liczby per kategoria, rekordy bez współrzędnych) — nazwy
 * kolumn CSV bywają różne między eksportami, mapowanie jest tolerancyjne.
 */

import { writeFileSync, renameSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { geokoduj, zapiszCacheGeokodowania, statystykiGeokodera } from "./geocode";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/uslugi_stale.json");

type Kategoria = "szkola" | "przedszkole" | "poz" | "apteka";
interface Rekord {
  id: string;
  kategoria: Kategoria;
  nazwa: string;
  adres: string;
  lat: number;
  lon: number;
  teryt_gmina: string;
  zrodlo: "RSPO" | "RPWDL" | "RA";
  data_importu: string;
}

// ── Argumenty ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flaga = (n: string) => args.includes(n);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const LIMIT = wartosc("--limit") ? Number(wartosc("--limit")) : Infinity;
const GEOKODUJ = !flaga("--no-geocode");
const DATA = new Date().toISOString().slice(0, 10);

const bezWspolrzednych: { zrodlo: string; nazwa: string; adres: string }[] = [];
let przetworzono = 0; // liczba PRÓB (nie tylko udanych) — do limitu testowego
const limitOsiagniety = () => przetworzono >= LIMIT;

/** Dodaje rekord: jeśli brak współrzędnych — geokoduje adres (lub loguje i pomija). */
async function dodaj(out: Rekord[], r: Omit<Rekord, "lat" | "lon"> & { lat?: number; lon?: number }): Promise<void> {
  przetworzono++;
  let { lat, lon } = r;
  if ((lat == null || lon == null) && GEOKODUJ && r.adres) {
    const w = await geokoduj(r.adres);
    if (w) [lon, lat] = w;
  }
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    bezWspolrzednych.push({ zrodlo: r.zrodlo, nazwa: r.nazwa, adres: r.adres });
    return;
  }
  out.push({ ...r, lat, lon } as Rekord);
}

// ── RSPO (szkoły + przedszkola) — API na żywo ────────────────────────────────
function kategoriaZNazwy(txt: string): Kategoria | null {
  const t = (txt || "").toLowerCase();
  if (t.includes("przedszkole")) return "przedszkole";
  if (t.includes("szko")) return "szkola"; // szkoła / szkoly
  return null;
}
function wspZRspo(m: any): [number, number] | null {
  const g = m?.geolokalizacja;
  if (Array.isArray(g?.coordinates) && g.coordinates.length === 2) return [Number(g.coordinates[1]), Number(g.coordinates[0])]; // [lat,lon] z [lon,lat]
  if (typeof g === "string") { const mm = g.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i); if (mm) return [Number(mm[2]), Number(mm[1])]; }
  if (m?.szerokoscGeograficzna && m?.dlugoscGeograficzna) return [Number(m.szerokoscGeograficzna), Number(m.dlugoscGeograficzna)];
  if (m?.latitude && m?.longitude) return [Number(m.latitude), Number(m.longitude)];
  return null;
}
// Nagłówki „jak przeglądarka" — RSPO (za zaporą) odrzuca zapytania bez User-Agent (HTTP 403).
const NAGLOWKI_RSPO = {
  Accept: "application/ld+json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
};
async function importRspo(out: Rekord[]): Promise<void> {
  let url: string | null = "https://api-rspo.men.gov.pl/api/placowki/?page=1";
  let n = 0;
  while (url && !limitOsiagniety()) {
    const r = await fetch(url, { headers: NAGLOWKI_RSPO });
    if (!r.ok) { console.error(`RSPO HTTP ${r.status} — przerywam RSPO`); break; }
    const j: any = await r.json();
    const czlonkowie: any[] = j["hydra:member"] ?? j.member ?? [];
    for (const m of czlonkowie) {
      if (limitOsiagniety()) return;
      const kat = kategoriaZNazwy(m?.typ?.nazwa ?? m?.nazwa ?? "");
      if (!kat) continue;
      const w = wspZRspo(m);
      const adres = [ [m.ulica, m.numerBudynku].filter(Boolean).join(" "), [m.kodPocztowy, m.miejscowosc].filter(Boolean).join(" ") ].filter(Boolean).join(", ");
      await dodaj(out, {
        id: `RSPO:${m.numerRspo ?? m["@id"] ?? m.id}`, kategoria: kat,
        nazwa: m.nazwa ?? "", adres, teryt_gmina: m.gminaKodTERYT ?? m.gmina ?? "",
        zrodlo: "RSPO", data_importu: DATA, lat: w?.[0], lon: w?.[1],
      });
    }
    n = out.length;
    const next = j["hydra:view"]?.["hydra:next"];
    url = next ? new URL(next, "https://api-rspo.men.gov.pl").toString() : null;
    console.error(`RSPO: ${out.length} rekordów…`);
  }
}

// ── CSV (RPWDL POZ, RA apteki) — z pliku ─────────────────────────────────────
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
async function importCsv(out: Rekord[], sciezka: string, kategoria: Kategoria, zrodlo: "RPWDL" | "RA"): Promise<void> {
  const wiersze = parsujCsv(readFileSync(sciezka, "utf8"));
  for (const row of wiersze) {
    if (limitOsiagniety()) return;
    const nazwa = pole(row, "nazwa", "firma", "podmiot");
    const miejsc = pole(row, "miejscowo", "miasto");
    const ulica = pole(row, "ulica", "adres");
    const nr = pole(row, "numer budynku", "nr budynku", "numer domu", "nr domu");
    const kod = pole(row, "kod pocztowy", "kod");
    const teryt = pole(row, "teryt");
    const latRaw = pole(row, "szeroko", "latitude", "lat");
    const lonRaw = pole(row, "dlugo", "długo", "longitude", "lon");
    const lat = latRaw ? Number(latRaw.replace(",", ".")) : undefined;
    const lon = lonRaw ? Number(lonRaw.replace(",", ".")) : undefined;
    const adres = [[ulica, nr].filter(Boolean).join(" "), [kod, miejsc].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    await dodaj(out, { id: `${zrodlo}:${pole(row, "id", "ksiega", "regon", "nip") || adres}`, kategoria, nazwa, adres, teryt_gmina: teryt, zrodlo, data_importu: DATA, lat: Number.isFinite(lat) ? lat : undefined, lon: Number.isFinite(lon) ? lon : undefined });
  }
}

const ZRODLO_KAT: Record<Kategoria, "RSPO" | "RPWDL" | "RA"> = { szkola: "RSPO", przedszkole: "RSPO", poz: "RPWDL", apteka: "RA" };

/** Czysty plik CSV z kolumnami: kategoria,nazwa,adres,teryt_gmina[,lat,lon]. Geokoduje braki. */
async function importClean(out: Rekord[], sciezka: string): Promise<void> {
  const wiersze = parsujCsv(readFileSync(sciezka, "utf8"));
  for (const row of wiersze) {
    if (limitOsiagniety()) return;
    const kat = pole(row, "kategoria") as Kategoria;
    if (!["szkola", "przedszkole", "poz", "apteka"].includes(kat)) continue;
    const nazwa = pole(row, "nazwa");
    const adres = pole(row, "adres");
    const teryt = pole(row, "teryt");
    const latRaw = pole(row, "lat", "szeroko");
    const lonRaw = pole(row, "lon", "dlugo", "długo");
    const lat = latRaw ? Number(latRaw.replace(",", ".")) : undefined;
    const lon = lonRaw ? Number(lonRaw.replace(",", ".")) : undefined;
    await dodaj(out, { id: `${ZRODLO_KAT[kat]}:${pole(row, "id") || `${kat}:${adres}`}`, kategoria: kat, nazwa, adres, teryt_gmina: teryt, zrodlo: ZRODLO_KAT[kat], data_importu: DATA, lat: Number.isFinite(lat) ? lat : undefined, lon: Number.isFinite(lon) ? lon : undefined });
  }
}

// ── Główny przebieg ──────────────────────────────────────────────────────────
async function main() {
  const csvy = wartosci("--csv");
  if (!flaga("--rspo") && !wartosc("--rpwdl") && !wartosc("--ra") && csvy.length === 0) {
    console.error("Brak źródeł. Podaj co najmniej jedno:\n  --rspo                 (szkoły + przedszkola, API — mają współrzędne)\n  --csv <plik.csv>       (czysty plik: kategoria,nazwa,adres,teryt_gmina — geokoduje; można wiele --csv)\n  --rpwdl <plik.csv>     (POZ, mapowanie heurystyczne)\n  --ra <plik.csv>        (apteki, mapowanie heurystyczne)\nOpcje: --out <plik> --limit <n> --no-geocode\nBez źródeł nie nadpisuję pliku (ochrona seedu).");
    process.exit(2);
  }
  const out: Rekord[] = [];
  if (flaga("--rspo")) { console.error("→ RSPO (szkoły + przedszkola)…"); await importRspo(out); }
  for (const c of csvy) { console.error(`→ CSV ${c}…`); await importClean(out, c); }
  const rpwdl = wartosc("--rpwdl"); if (rpwdl) { console.error(`→ RPWDL POZ z ${rpwdl}…`); await importCsv(out, rpwdl, "poz", "RPWDL"); }
  const ra = wartosc("--ra"); if (ra) { console.error(`→ RA apteki z ${ra}…`); await importCsv(out, ra, "apteka", "RA"); }
  if (GEOKODUJ) zapiszCacheGeokodowania();

  // Dedup po id.
  const wg = new Map<string, Rekord>();
  for (const r of out) if (!wg.has(r.id)) wg.set(r.id, r);
  const rekordy = [...wg.values()];

  const perKat = (k: Kategoria) => rekordy.filter((r) => r.kategoria === k).length;
  const meta = {
    opis: "Statyczna warstwa usług (kanał A) — import z rejestrów urzędowych.",
    data_importu: DATA,
    zrodla: ["RSPO", "RPWDL", "RA"],
    liczby: { szkola: perKat("szkola"), przedszkole: perKat("przedszkole"), poz: perKat("poz"), apteka: perKat("apteka") },
    bez_wspolrzednych: bezWspolrzednych.length,
  };

  // Atomowa podmiana: zapisz obok, potem przenieś.
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ meta, rekordy }, null, 0));
  renameSync(tmp, OUT);

  console.error("─".repeat(50));
  console.error(`ZAPISANO ${rekordy.length} rekordów → ${OUT}`);
  console.error(`  szkoły ${meta.liczby.szkola} · przedszkola ${meta.liczby.przedszkole} · POZ ${meta.liczby.poz} · apteki ${meta.liczby.apteka}`);
  console.error(`  bez współrzędnych (pominięte, do poprawy): ${bezWspolrzednych.length}`);
  if (GEOKODUJ) {
    const g = statystykiGeokodera();
    console.error(`  GEOKODER: ${g.udane} udanych / ${g.bledy} błędów` + (g.udane === 0 && g.bledy > 0 ? "  ← 0 trafień: patrz linie [geokoder] BŁĄD wyżej" : ""));
  }
  if (bezWspolrzednych.length) writeFileSync(join(KATALOG, "bez_wspolrzednych.log.json"), JSON.stringify(bezWspolrzednych, null, 2));
}

main().catch((e) => { console.error("Błąd importu:", e); process.exit(1); });
