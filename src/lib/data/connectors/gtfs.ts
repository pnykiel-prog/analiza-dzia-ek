/**
 * Konektor GTFS (M2, kontekst transportowy) — wytyczne transport §1–§3, §7.
 *
 * Z centroidu działki czyta STATYCZNĄ warstwę przystanków (kursów/dobę) i ustala kontekst:
 *   - `z_komunikacja` (miasto)  → przystanek działa jako bramka kanału A,
 *   - `bez_komunikacji` (wieś)  → przystanek TYLKO flaga (nie obniża oceny),
 *   - brak pokrycia GTFS        → „brak" (kontekst nieznany, §0: nigdy nie karze).
 *
 * Warstwa lokalna, deterministyczna, bez egresu per działka (jak warstwa usług). OSM
 * dokłada LOKALIZACJĘ przystanku (odległość) osobno; GTFS dokłada kontekst i częstotliwość.
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { KONFIG_KONEKTORY } from "../connectorsConfig";
import { kontekstGtfs } from "../przystankiGtfs";

const cfg = KONFIG_KONEKTORY.gtfs;

export const konektorGtfs: Konektor = {
  klucz: "GTFS",
  zrodlo: "Kontekst transportowy (GTFS — kursów/dobę)",
  poziom: "P2",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;

    const w = kontekstGtfs(lat, lon);
    if (w.kontekst == null) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak pokrycia GTFS w okolicy — kontekst nieznany (nie flaga, nie kara).");
    }

    const miejski = w.kontekst === "z_komunikacja";
    const opis = miejski
      ? `żywy przystanek ${w.przystanekKursyDobe} kursów/dobę w ${w.najblizszyM} m`
      : `pokrycie GTFS bez żywego przystanku (najbliższy ${w.najblizszyM} m, ${w.przystanekKursyDobe} kursów/dobę)`;

    const dane: Partial<DaneDzialki> = {
      kontekstTransportowy: w.kontekst,
      przystanekKursyDobe: w.przystanekKursyDobe,
      przystanekZCzestotliwoscia: miejski, // częstotliwość realna TYLKO gdy żywy przystanek
    };
    const meta: MetaPola[] = (Object.keys(dane) as (keyof DaneDzialki)[]).map((pole) => ({
      pole,
      zrodlo: `${this.zrodlo} — ${opis}`,
      czas,
      pewnosc: 70,
      status: "ok",
      tryb: "A",
    }));
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
