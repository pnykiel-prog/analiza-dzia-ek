import type { AnalizaFinansowa, SkladnikMontazu, Zakres } from "@/lib/finanse/typy";
import { ETYK_INWESTORA, ETYK_REZIMU, ETYK_ZASOBU } from "@/lib/finanse/etykiety";
import { Karta, Flagi } from "./ui";

const zakres = (z: Zakres, suf = "%") => (z.min === z.max ? `${z.min}${suf}` : `${z.min}–${z.max}${suf}`);

const KOLOR_SKLADNIKA: Record<SkladnikMontazu["klucz"], string> = {
  grant: "bg-grunt-chart-1",
  kredyt: "bg-grunt-ink",
  partycypacja: "bg-grunt-chart-4",
  kapital_wlasny: "bg-grunt-chart-6",
  grunt: "bg-grunt-border-soft",
};

export function AnalizaFinansowaView({ a }: { a: AnalizaFinansowa }) {
  const p = a.profil;
  return (
    <Karta
      tytul="Ankieta finansowa — dobrany montaż i instrumenty"
      podtytul="Profil finansowy z ankiety (brama Poziomu 3) steruje montażem, kredytem i ograniczeniami"
      prawy={
        <span className={`badge ${a.dostepZasobu === "pełen" ? "bg-green-100 text-green-700" : a.dostepZasobu === "ograniczony" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
          dostęp: {a.dostepZasobu}
        </span>
      }
    >
      {/* Profil */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
        <Pole e="Inwestor" v={ETYK_INWESTORA[p.typInwestora]} />
        <Pole e="Zasób" v={ETYK_ZASOBU[p.typZasobu]} />
        <Pole e="Reżim" v={ETYK_REZIMU[a.rezim]} />
        <Pole e="Data wniosku" v={p.dataWniosku || "—"} />
      </div>

      {a.zablokowana ? (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⛔ {a.ostrzezenia[0]} — zmień typ inwestora, zasób lub reżim w ankiecie.
        </p>
      ) : (
        <>
          {/* Montaż — udziały maksymalne/orientacyjne w CAPEX */}
          <div className="mb-4">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Dostępny montaż (maksymalne udziały w koszcie przedsięwzięcia)
            </div>
            <div className="space-y-2">
              {a.montaz.map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`block w-2.5 h-2.5 rounded-sm shrink-0 ${KOLOR_SKLADNIKA[m.klucz]}`} />
                  <span className="w-48 shrink-0 text-slate-700">
                    {m.nazwa} {m.tbc && <span className="badge bg-amber-100 text-amber-700 ml-1">tbc</span>}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                    <div className={`${KOLOR_SKLADNIKA[m.klucz]} h-3`} style={{ width: `${Math.min(100, m.udzialPct.max)}%` }} />
                  </div>
                  <span className="w-24 text-right font-medium text-slate-700">{zakres(m.udzialPct)}</span>
                </div>
              ))}
            </div>
            {a.montaz.some((m) => m.uwaga) && (
              <ul className="mt-2 space-y-0.5">
                {a.montaz.filter((m) => m.uwaga).map((m, i) => (
                  <li key={i} className="text-[11px] text-slate-500">
                    <span className="font-medium">{m.nazwa}:</span> {m.uwaga}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Kredyt */}
          {a.kredyt && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              <Pole e="Kredyt" v={a.kredyt.nazwa} />
              <Pole e="Oprocentowanie" v={`${zakres({ min: a.kredyt.oprocentowanie.min * 100, max: a.kredyt.oprocentowanie.max * 100 })} (${a.kredyt.typStopy})`} />
              <Pole e="Okres" v={`${a.kredyt.okresLat} lat`} />
              <Pole e="Obejmuje grunt" v={a.kredyt.pokrywaGrunt ? "tak" : "nie"} />
            </div>
          )}

          {/* Instrumenty */}
          {a.instrumenty.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-500 mb-1">Dostępne instrumenty</div>
              <div className="flex flex-wrap gap-2">
                {a.instrumenty.map((it, i) => (
                  <span key={i} className="badge bg-slate-100 text-slate-700">{it.nazwa}</span>
                ))}
              </div>
            </div>
          )}

          {/* Reguły */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
            <Pole e="Grunt" v={a.traktowanieGruntu} />
            <Pole e="Wykup lokali" v={a.wykupDozwolony ? "dozwolony" : "wykluczony"} />
            <Pole e="Weryfikacja dochodowa" v={a.weryfikacjaDochodowa} />
            <Pole e="Procedura" v={a.procedura} />
          </div>

          {/* Porównanie reżimów (okno przejściowe) */}
          {a.porownanieRezimow && <PorownanieRezimow p={a.porownanieRezimow} />}

          {/* Flagi tbc */}
          {a.flagiTbc.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-500 mb-1">Parametry do potwierdzenia (tbc — po publikacji rozporządzeń)</div>
              <div className="flex flex-wrap gap-2">
                {a.flagiTbc.map((f, i) => (
                  <span key={i} className="badge bg-amber-50 text-amber-700 border border-amber-200">{f}</span>
                ))}
              </div>
            </div>
          )}

          {a.ostrzezenia.length > 0 && <Flagi flagi={a.ostrzezenia} />}
        </>
      )}
    </Karta>
  );
}

function PorownanieRezimow({ p }: { p: NonNullable<AnalizaFinansowa["porownanieRezimow"]> }) {
  const o = p.obslugaDluguNa1MlnPln;
  const r = p.roznice;
  const fmt = (n: number) => n.toLocaleString("pl-PL");
  const wiersze: [string, string, string][] = [
    ["Obsługa długu / 1 mln PLN", `${fmt(o.obecny)} zł/rok`, `${fmt(o.nowy1pct)}–${fmt(o.nowy2pct)} zł/rok`],
    ["Okres kredytu", `${r.okresKredytuLata.obecny} lat`, `${r.okresKredytuLata.nowy} lat`],
    ["Typ stopy", r.typStopy.obecny === "variable" ? "zmienna" : r.typStopy.obecny, r.typStopy.nowy === "fixed" ? "stała" : r.typStopy.nowy],
    ["Max partycypacja", `${r.maxPartycypacjaPct.obecny}%`, `${r.maxPartycypacjaPct.nowy}%`],
    ["Wykup z grantem", r.wykupZGrantem.obecny ? "dozwolony" : "nie", r.wykupZGrantem.nowy ? "dozwolony" : "nie"],
    ["Ścieżka grantu (SIM)", r.sciezkaGrantu.obecny === "via_gmina" ? "przez gminę" : r.sciezkaGrantu.obecny, r.sciezkaGrantu.nowy === "direct" ? "bezpośrednio" : r.sciezkaGrantu.nowy],
    ["Liczba wniosków", String(r.liczbaWnioskow.obecny), String(r.liczbaWnioskow.nowy)],
  ];
  return (
    <div className="mb-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
      <div className="text-xs font-medium text-slate-600 mb-2">
        Porównanie reżimów (okno przejściowe 2027–2028) — oszczędność obsługi długu {Math.round(o.oszczednoscPct.min * 100)}–{Math.round(o.oszczednoscPct.max * 100)}%
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-1.5 pr-3">Parametr</th>
              <th className="py-1.5 px-3">Reżim obecny</th>
              <th className="py-1.5 px-3">Reżim nowy</th>
            </tr>
          </thead>
          <tbody>
            {wiersze.map(([k, a, b], i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-slate-600">{k}</td>
                <td className="py-1.5 px-3 text-slate-700">{a}</td>
                <td className="py-1.5 px-3 text-slate-700 font-medium">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.komentarz.map((c, i) => (
        <p key={i} className="text-[11px] text-slate-500 mt-1.5">• {c}</p>
      ))}
    </div>
  );
}

function Pole({ e, v }: { e: string; v: string }) {
  return (
    <div className="bg-slate-50 rounded px-2.5 py-1.5">
      <div className="text-slate-400">{e}</div>
      <div className="text-slate-700 font-medium">{v}</div>
    </div>
  );
}
