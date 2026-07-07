/**
 * Konektor wartości odtworzeniowej (M3) — podstawa pułapu czynszu SIM.
 *
 * Brak API: wartość z tabeli konfiguracyjnej (wskaźnik wojewody/BGK) wg
 * województwa i typu obszaru (miasto wojewódzkie / reszta). Tryb A° (odczyt).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora } from "./types";
import { brakWyniku } from "./types";
import { stawkaWO } from "../wartoscOdtworzeniowa";

export const konektorWartoscOdtworzeniowa: Konektor = {
  klucz: "WARTOSC_ODTW",
  zrodlo: "Wartość odtworzeniowa (obwieszczenie wojewody / benchmark)",
  poziom: "P2",
  aktywny: true,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.wojewodztwo) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak województwa.");
    // Warstwa WO: miasto wydzielone bierze swoją stawkę (Rzeszów 7018), inaczej „reszta województwa";
    // brak wpisu obwieszczeniowego → benchmark z config-rynek.
    const s = stawkaWO(teren.wojewodztwo, teren.gmina);
    const dane: Partial<DaneDzialki> = {
      wartoscOdtworzeniowaM2: s.wartosc,
      woMeta: {
        jednostka: s.jednostka,
        typ: s.typ,
        okresOd: s.okresOd,
        okresDo: s.okresDo,
        obwieszczenie: s.obwieszczenie,
        benchmark: s.benchmark,
      },
    };
    return {
      klucz: this.klucz,
      zrodlo: `${this.zrodlo} — ${s.jednostka}`,
      status: "ok",
      czas,
      dane,
      meta: [{ pole: "wartoscOdtworzeniowaM2", zrodlo: `${this.zrodlo}${s.benchmark ? " (benchmark)" : ` (${s.obwieszczenie})`}`, czas, pewnosc: s.benchmark ? 60 : 85, status: "ok", tryb: "A°" }],
    };
  },
};
