/**
 * Runner konektorów: uruchamia aktywne konektory równolegle dla „terenu",
 * scala wyniki (wypełnia tylko puste pola — nie nadpisuje danych już znanych)
 * i zwraca raport źródeł + metadane pól. Awaria konektora nie wywraca raportu.
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { konektorGUS } from "./gus";
import { konektorKIMPZP } from "./kimpzp";

const REJESTR: Konektor[] = [konektorGUS, konektorKIMPZP];

export interface RaportKonektorow {
  dane: Partial<DaneDzialki>;
  meta: MetaPola[];
  raport: { klucz: string; zrodlo: string; status: string; debug?: string }[];
}

function jestPuste(v: unknown): boolean {
  return v === null || v === undefined;
}

export async function uruchomKonektory(teren: Teren, istniejace: DaneDzialki): Promise<RaportKonektorow> {
  const aktywne = REJESTR.filter((k) => k.aktywny);
  const wyniki = await Promise.allSettled(aktywne.map((k) => k.pobierz(teren)));

  const dane: Partial<DaneDzialki> = {};
  const meta: MetaPola[] = [];
  const raport: RaportKonektorow["raport"] = [];

  wyniki.forEach((w, i) => {
    const k = aktywne[i];
    if (w.status === "rejected") {
      raport.push({ klucz: k.klucz, zrodlo: k.zrodlo, status: "blad", debug: String(w.reason) });
      return;
    }
    const r: WynikKonektora = w.value;
    raport.push({ klucz: r.klucz, zrodlo: r.zrodlo, status: r.status, debug: r.debug });
    // Wypełniamy tylko pola puste w danych istniejących (nie nadpisujemy demo/ULDK).
    for (const [pole, wartosc] of Object.entries(r.dane)) {
      if (jestPuste(istniejace[pole as keyof DaneDzialki]) && !jestPuste(wartosc)) {
        (dane as Record<string, unknown>)[pole] = wartosc;
      }
    }
    meta.push(...r.meta);
  });

  return { dane, meta, raport };
}

export { REJESTR };
export type { Teren, MetaPola } from "./types";
