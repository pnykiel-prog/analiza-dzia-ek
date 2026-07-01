import type { WynikPoziom1 } from "@/lib/types";
import { Karta, Pasek, Statystyka, WerdyktBadge, Flagi } from "./ui";
import { WskaznikPewnosci } from "./grunt";
import { etykietaProfilu, liczba, pct } from "@/lib/format";

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
      <Karta
        tytul="Werdykt wstępny"
        podtytul="Dwa profile oceniane niezależnie (te same wymiary, inne wagi)"
        prawy={<WskaznikPewnosci pewnosc={p1.pewnosc} />}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <KartaWerdyktu
            nazwa="Dla młodych"
            profil="mlodzi"
            rekomendowany={p1.profilRekomendowany === "mlodzi" || p1.profilRekomendowany === "oba"}
            score={p1.scoreMlodzi}
            werdykt={p1.werdyktMlodzi}
          />
          <KartaWerdyktu
            nazwa="Senioralny"
            profil="seniorzy"
            rekomendowany={p1.profilRekomendowany === "seniorzy" || p1.profilRekomendowany === "oba"}
            score={p1.scoreSeniorzy}
            werdykt={p1.werdyktSeniorzy}
          />
        </div>
        <div className="mt-3 text-[13px] text-grunt-text-muted">
          Profil rekomendowany: <strong className="text-grunt-text">{etykietaProfilu[p1.profilRekomendowany]}</strong>
        </div>
        {p1.pewnosc < 70 && (
          <p className="text-[12px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded-md px-3 py-2 mt-3">
            Niski wskaźnik pewności — werdykt wstępny, do potwierdzenia w Poziomie 2 (białe plamy w danych). Brak
            danych nie blokuje analizy — obniża pewność.
          </p>
        )}
      </Karta>

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

function KartaWerdyktu({
  nazwa,
  profil,
  rekomendowany,
  score,
  werdykt,
}: {
  nazwa: string;
  profil: "mlodzi" | "seniorzy";
  rekomendowany: boolean;
  score: number;
  werdykt: import("@/lib/types").Werdykt;
}) {
  const tint = profil === "mlodzi" ? "bg-grunt-young-bg" : "bg-grunt-senior-bg";
  const dot = profil === "mlodzi" ? "bg-grunt-young" : "bg-grunt-senior";
  const txt = profil === "mlodzi" ? "text-grunt-young" : "text-grunt-senior";
  return (
    <div
      className={`relative rounded-panel border p-4 ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}
    >
      {rekomendowany && (
        <span className="absolute -top-2 right-3 badge bg-grunt-ink text-white">★ Rekomendowany</span>
      )}
      <div className={`flex items-center gap-2 -mx-4 -mt-4 mb-3 px-4 py-2 rounded-t-panel ${tint}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className={`text-[13px] font-semibold ${txt}`}>{nazwa}</span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className="mono text-[32px] font-semibold leading-none text-grunt-text">
          {score}
          <span className="text-[15px] text-grunt-text-faint2">/100</span>
        </span>
        <WerdyktBadge w={werdykt} />
      </div>
      <Pasek wartosc={score} />
    </div>
  );
}
