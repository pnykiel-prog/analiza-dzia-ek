"use client";

import { useState } from "react";
import type { DaneDzialki } from "@/lib/types";
import { KONFIG_M2 } from "@/lib/config";
import { Karta } from "./ui";

/** Odpowiedzi klienta w M2 (wszystkie opcjonalne — puste = nieznane). */
export interface OdpowiedziM2 {
  dostepDrogi: boolean | null;
  odleglosci: Record<string, number | null>; // metry
  wysokoscOkolicyPieter: number | null;
  planistyka: {
    intensywnosc: number | null;
    maxWysokoscM: number | null;
    maxPowZabudowyPct: number | null;
    minPbcPct: number | null;
  } | null;
  planistykaPotwierdzona: boolean; // klient potwierdził: realne dane z MPZP/dokumentu
}

/**
 * Poziom 2 — proste pytania do klienta (wersja uproszczona, bez audytu braków).
 * Auto pobiera co się da w tle; tu pytamy tylko o to, czego auto nie ustaliło
 * i co klient realnie zna. Każde pole opcjonalne — puste = nieznane, dalej zawsze można.
 */
export function PytaniaM2({
  dane,
  onPrzelicz,
  licze,
}: {
  dane: DaneDzialki;
  onPrzelicz: (o: OdpowiedziM2) => void;
  licze: boolean;
}) {
  const drogaAuto = dane.dostepDrogaPubliczna != null; // auto rozstrzygnęło?
  const wysokoscAuto = dane.wysokoscOkolicyPieter != null;

  const [droga, setDroga] = useState<string>(dane.dostepDrogaPubliczna == null ? "" : dane.dostepDrogaPubliczna ? "tak" : "nie");
  const [odl, setOdl] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const o of KONFIG_M2.odleglosciPieszo) {
      const v = dane.odleglosciM2?.[o.klucz];
      start[o.klucz] = v == null ? "" : String(v);
    }
    return start;
  });
  const [wys, setWys] = useState<string>(dane.wysokoscOkolicyPieter == null ? "" : String(dane.wysokoscOkolicyPieter));
  const [planOtwarte, setPlanOtwarte] = useState(false);
  const [potwierdzona, setPotwierdzona] = useState(false);
  const [plan, setPlan] = useState<Record<string, string>>({ intensywnosc: "", maxWysokoscM: "", maxPowZabudowyPct: "", minPbcPct: "" });

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  // Odległości: rozdziel na ustalone automatycznie (nie pytamy) i brakujące (pytamy) — spec §7.
  const odlAuto = KONFIG_M2.odleglosciPieszo
    .map((o) => ({ ...o, m: dane.odleglosciM2?.[o.klucz] }))
    .filter((o): o is typeof o & { m: number } => o.m != null);
  const odlDoPytania = KONFIG_M2.odleglosciPieszo.filter((o) => dane.odleglosciM2?.[o.klucz] == null);

  function przelicz() {
    // Wysyłamy tylko odległości, o które pytaliśmy (auto trzyma się w dane.odleglosciM2 z prowenancją).
    const odleglosci: Record<string, number | null> = {};
    for (const o of odlDoPytania) odleglosci[o.klucz] = num(odl[o.klucz] ?? "");
    const planPodane = planOtwarte && (plan.intensywnosc || plan.maxWysokoscM || plan.maxPowZabudowyPct || plan.minPbcPct);
    onPrzelicz({
      dostepDrogi: droga === "" ? null : droga === "tak",
      odleglosci,
      wysokoscOkolicyPieter: num(wys),
      planistyka: planPodane
        ? {
            intensywnosc: num(plan.intensywnosc),
            maxWysokoscM: num(plan.maxWysokoscM),
            maxPowZabudowyPct: num(plan.maxPowZabudowyPct),
            minPbcPct: num(plan.minPbcPct),
          }
        : null,
      planistykaPotwierdzona: Boolean(planPodane && potwierdzona),
    });
  }

  return (
    <Karta
      tytul="Poziom 2 — kilka pytań o działkę"
      podtytul="Resztę pobraliśmy automatycznie. Uzupełnij, co znasz — albo zostaw puste i przejdź dalej."
    >
      {/* 1. Dostęp do drogi — tylko gdy auto nie rozstrzygnęło */}
      {!drogaAuto && (
        <div className="mb-4">
          <div className="text-[13px] text-grunt-text mb-1.5">Czy działka ma dostęp do drogi publicznej?</div>
          <div className="flex gap-2">
            {[["tak", "Tak"], ["nie", "Nie"], ["", "Nie wiem"]].map(([v, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => setDroga(v)}
                className={`badge ${droga === v ? "bg-grunt-ink text-white" : "bg-grunt-surface-3 text-grunt-text-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Odległości pieszo — auto pokazujemy jako ustalone; pytamy TYLKO o brakujące (spec §7). */}
      <div className="mb-4">
        <div className="text-[13px] text-grunt-text mb-1.5">Odległości pieszo do usług</div>

        {odlAuto.length > 0 && (
          <div className="mb-3 rounded-md bg-grunt-green-bg/50 border border-grunt-green/20 px-3 py-2">
            <div className="text-[11px] font-medium text-grunt-green mb-1.5">
              Ustalone automatycznie (OSM) — {odlAuto.length} z {KONFIG_M2.odleglosciPieszo.length}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
              {odlAuto.map((o) => (
                <div key={o.klucz} className="flex items-baseline justify-between text-[12px]">
                  <span className="text-grunt-text-muted2">{o.etykieta}</span>
                  <span className="mono text-grunt-text">{o.m} m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {odlDoPytania.length > 0 ? (
          <>
            <div className="text-[11px] text-grunt-text-muted2 mb-1.5">
              {odlAuto.length > 0 ? "Uzupełnij pozostałe (opcjonalnie):" : "Podaj, jeśli znasz (opcjonalnie):"}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {odlDoPytania.map((o) => (
                <label key={o.klucz} className="text-sm block">
                  <span className="text-xs text-grunt-text-muted">{o.etykieta}</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={odl[o.klucz] ?? ""}
                    onChange={(e) => setOdl((s) => ({ ...s, [o.klucz]: e.target.value }))}
                    placeholder="m (opcjonalnie)"
                    className="inp mt-0.5"
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-grunt-text-muted2">Wszystkie odległości ustalone automatycznie — nic nie musisz podawać.</div>
        )}
      </div>

      {/* 3. Wysokość zabudowy w okolicy — tylko gdy auto (BDOT) nie pobrało */}
      {!wysokoscAuto && (
        <div className="mb-4">
          <label className="text-sm block max-w-[240px]">
            <span className="text-[13px] text-grunt-text">Typowa wysokość zabudowy w okolicy (piętra)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={wys}
              onChange={(e) => setWys(e.target.value)}
              placeholder="np. 4 (opcjonalnie)"
              className="inp mt-0.5"
            />
          </label>
        </div>
      )}

      {/* 4. Opcjonalne, zwijane: szczegóły planistyczne */}
      <div className="border-t border-grunt-divider pt-3">
        <button
          type="button"
          onClick={() => setPlanOtwarte((o) => !o)}
          className="text-[13px] text-grunt-text-muted flex items-center gap-2"
        >
          <span className={`inline-block transition-transform ${planOtwarte ? "rotate-90" : ""}`}>▸</span>
          Czy masz szczegóły planistyczne dla działki (np. wypis z MPZP)?
        </button>
        {planOtwarte && (
          <div className="mt-3">
            <p className="text-[11px] text-grunt-text-faint2 mb-2">
              Domyślnie korzystamy z danych z Poziomu 1 (KIMPZP + prognoza). Podanie wskaźników z wypisu uściśla model zabudowy i podnosi pewność.
            </p>
            <label className="flex items-center gap-2 mb-2 text-[12px] text-grunt-text-muted">
              <input type="checkbox" checked={potwierdzona} onChange={(e) => setPotwierdzona(e.target.checked)} />
              Potwierdzam: to realne dane z MPZP / dokumentu urzędowego (bez potwierdzenia model użyje prognozy).
            </label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["intensywnosc", "Intensywność zabudowy", "0.1"],
                ["maxWysokoscM", "Maks. wysokość (m)", "1"],
                ["maxPowZabudowyPct", "Maks. % zabudowy", "1"],
                ["minPbcPct", "Min. PBC (%)", "1"],
              ].map(([k, l, step]) => (
                <label key={k} className="text-sm block">
                  <span className="text-xs text-grunt-text-muted">{l}</span>
                  <input
                    type="number"
                    step={step}
                    value={plan[k] ?? ""}
                    onChange={(e) => setPlan((s) => ({ ...s, [k]: e.target.value }))}
                    className="inp mt-0.5"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button onClick={przelicz} disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
          {licze ? "Liczę…" : "Zapisz i przelicz Poziom 2"}
        </button>
      </div>
    </Karta>
  );
}
