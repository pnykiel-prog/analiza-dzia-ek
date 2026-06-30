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
import { medianaRynkowa } from "../../config-rynek";

export const konektorRynek: Konektor = {
  klucz: "RYNEK",
  zrodlo: "Dane rynkowe (mediana regionalna — fallback)",
  poziom: "P2",
  aktywny: true,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.wojewodztwo) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak województwa.");
    const m = medianaRynkowa(teren.wojewodztwo);
    const dane: Partial<DaneDzialki> = { czynszRynkowyM2: m.czynsz, cenaNowychM2: m.cenaNowych };
    // Pewność obniżona — to fallback regionalny, nie oferty lokalne (N < próg).
    const meta: MetaPola[] = [
      { pole: "czynszRynkowyM2", zrodlo: this.zrodlo, czas, pewnosc: 45, status: "ok", tryb: "A" },
      { pole: "cenaNowychM2", zrodlo: this.zrodlo, czas, pewnosc: 45, status: "ok", tryb: "A" },
    ];
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
