/**
 * Konektor danych rynkowych (M3) — czynsz rynkowy i ceny nowych lokali → W5.
 *
 * Brak otwartego API ofert. Stosujemy regułę wystarczalności (sekcja 7 katalogu
 * danych): bez wystarczającej liczby ofert lokalnych używamy mediany regionalnej
 * jako fallbacku, z obniżoną pewnością i zapisanym źródłem. Tryb pól rynkowych
 * na P1 pozostaje ukryty (A) — wartości zasilają tylko scoring W5.
 *
 * Realny dostawca ofert (komercyjne API / NBP) podłącza się tutaj bez zmiany
 * reszty: wtedy N rośnie i tryb pola przechodzi w „szacunek"/„wiarygodne".
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { drabinaRynkowa, pewnoscOfert, type PoziomDrabiny } from "../../config-rynek";

const ETYK_POZIOM: Record<PoziomDrabiny, string> = {
  miejscowosc: "oferty w miejscowości",
  gmina: "oferty w gminie",
  powiat: "oferty w powiecie",
  wojewodztwo: "mediana wojewódzka (fallback)",
};

export const konektorRynek: Konektor = {
  klucz: "RYNEK",
  zrodlo: "Dane rynkowe (drabina przestrzenna)",
  poziom: "P2",
  aktywny: true,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.wojewodztwo) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak województwa.");
    // Drabina miejscowość→gmina→powiat→województwo (jedna próba na szczebel; §7).
    // Brak podłączonego źródła ofert lokalnych → schodzimy do mediany wojewódzkiej.
    const d = drabinaRynkowa(teren.wojewodztwo, teren.gmina, teren.powiat);
    const pewnosc = pewnoscOfert(d.n);
    const zrodlo = `${this.zrodlo} — ${ETYK_POZIOM[d.poziom]}${d.n > 0 ? ` (N=${d.n})` : ""}`;
    const dane: Partial<DaneDzialki> = { czynszRynkowyM2: d.czynsz, cenaNowychM2: d.cenaNowych };
    const meta: MetaPola[] = [
      { pole: "czynszRynkowyM2", zrodlo, czas, pewnosc, status: "ok", tryb: "A" },
      { pole: "cenaNowychM2", zrodlo, czas, pewnosc, status: "ok", tryb: "A" },
    ];
    return { klucz: this.klucz, zrodlo, status: "ok", czas, dane, meta };
  },
};
