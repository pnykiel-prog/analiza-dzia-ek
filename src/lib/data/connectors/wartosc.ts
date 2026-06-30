/**
 * Konektor wartości odtworzeniowej (M3) — podstawa pułapu czynszu SIM.
 *
 * Brak API: wartość z tabeli konfiguracyjnej (wskaźnik wojewody/BGK) wg
 * województwa i typu obszaru (miasto wojewódzkie / reszta). Tryb A° (odczyt).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora } from "./types";
import { brakWyniku } from "./types";
import { wartoscOdtworzeniowaDla } from "../../config-rynek";

export const konektorWartoscOdtworzeniowa: Konektor = {
  klucz: "WARTOSC_ODTW",
  zrodlo: "Wartość odtworzeniowa (wojewoda/BGK, tabela)",
  poziom: "P2",
  aktywny: true,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.wojewodztwo) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak województwa.");
    const { wartosc, obszar } = wartoscOdtworzeniowaDla(teren.wojewodztwo, teren.gmina);
    const dane: Partial<DaneDzialki> = { wartoscOdtworzeniowaM2: wartosc };
    return {
      klucz: this.klucz,
      zrodlo: `${this.zrodlo} — ${obszar}`,
      status: "ok",
      czas,
      dane,
      meta: [{ pole: "wartoscOdtworzeniowaM2", zrodlo: this.zrodlo, czas, pewnosc: 85, status: "ok", tryb: "A°" }],
    };
  },
};
