/**
 * Statyczna warstwa przystanków z GTFS (kanał A / kontekst transportowy M2) — przystanki
 * + kursów/dobę roboczą, wgrane lokalnie i odświeżane okresowo (patrz `tools/gtfs/README.md`).
 * Deterministyczne, bez API na żywo per działka (jak warstwa usług RSPO/RPWDL/RA).
 *
 * `kontekstGtfs(lat, lon)` realizuje wytyczne transport §3:
 *   - najbliższy „żywy" przystanek (kursy ≥ próg) w promieniu R → `z_komunikacja` (miasto),
 *   - jest pokrycie GTFS w okolicy, ale bez żywego przystanku → `bez_komunikacji` (wieś),
 *   - brak przystanku w zasięgu pokrycia → `null` (brak danych GTFS — NIE flaga, NIE kara §0).
 *
 * Uwaga: `gtfs_przystanki.json` w repo to SEED (kilka rekordów) — pełną warstwę wgrywa import.
 */

import { haversineM } from "./connectors/geoUslugi";
import { KONFIG_M2, type KonfiguracjaM2 } from "../config";
import surowe from "./gtfs_przystanki.json";

export interface PrzystanekGtfs {
  nazwa: string;
  lat: number;
  lon: number;
  kursyDobe: number; // odjazdy w typowy dzień roboczy
  feed: string;
}

export const PRZYSTANKI_GTFS: PrzystanekGtfs[] = ((surowe as { przystanki?: PrzystanekGtfs[] }).przystanki ?? []).filter(
  (p) => typeof p.lat === "number" && typeof p.lon === "number" && typeof p.kursyDobe === "number"
);

export const META_GTFS = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

export type KontekstTransportowy = "z_komunikacja" | "bez_komunikacji" | null;

export interface WynikKontekstuGtfs {
  kontekst: KontekstTransportowy;
  przystanekKursyDobe: number | null; // kursy na najbliższym istotnym przystanku (info)
  najblizszyM: number | null; // odległość do najbliższego przystanku w warstwie [m]
}

/**
 * Kontekst transportowy działki z warstwy GTFS (wytyczne transport §3). Najbliższy „żywy"
 * przystanek (kursy ≥ próg) w promieniu R decyduje o kontekście miejskim; brak pokrycia
 * (najbliższy przystanek dalej niż `zasiegPokryciaM`) → kontekst nieznany (bez flagi).
 */
export function kontekstGtfs(lat: number, lon: number, dane: PrzystanekGtfs[] = PRZYSTANKI_GTFS, cfg: KonfiguracjaM2 = KONFIG_M2): WynikKontekstuGtfs {
  const k = cfg.transportKontekst;
  let najblizszy: { d: number; kursy: number } | null = null;
  let najblizszyZywy: { d: number; kursy: number } | null = null;
  for (const p of dane) {
    const d = haversineM(lat, lon, p.lat, p.lon);
    if (najblizszy == null || d < najblizszy.d) najblizszy = { d, kursy: p.kursyDobe };
    if (d <= k.RgtfsM && p.kursyDobe >= k.progKursyDobe && (najblizszyZywy == null || d < najblizszyZywy.d)) {
      najblizszyZywy = { d, kursy: p.kursyDobe };
    }
  }
  if (najblizszy == null || najblizszy.d > k.zasiegPokryciaM) {
    return { kontekst: null, przystanekKursyDobe: null, najblizszyM: najblizszy?.d != null ? Math.round(najblizszy.d) : null };
  }
  if (najblizszyZywy) {
    return { kontekst: "z_komunikacja", przystanekKursyDobe: najblizszyZywy.kursy, najblizszyM: Math.round(najblizszyZywy.d) };
  }
  // Pokrycie GTFS jest, ale brak żywego przystanku w promieniu → wieś (§4.2 → flaga, nie kara).
  return { kontekst: "bez_komunikacji", przystanekKursyDobe: najblizszy.kursy, najblizszyM: Math.round(najblizszy.d) };
}
