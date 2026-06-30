import type { WynikPoziom2 } from "@/lib/types";
import { Karta, Statystyka, Flagi } from "./ui";
import { etykietaTypologii, liczba } from "@/lib/format";

const ZRODLO_OBWIEDNI: Record<string, string> = {
  mpzp: "MPZP (twarde wskaźniki)",
  plan_ogolny: "Plan ogólny / OUZ",
  sasiedztwo_fallback: "Fallback z sąsiedztwa (brak MPZP)",
};

export function Poziom2View({ p2 }: { p2: WynikPoziom2 }) {
  const o = p2.obwiednia;
  return (
    <>
      <Karta
        tytul="Krok 1 — obwiednia zabudowy"
        podtytul="Twardy limit: ile wolno i co się zmieści (z parametrów planistycznych)"
        prawy={<span className="text-xs text-slate-500">Pewność obwiedni: <strong>{o.pewnoscObwiedni}%</strong></span>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Statystyka etykieta="Max pow. zabudowy" wartosc={liczba(o.maxPowZabudowyM2, " m²")} />
          <Statystyka etykieta="Pow. całkowita nadziemna" wartosc={liczba(o.powCalkowitaNadziemnaM2, " m²")} />
          <Statystyka etykieta="PUM (szac.)" wartosc={liczba(o.pumM2, " m²")} akcent />
          <Statystyka etykieta="Max kondygnacje" wartosc={liczba(o.maxKondygnacje)} />
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Źródło wskaźników: <strong className="text-slate-700">{ZRODLO_OBWIEDNI[o.zrodloWskaznikow]}</strong>
        </div>
      </Karta>

      <Karta tytul="Warianty modelu zabudowy" podtytul="Kroki 2–4: typologia → program pod profil → wynik">
        <div className="grid gap-4 lg:grid-cols-2">
          {p2.warianty.map((w, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-slate-800">{w.nazwa}</div>
                  <div className="text-xs text-slate-500">{etykietaTypologii[w.typologia]}</div>
                </div>
                <span className="badge bg-slate-100 text-slate-600">{w.profil === "mlodzi" ? "młodzi" : "seniorzy"}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 my-3">
                <Statystyka etykieta="Mieszkania" wartosc={liczba(w.liczbaMieszkan)} akcent />
                <Statystyka etykieta="Kondygnacje" wartosc={liczba(w.liczbaKondygnacji)} />
                <Statystyka etykieta="PUM" wartosc={liczba(w.pumM2, " m²")} />
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Pow. zabudowy</span>
                  <span>{liczba(w.powZabudowyM2, " m²")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pow. wspólne / usługowe</span>
                  <span>{liczba(w.powWspolneUslugoweM2, " m²")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Miejsca parkingowe</span>
                  <span>
                    {liczba(w.miejscaParkingowe)} {w.parkingPodziemny ? "(podziemny)" : "(naziemny)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Winda</span>
                  <span>{w.windaWymagana ? "wymagana" : "wg wysokości"}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-medium text-slate-500 mb-1">Mix metraży</div>
                <div className="space-y-1">
                  {w.mixMetrazy.map((m, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 bg-slate-100 rounded h-4 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-slate-400" style={{ width: `${m.udzialPct}%` }} />
                        <span className="absolute inset-0 flex items-center px-2 text-slate-700">{m.etykieta}</span>
                      </div>
                      <span className="text-slate-500 w-10 text-right">{m.udzialPct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">{w.uzasadnienie}</p>
            </div>
          ))}
        </div>
      </Karta>

      {p2.flagiRyzyka.length > 0 && (
        <Karta tytul="Flagi ryzyka">
          <Flagi flagi={p2.flagiRyzyka} />
        </Karta>
      )}
    </>
  );
}
