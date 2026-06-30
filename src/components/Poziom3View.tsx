import type { WynikPoziom3, WynikScenariusza } from "@/lib/types";
import { Karta, Statystyka, Flagi } from "./ui";
import { etykietaRezimu, etykietaScenariusza, liczba, pct, plnMln } from "@/lib/format";

function KomorkaDomyka({ s }: { s: WynikScenariusza }) {
  return s.domyka ? (
    <span className="badge bg-green-100 text-green-800">domyka ✓</span>
  ) : (
    <span className="badge bg-red-100 text-red-800">nie domyka</span>
  );
}

export function Poziom3View({ p3 }: { p3: WynikPoziom3 }) {
  const os = p3.osCzasu;
  const oczekiwany = p3.scenariusze.find((s) => s.scenariusz === "oczekiwany")!;

  return (
    <>
      {/* Oś czasu */}
      <Karta
        tytul="Oś czasu realizacji"
        podtytul="Parametry liczone na datę naboru/startu budowy i oddania, nie na dziś"
        prawy={
          <span className="text-xs text-slate-500">
            Start budowy: <strong>{os.rokStartuBudowy}</strong> · Oddanie: <strong>{os.rokOddania}</strong>
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {os.fazy.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                <div className="font-medium text-slate-700">{f.nazwa}</div>
                <div className="text-slate-400">{f.miesiace > 0 ? `${f.miesiace} mies.` : "T0"}</div>
              </div>
              {i < os.fazy.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      </Karta>

      {/* Werdykt ekonomiczny — przedział scenariuszowy */}
      <Karta
        tytul="Werdykt ekonomiczny — przedział scenariuszowy"
        podtytul={`Domyślny reżim: ${etykietaRezimu[p3.rezimDomyslny]} · wariant: ${p3.wariantNazwa}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Scenariusz</th>
                <th className="py-2 px-3">Reżim</th>
                <th className="py-2 px-3 text-right">Koszt</th>
                <th className="py-2 px-3 text-right">Czynsz / pułap</th>
                <th className="py-2 px-3 text-right">DSCR</th>
                <th className="py-2 px-3 text-right">Wymagana dotacja</th>
                <th className="py-2 pl-3">Domknięcie</th>
              </tr>
            </thead>
            <tbody>
              {p3.scenariusze.map((s) => (
                <tr key={s.scenariusz} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{etykietaScenariusza[s.scenariusz]}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500">{etykietaRezimu[s.rezim]}</td>
                  <td className="py-2.5 px-3 text-right">{plnMln(s.koszt.razem)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={s.czynszPrzekraczaPulap ? "text-amber-700" : "text-slate-700"}>
                      {liczba(s.czynszWynikowyM2, "", 1)} / {liczba(s.pulapCzynszuM2, " zł", 1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={s.dscr >= 1 ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                      {liczba(s.dscr, "", 2)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium">{pct(s.wymaganaDotacjaPct, 1)}</td>
                  <td className="py-2.5 pl-3">
                    <KomorkaDomyka s={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p3.petlaZwrotna && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            ↩ Pętla zwrotna P3 → P2: program nie domyka się w scenariuszu oczekiwanym — należy wrócić po inny wariant
            zabudowy (niższy koszt, większa intensywność lub partycypacja).
          </p>
        )}
      </Karta>

      {/* Montaż finansowy scenariusza oczekiwanego */}
      <Karta tytul="Montaż finansowy (scenariusz oczekiwany)" podtytul="Grant + kredyt + partycypacje + wkład = koszt przedsięwzięcia">
        <MontazPasek s={oczekiwany} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          <Statystyka etykieta="Koszt przedsięwzięcia" wartosc={plnMln(oczekiwany.koszt.razem)} akcent />
          <Statystyka etykieta="Grant (bezzwrotny)" wartosc={plnMln(oczekiwany.montaz.grant)} />
          <Statystyka etykieta="Kredyt BGK" wartosc={plnMln(oczekiwany.montaz.kredyt)} />
          <Statystyka etykieta="Partycypacja najemców" wartosc={plnMln(oczekiwany.montaz.partycypacjaNajemcow)} />
          <Statystyka etykieta="Wymagana dotacja publiczna" wartosc={plnMln(oczekiwany.montaz.wymaganaDotacja)} />
          <Statystyka etykieta="Rata roczna kredytu" wartosc={plnMln(oczekiwany.rataRocznaKredytu)} />
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-500 mb-2">Składniki kosztu</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-600">
            <Wiersz e="Grunt" v={oczekiwany.koszt.grunt} />
            <Wiersz e="Budowa (pod klucz)" v={oczekiwany.koszt.budowa} />
            <Wiersz e="Uzbrojenie" v={oczekiwany.koszt.uzbrojenie} />
            <Wiersz e="Projekt i przygotowanie" v={oczekiwany.koszt.projektPrzygotowanie} />
            <Wiersz e="Koszty finansowe" v={oczekiwany.koszt.kosztyFinansowe} />
            <Wiersz e="Rezerwa na ryzyko" v={oczekiwany.koszt.rezerwa} />
          </div>
        </div>
      </Karta>

      {/* Wrażliwość */}
      <Karta tytul="Analiza wrażliwości" podtytul="Wpływ na wymaganą dotację (punkty procentowe) względem scenariusza oczekiwanego">
        <div className="space-y-1.5">
          {p3.wrazliwosc.map((w, i) => {
            const dodatni = w.wplywNaDotacjePp > 0;
            const szer = Math.min(100, Math.abs(w.wplywNaDotacjePp) * 4);
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-40 text-slate-600 text-xs shrink-0">
                  {w.parametr} <span className="text-slate-400">{w.zmiana}</span>
                </span>
                <div className="flex-1 flex items-center">
                  <div className="w-1/2 flex justify-end">
                    {!dodatni && <div className="bg-green-400 h-3 rounded-l" style={{ width: `${szer}%` }} />}
                  </div>
                  <div className="w-px h-4 bg-slate-300" />
                  <div className="w-1/2">
                    {dodatni && <div className="bg-red-400 h-3 rounded-r" style={{ width: `${szer}%` }} />}
                  </div>
                </div>
                <span className={`w-16 text-right text-xs font-medium ${dodatni ? "text-red-700" : "text-green-700"}`}>
                  {dodatni ? "+" : ""}
                  {liczba(w.wplywNaDotacjePp, " pp", 1)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Zielony = mniejsza wymagana dotacja (lepiej), czerwony = większa. Wydłużenie okresu kredytu i niska stopa to
          najsilniejsze dźwignie poprawiające wykonalność.
        </p>
      </Karta>

      {p3.flagi.length > 0 && (
        <Karta tytul="Flagi i niepewność">
          <Flagi flagi={p3.flagi} />
        </Karta>
      )}
    </>
  );
}

function Wiersz({ e, v }: { e: string; v: number }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-0.5">
      <span>{e}</span>
      <span className="text-slate-700">{plnMln(v)}</span>
    </div>
  );
}

function MontazPasek({ s }: { s: WynikScenariusza }) {
  const koszt = s.koszt.razem;
  const czesci = [
    { e: "Grant", v: s.montaz.grant, kolor: "bg-green-500" },
    { e: "Kredyt", v: s.montaz.kredyt, kolor: "bg-blue-500" },
    { e: "Partycypacja", v: s.montaz.partycypacjaNajemcow, kolor: "bg-violet-500" },
    { e: "Wkład gminy", v: s.montaz.wkladGminy, kolor: "bg-amber-500" },
    { e: "Luka / środki własne", v: s.montaz.srodkiWlasne, kolor: "bg-slate-400" },
  ].filter((c) => c.v > 0);
  return (
    <div>
      <div className="flex h-6 rounded-lg overflow-hidden">
        {czesci.map((c, i) => (
          <div key={i} className={`${c.kolor} flex items-center justify-center`} style={{ width: `${(c.v / koszt) * 100}%` }} title={`${c.e}: ${plnMln(c.v)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {czesci.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-sm ${c.kolor}`} /> {c.e} ({pct((c.v / koszt) * 100)})
          </span>
        ))}
      </div>
    </div>
  );
}
