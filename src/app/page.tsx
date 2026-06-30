import Link from "next/link";
import { listaDzialek } from "@/lib/data/sample";
import { uruchomPoziom1 } from "@/lib/engine";
import { pobierzDaneDzialki } from "@/lib/data/service";
import { WerdyktBadge } from "@/components/ui";
import { etykietaProfilu } from "@/lib/format";

export default async function Home() {
  const dzialki = listaDzialek();
  // Szybki przesiew (P1) dla każdej działki, by pokazać werdykt na liście.
  const zWerdyktem = await Promise.all(
    dzialki.map(async (d) => {
      const dane = await pobierzDaneDzialki(d.id);
      const p1 = dane ? uruchomPoziom1(dane) : null;
      return { ...d, p1 };
    })
  );

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h1 className="text-2xl font-bold text-slate-800">Ocena potencjału działki pod budownictwo społeczne</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Analiza w trzech poziomach: <strong>Poziom 1</strong> — szybki przesiew (bramki + scoring 5 wymiarów dla dwóch
          profili), <strong>Poziom 2</strong> — ocena działki i rekomendacja modelu zabudowy, <strong>Poziom 3</strong> —
          model finansowy SIM (montaż, oś czasu, reżim „as-of", wymagana dotacja). Wybierz działkę, aby uruchomić pełny
          pipeline.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-xs">
          <span className="badge bg-slate-100 text-slate-600">🟢 dane automatyczne</span>
          <span className="badge bg-slate-100 text-slate-600">🟡 pół-automatyczne</span>
          <span className="badge bg-slate-100 text-slate-600">🔴 ręczne / zewnętrzne</span>
          <span className="badge bg-slate-100 text-slate-600">„brak danych ≠ nie"</span>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-700 mb-3">Działki do analizy</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {zWerdyktem.map((d) => (
            <Link
              key={d.id}
              href={`/analiza/${encodeURIComponent(d.id)}`}
              className="card p-4 hover:shadow-md hover:border-slate-300 transition block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{d.gmina}</div>
                  <div className="text-xs text-slate-500">{d.wojewodztwo}</div>
                </div>
                {d.p1 && <WerdyktBadge w={d.p1.werdykt} etykieta={d.p1.werdykt} />}
              </div>
              <div className="text-xs text-slate-400 mt-2 font-mono">{d.id}</div>
              <p className="text-sm text-slate-600 mt-2">{d.opis}</p>
              {d.p1 && (
                <div className="flex gap-3 mt-3 text-xs text-slate-500">
                  <span>młodzi: <strong className="text-slate-700">{d.p1.scoreMlodzi}</strong></span>
                  <span>seniorzy: <strong className="text-slate-700">{d.p1.scoreSeniorzy}</strong></span>
                  <span>→ {etykietaProfilu[d.p1.profilRekomendowany]}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
