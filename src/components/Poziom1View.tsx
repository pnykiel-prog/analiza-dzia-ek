import type { Profil, Werdykt, WynikPoziom1, WynikWymiaru } from "@/lib/types";
import { Karta, Statystyka, Flagi } from "./ui";
import { WskaznikPewnosci } from "./grunt";
import { etykietaProfilu, liczba, pct, statusSlowny } from "@/lib/format";

const STATUS_BRAMKI: Record<string, { etykieta: string; klasa: string }> = {
  pass: { etykieta: "pass", klasa: "bg-grunt-green-bg text-grunt-green" },
  warunkowo: { etykieta: "warunkowo", klasa: "bg-grunt-amber-bg text-grunt-amber-text" },
  fail: { etykieta: "fail", klasa: "bg-grunt-red-bg text-grunt-red" },
  do_weryfikacji: { etykieta: "do weryfikacji", klasa: "bg-grunt-neutral-bg text-grunt-text-muted" },
};

export function Poziom1View({ p1 }: { p1: WynikPoziom1 }) {
  const k = p1.kluczoweLiczby;
  return (
    <>
      {/* Werdykt i profile */}
      {p1.pewnosc < 100 && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-amber/25 bg-grunt-amber-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-amber text-white text-[13px] font-bold">!</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-amber-text">Wynik częściowy</div>
            <div className="text-[12px] text-grunt-text-muted">Część danych to białe plamy — pewność obniżona; werdykt do potwierdzenia w Poziomie 2. Brak danej nie blokuje analizy.</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <KartaWerdyktu
          nazwa="Młodzi"
          profil="mlodzi"
          rekomendowany={p1.profilRekomendowany === "mlodzi" || p1.profilRekomendowany === "oba"}
          score={p1.scoreMlodzi}
          werdykt={p1.werdyktMlodzi}
          pewnosc={p1.pewnosc}
          drivery={drivery(p1.wymiary, "mlodzi")}
        />
        <KartaWerdyktu
          nazwa="Seniorzy"
          profil="seniorzy"
          rekomendowany={p1.profilRekomendowany === "seniorzy" || p1.profilRekomendowany === "oba"}
          score={p1.scoreSeniorzy}
          werdykt={p1.werdyktSeniorzy}
          pewnosc={p1.pewnosc}
          drivery={drivery(p1.wymiary, "seniorzy")}
        />
      </div>
      <div className="text-[13px] text-grunt-text-muted">
        Profil rekomendowany: <strong className="text-grunt-text">{etykietaProfilu[p1.profilRekomendowany]}</strong>
      </div>

      {/* Kluczowe liczby */}
      <Karta tytul="Kluczowe liczby">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Statystyka etykieta="Pułap czynszu SIM" wartosc={`${liczba(k.pulapCzynszuSimM2, " zł/m²", 1)}`} />
          <Statystyka etykieta="Czynsz rynkowy" wartosc={liczba(k.czynszRynkowyM2, " zł/m²")} />
          <Statystyka etykieta="Luka najemcy" wartosc={pct(k.lukaNajemcyPct)} akcent />
          <Statystyka etykieta="Koszt / wart. odtworzeniowa" wartosc={pct(k.relacjaKosztDoWartOdtworzeniowejPct)} />
          <Statystyka etykieta="Dojazd do aglomeracji" wartosc={liczba(k.czasDojazdAglomeracjaMin, " min")} />
          <Statystyka etykieta="Średni spadek terenu" wartosc={pct(k.sredniSpadekPct)} />
        </div>
      </Karta>

      {/* Bramki */}
      <Karta tytul="Warstwa 0 — bramki (twarde wykluczenia)" podtytul="Liczone przed punktacją">
        <div className="space-y-1.5">
          {p1.bramki.szczegoly.map((b, i) => {
            const s = STATUS_BRAMKI[b.status];
            return (
              <div key={i} className="flex items-start gap-3 text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span className={`badge ${s.klasa} shrink-0`}>{s.etykieta}</span>
                <div>
                  <span className="text-slate-700">{b.nazwa}</span>
                  <span className="text-slate-400"> · {b.zrodlo}</span>
                  <div className="text-xs text-slate-500">{b.uzasadnienie}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Karta>

      {/* Wymiary */}
      <Karta tytul="Pięć wymiarów oceny (W1–W5)" podtytul="Wymiar = średnia ważona metryk; wynik profilu = średnia ważona wymiarów">
        <div className="space-y-4">
          {p1.wymiary.map((w) => (
            <div key={w.kod} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-700">
                  <span className="text-slate-400 mr-1">{w.kod}</span> {w.nazwa}
                </div>
                <div className="text-xs text-slate-500 flex gap-4">
                  <span>młodzi <strong className="text-slate-700">{Math.round(w.punktyMlodzi)}</strong> · waga {w.wagaMlodzi}</span>
                  <span>seniorzy <strong className="text-slate-700">{Math.round(w.punktySeniorzy)}</strong> · waga {w.wagaSeniorzy}</span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5">
                {w.metryki.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate pr-2">
                      {m.nazwa}
                      {m.profil && <span className="text-slate-400"> ({m.profil === "mlodzi" ? "M" : "S"})</span>}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400">{m.wartosc}</span>
                      <span className={`font-medium ${m.fallback ? "text-slate-400 italic" : "text-slate-700"}`}>
                        {Math.round(m.punkty)}
                        {m.fallback && "*"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400">* metryka z brakiem danych — użyto wartości neutralnej (mediany), obniża pewność.</p>
        </div>
      </Karta>

      {p1.flagi.length > 0 && (
        <Karta tytul="Flagi">
          <Flagi flagi={p1.flagi} />
        </Karta>
      )}
    </>
  );
}

const KOLOR_STATUSU: Record<Werdykt, string> = {
  zielony: "text-grunt-green",
  zolty: "text-grunt-amber",
  czerwony: "text-grunt-red",
};

/** Top-3 „drivery" profilu = metryki o najwyższej punktacji (bez fallbacków). */
function drivery(wymiary: WynikWymiaru[], profil: Profil): string[] {
  return wymiary
    .flatMap((w) => w.metryki)
    .filter((m) => (!m.profil || m.profil === profil) && !m.fallback && m.wartosc !== "brak danych")
    .sort((a, b) => b.punkty - a.punkty)
    .slice(0, 3)
    .map((m) => `${m.nazwa}: ${m.wartosc}`);
}

function KartaWerdyktu({
  nazwa,
  profil,
  rekomendowany,
  score,
  werdykt,
  pewnosc,
  drivery,
}: {
  nazwa: string;
  profil: Profil;
  rekomendowany: boolean;
  score: number;
  werdykt: Werdykt;
  pewnosc: number;
  drivery: string[];
}) {
  const tint = profil === "mlodzi" ? "bg-grunt-young-bg" : "bg-grunt-senior-bg";
  const dot = profil === "mlodzi" ? "bg-grunt-young" : "bg-grunt-senior";
  const txt = profil === "mlodzi" ? "text-grunt-young" : "text-grunt-senior";
  const stKolor = KOLOR_STATUSU[werdykt];
  return (
    <div className={`relative rounded-card border overflow-hidden ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${tint}`}>
        <span className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className={`text-[13px] font-semibold ${txt}`}>Profil: {nazwa}</span>
        </span>
        {rekomendowany && (
          <span className="badge bg-grunt-ink text-white text-[10px]">★ REKOMENDOWANY PROFIL</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-end justify-between">
          <span className={`flex items-center gap-2 text-[22px] font-semibold ${stKolor}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${werdykt === "zielony" ? "bg-grunt-green" : werdykt === "zolty" ? "bg-grunt-amber" : "bg-grunt-red"}`} />
            {statusSlowny[werdykt]}
          </span>
          <span className="mono text-[38px] font-semibold leading-none text-grunt-text">
            {score}
            <span className="text-[15px] text-grunt-text-faint2">/100</span>
          </span>
        </div>
        <div className="mt-3">
          <WskaznikPewnosci pewnosc={pewnosc} />
        </div>
        {drivery.length > 0 && (
          <ul className="mt-3 space-y-1">
            {drivery.map((d, i) => (
              <li key={i} className="text-[12px] text-grunt-text-muted flex gap-1.5">
                <span className="text-grunt-text-faint">—</span> {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
