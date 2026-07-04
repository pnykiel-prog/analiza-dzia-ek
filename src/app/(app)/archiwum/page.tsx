"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { wczytajArchiwum, usunWpis, type WpisArchiwum } from "@/lib/archiwum";
import { liczba, etykietaProfilu } from "@/lib/format";
import { Karta } from "@/components/ui";

const KOLOR_WERD: Record<string, string> = {
  zielony: "bg-grunt-green",
  zolty: "bg-grunt-amber",
  czerwony: "bg-grunt-red",
};

const ETYK_M2: Record<string, string> = {
  mlodzi: "Społeczny — młodzi",
  seniorzy: "Senioralne — wspomagane",
  brak: "Brak (lokalizacja nieodpowiednia)",
};

function dataPl(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ArchiwumPage() {
  const [lista, setLista] = useState<WpisArchiwum[] | null>(null);

  useEffect(() => {
    setLista(wczytajArchiwum());
  }, []);

  function usun(id: string) {
    if (!window.confirm("Usunąć tę analizę z archiwum? Operacji nie można cofnąć.")) return;
    setLista(usunWpis(id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-grunt-text tracking-[-0.01em]">Przeanalizowane działki</h1>
          <p className="text-[13px] text-grunt-text-muted2 mt-1">
            Archiwum zapisanych studiów. Dane trwają w tej przeglądarce — zapisz raport w kroku „Studium", aby dodać go tutaj.
          </p>
        </div>
        <Link href="/nowa" className="btn-primary shrink-0" style={{ height: "var(--grunt-h-btn-sm)" }}>
          + Nowa analiza
        </Link>
      </div>

      {lista === null ? (
        <Karta><div className="text-[13px] text-grunt-text-muted2 py-4">Wczytywanie archiwum…</div></Karta>
      ) : lista.length === 0 ? (
        <Karta>
          <div className="py-10 text-center space-y-3">
            <div className="text-[15px] font-medium text-grunt-text">Archiwum jest puste</div>
            <p className="text-[13px] text-grunt-text-muted2 max-w-md mx-auto">
              Wykonaj analizę i w kroku „Studium (raport)" kliknij <span className="font-medium text-grunt-text">„Zapisz do archiwum"</span>.
              Zapisane działki pojawią się tu jako Twoje archiwum.
            </p>
            <Link href="/nowa" className="btn-primary inline-flex" style={{ height: "var(--grunt-h-btn-sm)" }}>
              Rozpocznij nową analizę
            </Link>
          </div>
        </Karta>
      ) : (
        <Karta prawy={<span className="text-[11px] text-grunt-text-faint">{lista.length} {lista.length === 1 ? "działka" : "działek"}</span>} tytul="Zapisane studia">
          <div className="overflow-x-auto -mx-[18px]">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-grunt-text-faint border-b border-grunt-border">
                  <th className="text-left font-medium px-[18px] py-2">Działka</th>
                  <th className="text-left font-medium px-3 py-2">Pow.</th>
                  <th className="text-left font-medium px-3 py-2">Przesiew (P1)</th>
                  <th className="text-left font-medium px-3 py-2">Rekomendacja (P2)</th>
                  <th className="text-left font-medium px-3 py-2">Zapisano</th>
                  <th className="px-[18px] py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((w) => (
                  <tr key={w.id} className="border-b border-grunt-border/60 hover:bg-grunt-surface-3/40">
                    <td className="px-[18px] py-3 align-top">
                      <Link href={`/archiwum/${encodeURIComponent(w.id)}`} className="block group">
                        <span className="mono text-[12px] text-grunt-text group-hover:text-grunt-ink">{w.identyfikator}</span>
                        <span className="block text-[11px] text-grunt-text-muted2 mt-0.5">
                          {w.gmina || "—"}{w.powiat ? `, pow. ${w.powiat}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 align-top mono text-[12px] text-grunt-text-muted">
                      {w.powierzchniaM2 > 0 ? liczba(w.powierzchniaM2, " m²") : "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${KOLOR_WERD[w.werdyktP1] ?? "bg-grunt-surface-3"}`} />
                        <span className="text-[12px] text-grunt-text-muted2">{etykietaProfilu[w.profilP1]}</span>
                      </span>
                      <span className="block text-[10px] text-grunt-text-faint mono mt-0.5">M {w.scoreMlodzi} / S {w.scoreSeniorzy}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-grunt-text-muted2">
                      {ETYK_M2[w.rekomendacjaM2] ?? w.rekomendacjaM2}
                    </td>
                    <td className="px-3 py-3 align-top text-[11px] text-grunt-text-muted2 whitespace-nowrap">
                      {dataPl(w.zapisano)}
                    </td>
                    <td className="px-[18px] py-3 align-top text-right whitespace-nowrap">
                      <Link href={`/archiwum/${encodeURIComponent(w.id)}`} className="text-[12px] text-grunt-text-3 hover:text-grunt-ink mr-3">
                        Otwórz
                      </Link>
                      <button onClick={() => usun(w.id)} className="text-[12px] text-grunt-red/80 hover:text-grunt-red">
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Karta>
      )}
    </div>
  );
}
