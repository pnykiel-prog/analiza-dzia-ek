import Link from "next/link";
import { notFound } from "next/navigation";
import { pobierzDaneDzialki, raportPokrycia } from "@/lib/data/service";
import { uruchomAnalize } from "@/lib/engine";
import { Sekcja } from "@/components/ui";
import { Poziom1View } from "@/components/Poziom1View";
import { Poziom2View } from "@/components/Poziom2View";
import { Poziom3View } from "@/components/Poziom3View";
import { liczba } from "@/lib/format";

export default async function AnalizaPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const dane = await pobierzDaneDzialki(id);
  if (!dane) notFound();

  const { poziom1, poziom2, poziom3 } = uruchomAnalize(dane);
  const pokrycie = raportPokrycia(dane);

  return (
    <div className="space-y-2">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← Wszystkie działki
      </Link>

      {/* Nagłówek działki */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {dane.gmina} <span className="text-slate-400 font-normal">· {dane.powiat}, {dane.wojewodztwo}</span>
            </h1>
            <div className="text-xs text-slate-400 font-mono mt-1">{dane.id}</div>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="text-right">
              <div className="text-xs text-slate-500">Powierzchnia</div>
              <div className="font-semibold text-slate-700">{liczba(dane.powierzchniaM2, " m²")}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Pokrycie danych</div>
              <div className="font-semibold text-slate-700">{pokrycie.pokryciePct}%</div>
            </div>
          </div>
        </div>
        {pokrycie.bialePlamy.length > 0 && (
          <p className="text-xs text-slate-500 mt-3">
            Białe plamy ({pokrycie.polaPuste}): <span className="text-slate-400">{pokrycie.bialePlamy.join(", ")}</span> —
            traktowane neutralnie, obniżają wskaźnik pewności, nie werdykt.
          </p>
        )}
      </div>

      {/* Nawigacja kotwicowa */}
      <div className="flex gap-2 text-sm sticky top-0 bg-[#f8fafc] py-2 z-10">
        <a href="#poziom-1" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">1 · Przesiew</a>
        <a href="#poziom-2" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">2 · Zabudowa</a>
        <a href="#poziom-3" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">3 · Finanse</a>
      </div>

      <Sekcja numer="1" tytul="Poziom 1 — szybki przesiew" opis="Bramki + scoring 5 wymiarów dla dwóch profili (dane automatyczne)">
        <Poziom1View p1={poziom1} />
      </Sekcja>

      <Sekcja numer="2" tytul="Poziom 2 — ocena działki i model zabudowy" opis="Obwiednia → typologia → program pod profil (bez finansów)">
        <Poziom2View p2={poziom2} />
      </Sekcja>

      <Sekcja numer="3" tytul="Poziom 3 — model finansowy SIM" opis="Montaż, oś czasu, reżim as-of, domknięcie i wymagana dotacja">
        <Poziom3View p3={poziom3} />
      </Sekcja>
    </div>
  );
}
