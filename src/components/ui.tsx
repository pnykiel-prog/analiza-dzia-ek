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

/** Pasek 0–100 z kolorem semantycznym zależnym od wartości. */
export function Pasek({ wartosc, etykieta }: { wartosc: number; etykieta?: string }) {
  const kolor = wartosc >= 70 ? "bg-grunt-green" : wartosc >= 45 ? "bg-grunt-amber" : "bg-grunt-red";
  return (
    <div>
      {etykieta && <div className="flex justify-between text-[11px] text-grunt-text-muted2 mb-0.5">{etykieta}</div>}
      <div className="h-2 bg-grunt-surface-3 rounded-full overflow-hidden">
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
    <section className="card p-[18px]">
      {(tytul || prawy) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {tytul && <h3 className="text-[14px] font-semibold text-grunt-text">{tytul}</h3>}
            {podtytul && <p className="text-[11px] text-grunt-text-muted2 mt-0.5">{podtytul}</p>}
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
  const styl =
    ton === "info"
      ? "bg-grunt-neutral-bg text-grunt-text-muted border-grunt-border"
      : "bg-grunt-amber-bg text-grunt-amber-text border-grunt-amber/30";
  return (
    <ul className="space-y-1.5">
      {flagi.map((f, i) => (
        <li key={i} className={`text-[12.5px] px-3 py-2 rounded-md border ${styl}`}>
          ⚑ {f}
        </li>
      ))}
    </ul>
  );
}

export function Statystyka({ etykieta, wartosc, akcent }: { etykieta: string; wartosc: React.ReactNode; akcent?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${akcent ? "bg-grunt-ink text-white" : "bg-grunt-surface-3"}`}>
      <div className={`text-[11px] ${akcent ? "text-grunt-text-ghost" : "text-grunt-text-muted2"}`}>{etykieta}</div>
      <div className="mono text-lg font-semibold mt-0.5">{wartosc}</div>
    </div>
  );
}

export function Sekcja({ numer, tytul, opis, children }: { numer: string; tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <div className="scroll-mt-4" id={`poziom-${numer}`}>
      <div className="flex items-center gap-3 mb-3 mt-8">
        <span className="mono flex items-center justify-center w-9 h-9 rounded-md bg-grunt-ink text-white font-bold text-sm">
          {numer}
        </span>
        <div>
          <h2 className="text-lg font-bold text-grunt-text tracking-[-0.01em]">{tytul}</h2>
          <p className="text-[11px] text-grunt-text-muted2">{opis}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
