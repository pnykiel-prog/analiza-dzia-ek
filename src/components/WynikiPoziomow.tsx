import type { WynikPoziom1, WynikPoziom2, WynikPoziom3 } from "@/lib/types";
import { Sekcja } from "./ui";
import { Poziom1View } from "./Poziom1View";
import { Poziom2View } from "./Poziom2View";
import { Poziom3View } from "./Poziom3View";

/** Wspólny widok wyników trzech poziomów (używany na stronie działki i w panelu „Nowa analiza”). */
export function WynikiPoziomow({ p1, p2, p3 }: { p1: WynikPoziom1; p2: WynikPoziom2; p3: WynikPoziom3 }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-sm sticky top-0 bg-[#f8fafc] py-2 z-10">
        <a href="#poziom-1" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">1 · Przesiew</a>
        <a href="#poziom-2" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">2 · Zabudowa</a>
        <a href="#poziom-3" className="badge bg-slate-200 text-slate-700 hover:bg-slate-300">3 · Finanse</a>
      </div>

      <Sekcja numer="1" tytul="Poziom 1 — szybki przesiew" opis="Podstawa planistyczna → pojemność zabudowy ↔ popyt dla dwóch profili">
        <Poziom1View p1={p1} />
      </Sekcja>
      <Sekcja numer="2" tytul="Poziom 2 — ocena działki i model zabudowy" opis="Obwiednia → typologia → program pod profil (bez finansów)">
        <Poziom2View p2={p2} profilRek={p1.profilRekomendowany} braki={p2.braki} />
      </Sekcja>
      <Sekcja numer="3" tytul="Poziom 3 — model finansowy SIM" opis="Montaż, oś czasu, reżim as-of, domknięcie i wymagana dotacja">
        <Poziom3View p3={p3} />
      </Sekcja>
    </div>
  );
}
