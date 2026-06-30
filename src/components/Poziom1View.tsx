import type { WynikPoziom1 } from "@/lib/types";
import { Karta, Pasek, Statystyka, WerdyktBadge, Flagi } from "./ui";
import { etykietaProfilu, liczba, pct } from "@/lib/format";

const STATUS_BRAMKI: Record<string, { etykieta: string; klasa: string }> = {
  pass: { etykieta: "pass", klasa: "bg-green-100 text-green-800" },
  warunkowo: { etykieta: "warunkowo", klasa: "bg-yellow-100 text-yellow-800" },
  fail: { etykieta: "fail", klasa: "bg-red-100 text-red-800" },
  do_weryfikacji: { etykieta: "do weryfikacji", klasa: "bg-slate-100 text-slate-600" },
};

export function Poziom1View({ p1 }: { p1: WynikPoziom1 }) {
  const k = p1.kluczoweLiczby;
  return (
    <>
      {/* Werdykt i profile */}
      <Karta
        tytul="Werdykt wstępny"
        podtytul="Dwa profile oceniane niezależnie (te same wymiary, inne wagi)"
        prawy={<span className="text-xs text-slate-500">Pewność: <strong>{p1.pewnosc}%</strong></span>}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-700">Dla młodych</span>
              <WerdyktBadge w={p1.werdyktMlodzi} etykieta={`${p1.scoreMlodzi}/100`} />
            </div>
            <Pasek wartosc={p1.scoreMlodzi} />
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-700">Senioralny</span>
              <WerdyktBadge w={p1.werdyktSeniorzy} etykieta={`${p1.scoreSeniorzy}/100`} />
            </div>
            <Pasek wartosc={p1.scoreSeniorzy} />
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Profil rekomendowany: <strong className="text-slate-800">{etykietaProfilu[p1.profilRekomendowany]}</strong>
        </div>
        {p1.pewnosc < 70 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Niski wskaźnik pewności — werdykt wstępny, do potwierdzenia w Poziomie 2 (białe plamy w danych).
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
