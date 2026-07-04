"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { wczytajWpis, usunWpis, type WpisArchiwum } from "@/lib/archiwum";
import { RaportView } from "@/components/RaportView";
import { Karta } from "@/components/ui";

function dataPl(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ArchiwumDetalPage({ params }: { params: { id: string } }) {
  const identyfikator = decodeURIComponent(params.id);
  const [wpis, setWpis] = useState<WpisArchiwum | null | undefined>(undefined); // undefined = wczytywanie

  useEffect(() => {
    setWpis(wczytajWpis(identyfikator));
  }, [identyfikator]);

  function usun() {
    if (!window.confirm("Usunąć tę analizę z archiwum?")) return;
    usunWpis(identyfikator);
    window.location.href = "/archiwum";
  }

  if (wpis === undefined) {
    return <Karta><div className="text-[13px] text-grunt-text-muted2 py-4">Wczytywanie…</div></Karta>;
  }

  if (wpis === null) {
    return (
      <div className="space-y-4">
        <Link href="/archiwum" className="text-[13px] text-grunt-text-3 hover:text-grunt-ink">← Przeanalizowane działki</Link>
        <Karta>
          <div className="py-10 text-center space-y-2">
            <div className="text-[15px] font-medium text-grunt-text">Nie znaleziono zapisu</div>
            <p className="text-[13px] text-grunt-text-muted2">
              Wpis <span className="mono">{identyfikator}</span> nie istnieje w archiwum tej przeglądarki.
            </p>
          </div>
        </Karta>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="brak-druku flex items-center justify-between gap-4 flex-wrap">
        <Link href="/archiwum" className="text-[13px] text-grunt-text-3 hover:text-grunt-ink">← Przeanalizowane działki</Link>
        <div className="flex items-center gap-3 text-[11px] text-grunt-text-muted2">
          <span>Zapisano: {dataPl(wpis.zapisano)}</span>
          <button onClick={() => window.print()} className="btn-secondary" style={{ height: "var(--grunt-h-btn-sm)" }}>↓ Drukuj / PDF</button>
          <button onClick={usun} className="text-[12px] text-grunt-red/80 hover:text-grunt-red">Usuń z archiwum</button>
        </div>
      </div>
      <RaportView wynik={wpis.wynik} data={new Date(wpis.zapisano).toLocaleDateString("pl-PL")} />
    </div>
  );
}
