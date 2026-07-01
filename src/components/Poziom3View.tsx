import type { OsCzasu, WynikPoziom3, WynikScenariusza } from "@/lib/types";
import { Karta, Statystyka, Flagi } from "./ui";
import { StosMontazu, type SegmentStosu } from "./grunt";
import { AnalizaFinansowaView } from "./AnalizaFinansowaView";
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
      {/* Analiza z ankiety finansowej — dobrany montaż (brama P3) */}
      {p3.analizaFinansowa && <AnalizaFinansowaView a={p3.analizaFinansowa} />}

      {/* Oś czasu — proporcjonalny pasek faz z markerem reżimu */}
      <Karta tytul="Oś czasu realizacji" podtytul="Parametry liczone na datę naboru/startu budowy i oddania, nie na dziś">
        <OsCzasuBar os={os} />
      </Karta>

      {/* Hero: stos montażu + domknięcie (jak w prototypie) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Karta tytul="Stos montażu finansowego" prawy={<span className="mono text-[15px] font-semibold text-grunt-text">{plnMln(oczekiwany.koszt.razem)}</span>}>
          <StosMontazu segmenty={segmentyMontazu(oczekiwany)} />
        </Karta>
        <DomkniecieKarta p3={p3} oczekiwany={oczekiwany} />
      </div>

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

      {/* Montaż finansowy scenariusza oczekiwanego — szczegóły liczbowe */}
      <Karta tytul="Montaż finansowy (scenariusz oczekiwany)" podtytul="Grant + kredyt + partycypacje + wkład = koszt przedsięwzięcia">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

/** Segmenty stosu montażu (udziały w koszcie przedsięwzięcia). */
function segmentyMontazu(s: WynikScenariusza): SegmentStosu[] {
  const koszt = s.koszt.razem || 1;
  const def: { nazwa: string; v: number; kolor: string }[] = [
    { nazwa: "Grant", v: s.montaz.grant, kolor: "bg-grunt-chart-1" },
    { nazwa: "Kredyt", v: s.montaz.kredyt, kolor: "bg-grunt-ink" },
    { nazwa: "Partycypacja", v: s.montaz.partycypacjaNajemcow, kolor: "bg-grunt-chart-4" },
    { nazwa: "Wkład gminy", v: s.montaz.wkladGminy, kolor: "bg-grunt-chart-6" },
    { nazwa: "Luka / środki własne", v: s.montaz.srodkiWlasne, kolor: "bg-grunt-border-soft" },
  ];
  return def
    .filter((c) => c.v > 0)
    .map((c) => ({ nazwa: c.nazwa, kolor: c.kolor, udzialPct: Math.round((c.v / koszt) * 100), wartosc: plnMln(c.v) }));
}

/** Proporcjonalny pasek osi czasu z markerem „reżim liczony tu" (start budowy). */
function OsCzasuBar({ os }: { os: OsCzasu }) {
  // Fazy z konfiguracji + syntetyczny ogon „Najem / eksploatacja" (~40% szerokości).
  const fazy = os.fazy.filter((f) => f.miesiace > 0);
  const sumaFaz = fazy.reduce((a, f) => a + f.miesiace, 0) || 1;
  const ogon = Math.round(sumaFaz * 0.8); // eksploatacja — pas orientacyjny
  const total = sumaFaz + ogon;
  const kolory = ["bg-grunt-chart-5", "bg-grunt-chart-4", "bg-grunt-chart-3", "bg-grunt-ink"];
  const markerPct = (os.miesiacyDoStartuBudowy / total) * 100;
  return (
    <div>
      <div className="relative flex h-9 rounded-sm overflow-hidden" style={{ gap: "2px" }}>
        {fazy.map((f, i) => (
          <div key={i} className={`${kolory[Math.min(i, kolory.length - 2)]} grid place-items-center px-2`} style={{ width: `${(f.miesiace / total) * 100}%` }}>
            <span className="text-[10px] text-white/90 truncate">{f.nazwa}</span>
          </div>
        ))}
        <div className="bg-grunt-ink grid place-items-center px-2" style={{ width: `${(ogon / total) * 100}%` }}>
          <span className="text-[10px] text-white/90 truncate">Najem / eksploatacja</span>
        </div>
        {/* marker reżimu */}
        <div className="absolute top-0 bottom-0" style={{ left: `${markerPct}%` }}>
          <span className="absolute -top-0.5 -translate-x-1/2 badge bg-grunt-senior text-white text-[9px] whitespace-nowrap">⚑ Reżim liczony tu</span>
          <span className="absolute top-5 bottom-0 w-px bg-grunt-senior -translate-x-1/2" />
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-grunt-text-faint2 mono">
        <span>{os.rokStartuBudowy - Math.round(os.miesiacyDoStartuBudowy / 12)}</span>
        <span>start budowy {os.rokStartuBudowy}</span>
        <span>oddanie {os.rokOddania}</span>
      </div>
    </div>
  );
}

/** Karta domknięcia: werdykt DSCR (próg 1,20), przedział DSCR i czynsz vs pułap. */
function DomkniecieKarta({ p3, oczekiwany }: { p3: WynikPoziom3; oczekiwany: WynikScenariusza }) {
  const PROG = 1.2;
  const spina = oczekiwany.dscr >= PROG;
  const dscry = p3.scenariusze.map((s) => s.dscr);
  const minD = Math.min(...dscry, PROG) * 0.95;
  const maxD = Math.max(...dscry, PROG) * 1.05;
  const pozycja = (v: number) => `${((v - minD) / (maxD - minD || 1)) * 100}%`;
  const czynsz = oczekiwany.czynszWynikowyM2;
  const pulap = oczekiwany.pulapCzynszuM2;
  const maxCzynsz = Math.max(czynsz, pulap) * 1.15 || 1;
  return (
    <div className={`card p-[18px] border-l-4 ${spina ? "border-l-grunt-green" : "border-l-grunt-amber"}`}>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${spina ? "bg-grunt-green" : "bg-grunt-amber"}`} />
        <span className={`text-[16px] font-semibold ${spina ? "text-grunt-green" : "text-grunt-amber-text"}`}>
          {spina ? "Inwestycja się spina" : "Domknięcie na granicy"}
        </span>
      </div>
      <p className="text-[12px] text-grunt-text-muted mt-1">
        DSCR {spina ? "powyżej" : "poniżej"} progu {PROG.toFixed(2).replace(".", ",")} w scenariuszu oczekiwanym.
      </p>

      {/* DSCR — przedział */}
      <div className="mt-4">
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">
          <span>DSCR — przedział</span>
          <span className="mono">próg {PROG.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="relative h-2 bg-grunt-surface-3 rounded-full">
          <span className="absolute top-0 bottom-0 w-px bg-grunt-text-faint" style={{ left: pozycja(PROG) }} />
          <span className="absolute -top-0.5 h-3 w-3 rounded-full bg-grunt-ink -translate-x-1/2" style={{ left: pozycja(oczekiwany.dscr) }} />
        </div>
        <div className="flex justify-between mt-1 text-[11px] mono text-grunt-text-muted2">
          <span>konserw. {liczba(dscry[0], "", 2)}</span>
          <span className="font-semibold text-grunt-text">oczek. {liczba(oczekiwany.dscr, "", 2)}</span>
          <span>korzyst. {liczba(dscry[2], "", 2)}</span>
        </div>
      </div>

      {/* Czynsz wynikowy vs pułap */}
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">Czynsz wynikowy vs pułap zł/m²/mc</div>
        <div className="relative h-2 bg-grunt-surface-3 rounded-full">
          <div className="absolute top-0 bottom-0 left-0 rounded-full bg-grunt-chart-1" style={{ width: `${(czynsz / maxCzynsz) * 100}%` }} />
          <span className="absolute -top-1 text-grunt-amber" style={{ left: `${(pulap / maxCzynsz) * 100}%` }}>▏</span>
        </div>
        <div className="flex justify-between mt-1 text-[11px] mono text-grunt-text-muted2">
          <span className="text-grunt-chart-1 font-semibold">wynikowy {liczba(czynsz, "", 1)}</span>
          <span className="text-grunt-amber-text">pułap {liczba(pulap, "", 1)}</span>
        </div>
      </div>
    </div>
  );
}
