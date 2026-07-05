/**
 * Importer statycznej warstwy przystanków z GTFS → `src/lib/data/gtfs_przystanki.json`.
 * URUCHAMIANY POZA APLIKACJĄ (okresowo, u siebie). Liczy „kursów/dobę roboczą" per przystanek
 * — to ustala kontekst transportowy M2 (miasto = bramka / wieś = flaga; wytyczne transport §3).
 *
 * WEJŚCIE: rozpakowane katalogi GTFS (każdy ze stops.txt, trips.txt, stop_times.txt oraz
 * calendar.txt i/lub calendar_dates.txt). GTFS to ZIP — rozpakuj przed importem.
 *
 * Użycie (Node 22+, bez dodatkowych zależności):
 *   npx tsx tools/gtfs/import.ts --feed ./warszawa --feed ./gzm --feed ./krakow
 *   flagi: --out <plik>  --min-kursy <n> (pomiń przystanki poniżej progu; domyślnie 1)
 *
 * Metoda: reprezentatywny dzień roboczy (środa). Aktywne service_id → kursy (trip_id) →
 * zlicz odjazdy per stop_id w stop_times. Feedy scalane, przystanki dedup po zaokrąglonych
 * współrzędnych (max kursów). calendar_dates (święta) pomijane, gdy jest calendar.txt.
 */

import { existsSync, readFileSync, writeFileSync, createReadStream, renameSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const DOMYSLNY_OUT = resolve(KATALOG, "../../src/lib/data/gtfs_przystanki.json");

const args = process.argv.slice(2);
const wartosci = (n: string) => args.map((a, i) => (a === n ? args[i + 1] : null)).filter((v): v is string => !!v);
const wartosc = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const OUT = wartosc("--out") ?? DOMYSLNY_OUT;
const MIN_KURSY = wartosc("--min-kursy") ? Number(wartosc("--min-kursy")) : 1;

interface Przystanek { nazwa: string; lat: number; lon: number; kursyDobe: number; feed: string }

// ── CSV GTFS (przecinek, opcjonalne cudzysłowy) ──────────────────────────────
function podzielCsv(l: string): string[] {
  const o: string[] = []; let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { o.push(cur); cur = ""; }
    else cur += c;
  }
  o.push(cur);
  return o;
}
function wczytajTabele(sciezka: string): { naglowki: string[]; wiersze: string[][] } {
  const tekst = readFileSync(sciezka, "utf8").replace(/^﻿/, "");
  const linie = tekst.split(/\r?\n/).filter((l) => l.trim() !== "");
  const naglowki = podzielCsv(linie[0]).map((h) => h.trim());
  return { naglowki, wiersze: linie.slice(1).map(podzielCsv) };
}
const idx = (naglowki: string[], nazwa: string) => naglowki.indexOf(nazwa);

/** Reprezentatywny dzień roboczy: service_id aktywne w typową środę danego feedu. */
function serviceRoboczodniowe(feedDir: string): Set<string> {
  const plikCal = join(feedDir, "calendar.txt");
  const services = new Set<string>();
  if (existsSync(plikCal)) {
    const { naglowki, wiersze } = wczytajTabele(plikCal);
    const iSid = idx(naglowki, "service_id");
    const iSr = idx(naglowki, "wednesday");
    const dni = ["monday", "tuesday", "wednesday", "thursday", "friday"].map((d) => idx(naglowki, d));
    for (const w of wiersze) {
      const roboczo = iSr >= 0 ? w[iSr] === "1" : dni.some((i) => i >= 0 && w[i] === "1");
      if (roboczo) services.add(w[iSid]);
    }
    if (services.size) return services;
  }
  // Brak calendar.txt (albo pusty) → z calendar_dates: dzień roboczy z największą liczbą usług.
  const plikCd = join(feedDir, "calendar_dates.txt");
  if (existsSync(plikCd)) {
    const { naglowki, wiersze } = wczytajTabele(plikCd);
    const iSid = idx(naglowki, "service_id"), iDate = idx(naglowki, "date"), iExc = idx(naglowki, "exception_type");
    const perData = new Map<string, Set<string>>();
    for (const w of wiersze) {
      if (w[iExc] !== "1") continue; // tylko dodane usługi
      const d = w[iDate]; // YYYYMMDD
      const dow = new Date(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8))).getDay();
      if (dow < 1 || dow > 5) continue; // tylko dni robocze
      (perData.get(d) ?? perData.set(d, new Set()).get(d)!).add(w[iSid]);
    }
    let best: Set<string> | null = null;
    for (const s of perData.values()) if (!best || s.size > best.size) best = s;
    if (best) return best;
  }
  return services;
}

async function przetworzFeed(feedDir: string): Promise<Przystanek[]> {
  const nazwaFeedu = feedDir.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || feedDir;
  for (const p of ["stops.txt", "trips.txt", "stop_times.txt"]) {
    if (!existsSync(join(feedDir, p))) { console.error(`  ! ${nazwaFeedu}: brak ${p} — pomijam feed`); return []; }
  }
  const services = serviceRoboczodniowe(feedDir);
  if (!services.size) { console.error(`  ! ${nazwaFeedu}: brak usług w dzień roboczy (calendar) — pomijam`); return []; }

  // trip_id → service_id; kursy robocze = trip_id z usług roboczych.
  const trips = wczytajTabele(join(feedDir, "trips.txt"));
  const tTrip = idx(trips.naglowki, "trip_id"), tSvc = idx(trips.naglowki, "service_id");
  const kursyRobocze = new Set<string>();
  for (const w of trips.wiersze) if (services.has(w[tSvc])) kursyRobocze.add(w[tTrip]);

  // stop_times.txt bywa OGROMNY — strumieniowo; zlicz odjazdy per stop_id.
  const licz = new Map<string, number>();
  await new Promise<void>((res) => {
    const rl = createInterface({ input: createReadStream(join(feedDir, "stop_times.txt"), "utf8"), crlfDelay: Infinity });
    let iTrip = -1, iStop = -1, pierwszy = true;
    rl.on("line", (line) => {
      const w = podzielCsv(line);
      if (pierwszy) { pierwszy = false; iTrip = w.indexOf("trip_id"); iStop = w.indexOf("stop_id"); return; }
      if (kursyRobocze.has(w[iTrip])) licz.set(w[iStop], (licz.get(w[iStop]) ?? 0) + 1);
    });
    rl.on("close", () => res());
  });

  // stops.txt → współrzędne + nazwa; złóż rekordy.
  const stops = wczytajTabele(join(feedDir, "stops.txt"));
  const sId = idx(stops.naglowki, "stop_id"), sLat = idx(stops.naglowki, "stop_lat"), sLon = idx(stops.naglowki, "stop_lon"), sName = idx(stops.naglowki, "stop_name");
  const out: Przystanek[] = [];
  for (const w of stops.wiersze) {
    const kursy = licz.get(w[sId]) ?? 0;
    if (kursy < MIN_KURSY) continue;
    const lat = Number(w[sLat]), lon = Number(w[sLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ nazwa: (w[sName] ?? "").trim(), lat, lon, kursyDobe: kursy, feed: nazwaFeedu });
  }
  console.error(`  ✓ ${nazwaFeedu}: ${out.length} przystanków z kursami (usług roboczych: ${services.size})`);
  return out;
}

async function main() {
  const feedy = wartosci("--feed");
  if (!feedy.length) {
    console.error("Podaj co najmniej jeden --feed <katalog GTFS> (rozpakowany ZIP ze stops.txt/trips.txt/stop_times.txt).\n" +
      "Opcje: --out <plik> --min-kursy <n>");
    process.exit(2);
  }
  const wszystkie: Przystanek[] = [];
  for (const f of feedy) { console.error(`→ feed ${f}…`); wszystkie.push(...(await przetworzFeed(f))); }

  // Dedup po zaokrąglonych współrzędnych (~11 m) — ten sam słupek w wielu feedach → max kursów.
  const wg = new Map<string, Przystanek>();
  for (const p of wszystkie) {
    const klucz = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
    const ist = wg.get(klucz);
    if (!ist || p.kursyDobe > ist.kursyDobe) wg.set(klucz, p);
  }
  const przystanki = [...wg.values()];

  const meta = { opis: "Statyczna warstwa przystanków z GTFS (kontekst transportowy M2).", data_importu: new Date().toISOString().slice(0, 10), feedy, liczba: przystanki.length };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify({ meta, przystanki }, null, 0));
  renameSync(tmp, OUT);
  console.error("─".repeat(50));
  console.error(`ZAPISANO ${przystanki.length} przystanków → ${OUT}`);
  const zywe = przystanki.filter((p) => p.kursyDobe >= 10).length;
  console.error(`  żywych (≥10 kursów/dobę): ${zywe} · pozostałe: ${przystanki.length - zywe}`);
}

main().catch((e) => { console.error("Błąd importu GTFS:", e); process.exit(1); });
