import type { ProfilRekomendowany, WariantZabudowy, WynikPoziom2 } from "@/lib/types";
import { Karta, Statystyka, Flagi } from "./ui";
import { WskaznikPewnosci } from "./grunt";
import { etykietaTypologii, liczba } from "@/lib/format";

const ZRODLO_OBWIEDNI: Record<string, string> = {
  mpzp: "MPZP (twarde wskaźniki)",
  plan_ogolny: "Plan ogólny / OUZ",
  sasiedztwo_fallback: "Fallback z sąsiedztwa (brak MPZP)",
};

// Kolory segmentów mix metraży (skala chart, monochromatyczna).
const KOLORY_MIX = ["bg-grunt-ink", "bg-grunt-chart-4", "bg-grunt-chart-5", "bg-grunt-chart-3"];

export function Poziom2View({ p2, profilRek }: { p2: WynikPoziom2; profilRek?: ProfilRekomendowany }) {
  const o = p2.obwiednia;
  // Rekomendowany wariant: pierwszy zgodny z rekomendowanym profilem (fallback: pierwszy).
  const idxRek = Math.max(
    0,
    p2.warianty.findIndex((w) => profilRek === "oba" || w.profil === profilRek)
  );
  // Progi intensywności wg PUM (najniższy/najwyższy).
  const pumy = p2.warianty.map((w) => w.pumM2);
  const minPum = Math.min(...pumy);
  const maxPum = Math.max(...pumy);

  return (
    <>
      <Karta
        tytul="Obwiednia zabudowy"
        podtytul="Twardy limit: ile wolno i co się zmieści (z parametrów planistycznych)"
        prawy={<WskaznikPewnosci pewnosc={o.pewnoscObwiedni} />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Statystyka etykieta="Max pow. zabudowy" wartosc={liczba(o.maxPowZabudowyM2, " m²")} />
          <Statystyka etykieta="Pow. całkowita nadziemna" wartosc={liczba(o.powCalkowitaNadziemnaM2, " m²")} />
          <Statystyka etykieta="PUM (szac.)" wartosc={liczba(o.pumM2, " m²")} akcent />
          <Statystyka etykieta="Max kondygnacje" wartosc={liczba(o.maxKondygnacje)} />
        </div>
        <div className="text-[11px] text-grunt-text-muted2 mt-3">
          Źródło wskaźników: <strong className="text-grunt-text">{ZRODLO_OBWIEDNI[o.zrodloWskaznikow]}</strong>
        </div>
      </Karta>

      <Karta tytul="Rekomendowane warianty zabudowy" podtytul="Typologia → program pod profil → wynik. Wybór przechodzi do modelu finansowego.">
        <div className="grid gap-4 lg:grid-cols-3">
          {p2.warianty.map((w, i) => (
            <KartaWariantu
              key={i}
              w={w}
              rekomendowany={i === idxRek}
              intensywnosc={w.pumM2 === minPum ? "niska" : w.pumM2 === maxPum ? "maks" : "srednia"}
              kolejność={i}
            />
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

function KartaWariantu({
  w,
  rekomendowany,
  intensywnosc,
  kolejność,
}: {
  w: WariantZabudowy;
  rekomendowany: boolean;
  intensywnosc: "niska" | "srednia" | "maks";
  kolejność: number;
}) {
  const litera = String.fromCharCode(65 + kolejność); // A / B / C
  const tag = rekomendowany
    ? { txt: "REKOMENDOWANY", klasa: "bg-grunt-ink text-white" }
    : intensywnosc === "niska"
      ? { txt: "NISKA INTENSYWNOŚĆ", klasa: "bg-grunt-surface-3 text-grunt-text-muted" }
      : intensywnosc === "maks"
        ? { txt: "MAKS. WYKORZYSTANIE", klasa: "bg-grunt-surface-3 text-grunt-text-muted" }
        : { txt: "ZRÓWNOWAŻONY", klasa: "bg-grunt-surface-3 text-grunt-text-muted" };
  const dotProfil = w.profil === "mlodzi" ? "bg-grunt-young" : "bg-grunt-senior";
  return (
    <div className={`rounded-card border p-4 ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[15px] font-semibold text-grunt-text">Wariant {litera}</span>
          <span className="text-[12px] text-grunt-text-muted2"> · {etykietaTypologii[w.typologia]}</span>
        </div>
        <span className={`grid place-items-center w-5 h-5 rounded-full text-[11px] ${rekomendowany ? "bg-grunt-ink text-white" : "border border-grunt-border text-grunt-text-ghost"}`}>✓</span>
      </div>
      <span className={`badge mt-2 ${tag.klasa}`}>{tag.txt}</span>

      {/* Statystyki */}
      <div className="grid grid-cols-3 gap-2 my-4 text-center">
        <StatWariant v={liczba(w.liczbaKondygnacji)} e="kondygnacji" />
        <StatWariant v={liczba(w.liczbaMieszkan)} e="mieszkań" />
        <StatWariant v={liczba(w.pumM2)} e="m² PUM" />
      </div>

      {/* Mix metraży — pasek stosowy */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">Mix metraży</div>
        <div className="flex h-3 rounded-sm overflow-hidden" style={{ gap: "2px" }}>
          {w.mixMetrazy.map((m, j) => (
            <div key={j} className={`${KOLORY_MIX[j % KOLORY_MIX.length]} h-full`} style={{ width: `${m.udzialPct}%` }} title={`${m.etykieta}: ${m.udzialPct}%`} />
          ))}
        </div>
      </div>

      {/* Wiersze */}
      <div className="space-y-1.5 text-[12px] border-t border-grunt-divider-row pt-2">
        <WierszW e="Parking" v={w.parkingPodziemny ? "Podziemny" : "Naziemny"} />
        <WierszW e="Miejsca postojowe" v={liczba(w.miejscaParkingowe)} mono />
        <WierszW e="Pow. wspólne / usługowe" v={liczba(w.powWspolneUslugoweM2, " m²")} mono />
        <WierszW e="Winda" v={w.windaWymagana ? "wymagana" : "wg wysokości"} />
      </div>

      {/* Dopasowanie do profilu (docelowy profil wariantu) */}
      <div className="mt-3 flex items-center gap-2 text-[12px]">
        <span className="text-grunt-text-muted2">Profil docelowy:</span>
        <span className="flex items-center gap-1.5 font-medium text-grunt-text">
          <span className={`w-2.5 h-2.5 rounded-full ${dotProfil}`} />
          {w.profil === "mlodzi" ? "Młodzi" : "Seniorzy"}
        </span>
      </div>

      <p className="text-[11px] text-grunt-text-muted mt-3 leading-relaxed bg-grunt-surface-3 rounded-md px-2.5 py-1.5">{w.uzasadnienie}</p>
    </div>
  );
}

function StatWariant({ v, e }: { v: string; e: string }) {
  return (
    <div>
      <div className="mono text-[24px] font-semibold leading-none text-grunt-text">{v}</div>
      <div className="text-[10px] text-grunt-text-muted2 mt-1">{e}</div>
    </div>
  );
}

function WierszW({ e, v, mono }: { e: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-grunt-text-muted2">{e}</span>
      <span className={`text-grunt-text font-medium text-right ${mono ? "mono" : ""}`}>{v}</span>
    </div>
  );
}
