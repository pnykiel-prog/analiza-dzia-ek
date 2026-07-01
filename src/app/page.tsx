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
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-grunt-young">Analiza potencjału inwestycyjnego</div>
        <h1 className="text-[25px] font-semibold text-grunt-text tracking-[-0.01em] mt-1">
          Ocena potencjału działki pod budownictwo społeczne
        </h1>
        <p className="text-grunt-text-muted mt-2 max-w-3xl text-[13px]">
          Analiza w trzech poziomach: <strong>Poziom 1</strong> — szybki przesiew (bramki + scoring 5 wymiarów dla dwóch
          profili), <strong>Poziom 2</strong> — ocena działki i rekomendacja modelu zabudowy, <strong>Poziom 3</strong> —
          model finansowy SIM (montaż, oś czasu, reżim „as-of”, wymagana dotacja). Wybierz działkę, aby uruchomić pełny
          pipeline.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
          <Legenda kolor="bg-grunt-green" txt="dane automatyczne" />
          <Legenda kolor="bg-grunt-amber" txt="pół-automatyczne" />
          <Legenda kolor="bg-grunt-red" txt="ręczne / zewnętrzne" />
          <span className="badge bg-grunt-surface-3 text-grunt-text-muted">„brak danych ≠ nie”</span>
        </div>
        <div className="mt-5">
          <Link href="/nowa" className="btn-primary inline-flex" style={{ height: "var(--grunt-h-cta)" }}>
            ＋ Analizuj nową działkę
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-grunt-text mb-3">Działki do analizy</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {zWerdyktem.map((d) => (
            <Link
              key={d.id}
              href={`/analiza/${encodeURIComponent(d.id)}`}
              className="card p-4 hover:shadow-raised hover:border-grunt-border-input transition block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-grunt-text">{d.gmina}</div>
                  <div className="text-[11px] text-grunt-text-muted2">{d.wojewodztwo}</div>
                </div>
                {d.p1 && <WerdyktBadge w={d.p1.werdykt} etykieta={d.p1.werdykt} />}
              </div>
              <div className="text-[10.5px] text-grunt-text-faint2 mt-2 mono">{d.id}</div>
              <p className="text-[13px] text-grunt-text-muted mt-2">{d.opis}</p>
              {d.p1 && (
                <div className="flex gap-3 mt-3 text-[11px] text-grunt-text-muted2">
                  <span>młodzi: <strong className="mono text-grunt-text">{d.p1.scoreMlodzi}</strong></span>
                  <span>seniorzy: <strong className="mono text-grunt-text">{d.p1.scoreSeniorzy}</strong></span>
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

function Legenda({ kolor, txt }: { kolor: string; txt: string }) {
  return (
    <span className="badge bg-grunt-surface-3 text-grunt-text-muted">
      <span className={`w-2 h-2 rounded-full ${kolor}`} /> {txt}
    </span>
  );
}
