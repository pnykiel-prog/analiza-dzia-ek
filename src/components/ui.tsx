import type { Werdykt } from "@/lib/types";
import { etykietaWerdyktu, kolorWerdyktu } from "@/lib/format";

export function WerdyktBadge({ w, etykieta }: { w: Werdykt; etykieta?: string }) {
  const k = kolorWerdyktu(w);
  return (
    <span className={`badge ${k.bg} ${k.text}`}>
      <span className={`w-2 h-2 rounded-full ${k.kropka}`} />
      {etykieta ?? etykietaWerdyktu[w]}
    </span>
  );
}

/** Pasek 0–100 z kolorem zależnym od wartości. */
export function Pasek({ wartosc, etykieta }: { wartosc: number; etykieta?: string }) {
  const kolor = wartosc >= 70 ? "bg-green-500" : wartosc >= 45 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      {etykieta && <div className="flex justify-between text-xs text-slate-500 mb-0.5">{etykieta}</div>}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${kolor} rounded-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, wartosc))}%` }} />
      </div>
    </div>
  );
}

export function Karta({
  tytul,
  podtytul,
  prawy,
  children,
}: {
  tytul?: string;
  podtytul?: string;
  prawy?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      {(tytul || prawy) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {tytul && <h3 className="font-semibold text-slate-800">{tytul}</h3>}
            {podtytul && <p className="text-xs text-slate-500 mt-0.5">{podtytul}</p>}
          </div>
          {prawy}
        </div>
      )}
      {children}
    </section>
  );
}

export function Flagi({ flagi, ton = "ostrzezenie" }: { flagi: string[]; ton?: "ostrzezenie" | "info" }) {
  if (!flagi.length) return null;
  const styl = ton === "info" ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <ul className="space-y-1.5">
      {flagi.map((f, i) => (
        <li key={i} className={`text-sm px-3 py-2 rounded-lg border ${styl}`}>
          ⚑ {f}
        </li>
      ))}
    </ul>
  );
}

export function Statystyka({ etykieta, wartosc, akcent }: { etykieta: string; wartosc: React.ReactNode; akcent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${akcent ? "bg-slate-900 text-white" : "bg-slate-50"}`}>
      <div className={`text-xs ${akcent ? "text-slate-300" : "text-slate-500"}`}>{etykieta}</div>
      <div className="text-lg font-semibold mt-0.5">{wartosc}</div>
    </div>
  );
}

export function Sekcja({ numer, tytul, opis, children }: { numer: string; tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <div className="scroll-mt-4" id={`poziom-${numer}`}>
      <div className="flex items-center gap-3 mb-3 mt-8">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 text-white font-bold text-sm">
          {numer}
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{tytul}</h2>
          <p className="text-xs text-slate-500">{opis}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
