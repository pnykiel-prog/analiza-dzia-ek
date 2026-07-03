"use client";

import { useMemo, useState } from "react";
import type { DaneDzialki, PoleM2 } from "@/lib/types";
import { uzgodnijM2, wartoscPolaTekst } from "@/lib/engine/uzgodnienieM2";
import { Karta } from "./ui";

/**
 * Ekran uzgodnienia danych M2 (E3) — trzy sekcje wg docs/dane-m2.md §3:
 *  A. Pozyskano automatycznie (odczyt),
 *  B. Do uzupełnienia ręcznego (pole + podpowiedź + Pomiń; `gate` z ostrzeżeniem),
 *  C. Niedostępne automatycznie (informacyjnie, obniża pewność).
 *
 * „brak danych ≠ nie": klient może wszystko pominąć i i tak dostać analizę.
 * Stan (nadpisania/pominięcia) lokalny — zasila kolejne kroki M2 (M2c).
 */
export function UzgodnienieM2({ dane }: { dane: DaneDzialki }) {
  const [nadpisania, setNadpisania] = useState<Partial<Record<keyof DaneDzialki, string | number | boolean>>>({});
  const [pominiete, setPominiete] = useState<(keyof DaneDzialki)[]>([]);

  const w = useMemo(() => uzgodnijM2(dane, { nadpisania, pominiete }), [dane, nadpisania, pominiete]);

  function ustaw(klucz: keyof DaneDzialki, val: string | number | boolean) {
    setNadpisania((s) => ({ ...s, [klucz]: val }));
    setPominiete((p) => p.filter((k) => k !== klucz));
  }
  function wyczysc(klucz: keyof DaneDzialki) {
    setNadpisania((s) => {
      const kopia = { ...s };
      delete kopia[klucz];
      return kopia;
    });
  }
  function pomin(klucz: keyof DaneDzialki) {
    setPominiete((p) => (p.includes(klucz) ? p : [...p, klucz]));
    wyczysc(klucz);
  }
  function przywroc(klucz: keyof DaneDzialki) {
    setPominiete((p) => p.filter((k) => k !== klucz));
  }

  return (
    <Karta
      tytul="Uzgodnienie danych (Poziom 2)"
      podtytul="Pobrano automatycznie w tle — uzupełnij braki lub pomiń. Pominięcie obniża pewność, nigdy nie blokuje analizy."
      prawy={
        <span className="badge bg-grunt-surface-3 text-grunt-text-muted">
          pozyskano {w.pozyskanychPct}% · pewność {w.pewnosc}%
        </span>
      }
    >
      {/* A. Pozyskano automatycznie */}
      <SekcjaNaglowek tytul="A. Pozyskano automatycznie" licznik={w.sekcjaA.length} kolor="text-grunt-green" />
      {w.sekcjaA.length === 0 ? (
        <p className="text-[12px] text-grunt-text-faint2 mb-3">Brak danych pozyskanych automatycznie — uzupełnij poniżej lub pomiń.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {w.sekcjaA.map((p) => (
            <div key={String(p.klucz)} className="flex items-center justify-between gap-2 rounded-md border border-grunt-green/25 bg-grunt-green-bg/40 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12px] text-grunt-text truncate" title={p.etykieta}>{p.etykieta}</div>
                <div className="text-[10px] text-grunt-text-faint2">{p.zrodlo} · pewność {p.pewnosc}%</div>
              </div>
              <span className="mono text-[13px] font-medium text-grunt-green whitespace-nowrap">{wartoscPolaTekst(p)}</span>
            </div>
          ))}
        </div>
      )}

      {/* B. Do uzupełnienia ręcznego */}
      <SekcjaNaglowek tytul="B. Do uzupełnienia ręcznego" licznik={w.sekcjaB.length} kolor="text-grunt-amber-text" />
      {w.sekcjaB.length === 0 ? (
        <p className="text-[12px] text-grunt-text-faint2 mb-3">Wszystkie pola uzupełnialne są pozyskane.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {w.sekcjaB.map((p) => (
            <WierszUzupelnienia
              key={String(p.klucz)}
              pole={p}
              onUstaw={(v) => ustaw(p.klucz, v)}
              onPomin={() => pomin(p.klucz)}
              onPrzywroc={() => przywroc(p.klucz)}
            />
          ))}
        </div>
      )}

      {/* C. Niedostępne automatycznie */}
      {w.sekcjaC.length > 0 && (
        <>
          <SekcjaNaglowek tytul="C. Niedostępne automatycznie (statystyka)" licznik={w.sekcjaC.length} kolor="text-grunt-text-muted" />
          <div className="flex flex-wrap gap-2">
            {w.sekcjaC.map((p) => (
              <span key={String(p.klucz)} className="badge bg-grunt-neutral-bg text-grunt-text-muted" title={`${p.zrodloAuto} — obniża pewność`}>
                {p.etykieta}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-grunt-text-faint2 mt-1.5">Dane statystyczne bez pola ręcznego — nieobecność tylko obniża pewność.</p>
        </>
      )}
    </Karta>
  );
}

function SekcjaNaglowek({ tytul, licznik, kolor }: { tytul: string; licznik: number; kolor: string }) {
  return (
    <div className={`text-[11px] uppercase tracking-wide mb-2 flex items-center gap-2 ${kolor}`}>
      {tytul} <span className="badge bg-grunt-surface-3 text-grunt-text-muted">{licznik}</span>
    </div>
  );
}

function WierszUzupelnienia({
  pole,
  onUstaw,
  onPomin,
  onPrzywroc,
}: {
  pole: PoleM2;
  onUstaw: (v: string | number | boolean) => void;
  onPomin: () => void;
  onPrzywroc: () => void;
}) {
  const pominiete = pole.status === "pominiete";
  const gate = pole.manualFallback === "gate";
  return (
    <div className={`rounded-md border px-3 py-2.5 ${pominiete ? "border-grunt-border bg-grunt-surface-3 opacity-70" : gate ? "border-grunt-amber/30 bg-grunt-amber-bg/30" : "border-grunt-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-grunt-text">
            {pole.etykieta} {gate && <span className="badge bg-grunt-amber-bg text-grunt-amber-text text-[10px] ml-1">bramka</span>}
          </div>
          {pole.podpowiedz && <div className="text-[11px] text-grunt-text-faint2">źródło: {pole.podpowiedz}</div>}
        </div>
        {pominiete ? (
          <button type="button" onClick={onPrzywroc} className="text-[11px] text-grunt-text-muted underline whitespace-nowrap">przywróć</button>
        ) : (
          <button type="button" onClick={onPomin} className="text-[11px] text-grunt-text-muted underline whitespace-nowrap">Pomiń</button>
        )}
      </div>
      {!pominiete && (
        <div className="mt-2">
          <PoleWejscia pole={pole} onUstaw={onUstaw} />
          {gate && (
            <p className="text-[10px] text-grunt-amber-text mt-1">
              Bramka: można dodać ograniczenie, ale zniesienie wymaga dokumentu (nie samej deklaracji).
            </p>
          )}
        </div>
      )}
      {pominiete && <p className="text-[11px] text-grunt-text-faint2 mt-1">Pominięte — „do weryfikacji", obniża pewność.</p>}
    </div>
  );
}

function PoleWejscia({ pole, onUstaw }: { pole: PoleM2; onUstaw: (v: string | number | boolean) => void }) {
  const val = pole.status === "pozyskane" ? pole.wartosc : null;
  if (pole.typWartosci === "zlozone") {
    return <p className="text-[11px] text-grunt-text-muted2">Uzupełnij w sekcji „planistyka (A±)" poniżej — wskaźniki z wypisu MPZP.</p>;
  }
  if (pole.typWartosci === "flaga") {
    const cur = val === true ? "tak" : val === false ? "nie" : "";
    return (
      <select
        value={cur}
        onChange={(e) => onUstaw(e.target.value === "tak")}
        className="inp bg-white max-w-[180px]"
      >
        <option value="">— wybierz —</option>
        <option value="nie">nie</option>
        <option value="tak">tak</option>
      </select>
    );
  }
  if (pole.typWartosci === "liczba") {
    return (
      <input
        type="number"
        step="any"
        defaultValue={val == null ? "" : String(val)}
        onChange={(e) => e.target.value !== "" && onUstaw(Number(e.target.value))}
        placeholder={pole.jednostka ? `wartość (${pole.jednostka})` : "wartość"}
        className="inp max-w-[180px]"
      />
    );
  }
  return (
    <input
      type="text"
      defaultValue={val == null ? "" : String(val)}
      onChange={(e) => onUstaw(e.target.value)}
      placeholder="wartość"
      className="inp max-w-[220px]"
    />
  );
}
