import type { DynamikaGminy, PunktSzeregu } from "@/lib/types";
import { Karta } from "./ui";
import { liczba } from "@/lib/format";

/**
 * Panel dynamiki gminy — 5 wykresów liniowych ~10 lat (czysty KONTEKST, NIE zmienia
 * popytu ani werdyktu; klient czyta trend sam). Ludność = kotwica; brak danego szeregu
 * → jego wykres znika (panel się nie wywraca). Braki w środku szeregu = luka, NIE zero.
 */
interface DefWykresu {
  klucz: keyof DynamikaGminy;
  tytul: string;
  jednostka: string;
  fmt: (v: number) => string;
}

const WYKRESY: DefWykresu[] = [
  { klucz: "ludnosc", tytul: "Liczba ludności", jednostka: "os.", fmt: (v) => liczba(Math.round(v)) },
  { klucz: "mieszkaniaOddane", tytul: "Nasycenie mieszkaniami", jednostka: "na 1000 os.", fmt: (v) => liczba(Math.round(v)) },
  { klucz: "podmioty", tytul: "Podmioty REGON", jednostka: "na 10 tys.", fmt: (v) => liczba(Math.round(v)) },
  { klucz: "dochodyWlasne", tytul: "Dochody własne / mieszk.", jednostka: "zł", fmt: (v) => liczba(Math.round(v)) },
  { klucz: "bezrobotni", tytul: "Stopa bezrobocia", jednostka: "%", fmt: (v) => `${(Math.round(v * 10) / 10).toLocaleString("pl-PL")}` },
];

export function PanelDynamiki({ dynamika }: { dynamika?: DynamikaGminy | null }) {
  if (!dynamika) return null;
  const dostepne = WYKRESY.map((w) => ({ def: w, szereg: dynamika[w.klucz] })).filter(
    (x): x is { def: DefWykresu; szereg: PunktSzeregu[] } => Array.isArray(x.szereg) && x.szereg.some((p) => p.wartosc != null)
  );
  if (dostepne.length === 0) return null;

  return (
    <Karta
      tytul="Dynamika gminy"
      podtytul="Pewne dane GUS w czasie (~10 lat) jako kontekst — NIE zmieniają popytu ani werdyktu. Trend czytasz sam."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dostepne.map(({ def, szereg }) => (
          <MiniWykres key={def.klucz} def={def} szereg={szereg} />
        ))}
      </div>
    </Karta>
  );
}

function MiniWykres({ def, szereg }: { def: DefWykresu; szereg: PunktSzeregu[] }) {
  const znane = szereg.filter((p) => p.wartosc != null) as { rok: number; wartosc: number }[];
  const pierwszy = znane[0];
  const ostatni = znane[znane.length - 1];
  const wartosci = znane.map((p) => p.wartosc);
  const minV = Math.min(...wartosci);
  const maxV = Math.max(...wartosci);
  const minR = szereg[0].rok;
  const maxR = szereg[szereg.length - 1].rok;
  const rozpR = Math.max(1, maxR - minR);
  const rozpV = maxV - minV || 1;

  // Geometria SVG (viewBox 220×64, padding).
  const W = 220, H = 64, PL = 6, PR = 6, PT = 8, PB = 8;
  const x = (rok: number) => PL + ((rok - minR) / rozpR) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - minV) / rozpV) * (H - PT - PB);

  // Segmenty linii (przerwane na lukach — null NIE łączy się w prostą przez zero).
  const segmenty: { rok: number; wartosc: number }[][] = [];
  let biezacy: { rok: number; wartosc: number }[] = [];
  for (const p of szereg) {
    if (p.wartosc == null) {
      if (biezacy.length) segmenty.push(biezacy);
      biezacy = [];
    } else {
      biezacy.push({ rok: p.rok, wartosc: p.wartosc });
    }
  }
  if (biezacy.length) segmenty.push(biezacy);

  const delta = pierwszy && ostatni ? ostatni.wartosc - pierwszy.wartosc : 0;
  const strzalka = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const zmianaPct = pierwszy && pierwszy.wartosc !== 0 ? Math.round((delta / pierwszy.wartosc) * 100) : null;

  return (
    <div className="rounded-panel border border-grunt-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-grunt-text">{def.tytul}</span>
        <span className="mono text-[11px] text-grunt-text-faint2">{def.jednostka}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="mono text-[16px] font-semibold text-grunt-text">{ostatni ? def.fmt(ostatni.wartosc) : "—"}</span>
        <span className="mono text-[11px] text-grunt-text-muted2">
          {strzalka}
          {zmianaPct != null ? ` ${zmianaPct > 0 ? "+" : ""}${zmianaPct}% / ${rozpR} lat` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-1.5" aria-hidden preserveAspectRatio="none">
        {segmenty.map((seg, i) => (
          <polyline
            key={i}
            fill="none"
            stroke="var(--grunt-ink)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={seg.map((p) => `${x(p.rok).toFixed(1)},${y(p.wartosc).toFixed(1)}`).join(" ")}
          />
        ))}
        {ostatni && <circle cx={x(ostatni.rok)} cy={y(ostatni.wartosc)} r="2.4" fill="var(--grunt-ink)" />}
      </svg>
      <div className="flex justify-between mono text-[10px] text-grunt-text-faint2 mt-0.5">
        <span>{minR}</span>
        <span>{maxR}</span>
      </div>
    </div>
  );
}
