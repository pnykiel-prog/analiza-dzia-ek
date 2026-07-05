import type { BrakDanych, OcenaM2, PoleWskaznika, Profil, ProfilRekomendowany, Sygnal, WariantZabudowy, Werdykt, WerdyktProfiluM2, WynikPoziom2, ZrodloWskaznika } from "@/lib/types";
import { Karta, Statystyka } from "./ui";
import { WskaznikPewnosci } from "./grunt";
import { etykietaTypologii, liczba, statusSlowny } from "@/lib/format";

const ZRODLO_OBWIEDNI: Record<string, string> = {
  mpzp: "MPZP (twarde wskaźniki)",
  plan_ogolny: "Plan ogólny / OUZ",
  sasiedztwo_fallback: "Fallback z sąsiedztwa (brak MPZP)",
};

// Prowenancja wskaźnika (kaskada): etykieta + kolor znacznika źródła.
const ZRODLO_WSK: Record<ZrodloWskaznika, { txt: string; kl: string }> = {
  auto: { txt: "auto", kl: "bg-grunt-green-bg text-grunt-green" },
  deklarowane: { txt: "wypis", kl: "bg-grunt-amber-bg text-grunt-amber-text" },
  prognoza: { txt: "prognoza", kl: "bg-grunt-neutral-bg text-grunt-text-muted" },
};

const ETYK_PROFIL: Record<Profil, string> = {
  mlodzi: "Dla młodych — budownictwo społeczne",
  seniorzy: "Dla seniorów — wspomagane",
};

const KOLOR_WERD: Record<Werdykt, string> = {
  zielony: "text-grunt-green",
  zolty: "text-grunt-amber",
  czerwony: "text-grunt-red",
};

/** Werdykt M2 per profil (domknięcie kanałów A–F) + rekomendacja / „BRAK". */
function WerdyktM2Karta({ ocena }: { ocena: OcenaM2 }) {
  const brak = ocena.rekomendacja === "brak";
  return (
    <Karta
      tytul="Werdykt Poziomu 2 — przydatność pod budownictwo społeczne"
      podtytul="Popyt realizowalny = popyt z M1 × dostępność usług (A) × modyfikatory (C); przydatność ekonomiczna (B) skaluje; bramki (E) dopuszczają."
      prawy={
        brak ? (
          <span className="badge bg-grunt-red-bg text-grunt-red">BRAK — lokalizacja nieodpowiednia</span>
        ) : (
          <span className="badge bg-grunt-ink text-white">Rekomendacja: {ocena.rekomendacja === "seniorzy" ? "seniorzy" : "młodzi"}</span>
        )
      }
    >
      {brak && ocena.powodBrak && (
        <p className="text-[12px] text-grunt-red bg-grunt-red-bg/60 border border-grunt-red/25 rounded-md px-3 py-2 mb-3">{ocena.powodBrak}</p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {(["mlodzi", "seniorzy"] as Profil[]).map((p) => (
          <ProfilM2 key={p} w={ocena.werdykty[p]} rekomendowany={ocena.rekomendacja === p} />
        ))}
      </div>
    </Karta>
  );
}

function ProfilM2({ w, rekomendowany }: { w: WerdyktProfiluM2; rekomendowany: boolean }) {
  const wyklu = !w.obsluzalny || !w.dopuszczalny;
  return (
    <div className={`rounded-card border p-4 ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-grunt-text">{ETYK_PROFIL[w.profil]}</span>
        {rekomendowany && <span className="badge bg-grunt-ink text-white text-[10px]">★ REKOMENDOWANY</span>}
      </div>
      <div className="flex items-end justify-between mt-2">
        <span className={`text-[18px] font-semibold ${wyklu ? "text-grunt-red" : KOLOR_WERD[w.werdykt]}`}>
          {wyklu ? (!w.dopuszczalny ? "Niedopuszczalny" : "Nieobsługiwalny") : statusSlowny[w.werdykt]}
        </span>
        <span className="mono text-[26px] font-semibold leading-none text-grunt-text">
          {w.score}
          <span className="text-[13px] text-grunt-text-faint2">/100</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
        <MiniM2 e="Popyt realizowalny" v={`${w.popytRealizowalny}/100`} />
        <MiniM2 e="Przydatność ekon. (B)" v={`${w.przydatnoscEkonomiczna}/100`} />
        <MiniM2 e="Dostępność usług (A)" v={`× ${w.dostepnoscA.toFixed(2)}`} />
        <MiniM2 e="Modyfikator popytu (C)" v={`× ${w.modyfikatorC.toFixed(2)}`} />
      </div>
      {w.powody.length > 0 && (
        <ul className="mt-2 space-y-1">
          {w.powody.slice(0, 4).map((r, i) => (
            <li key={i} className="text-[11px] text-grunt-text-muted2">• {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniM2({ e, v }: { e: string; v: string }) {
  return (
    <div className="bg-grunt-surface-3 rounded px-2 py-1">
      <div className="text-grunt-text-muted2">{e}</div>
      <div className="mono font-medium text-grunt-text">{v}</div>
    </div>
  );
}

/** Grupuje warianty po profilu, zachowując globalny indeks (do oznaczenia rekomendowanego). */
function grupujProfile(warianty: WariantZabudowy[]): { profil: Profil; warianty: { w: WariantZabudowy; gi: number }[] }[] {
  const grupy: { profil: Profil; warianty: { w: WariantZabudowy; gi: number }[] }[] = [];
  warianty.forEach((w, gi) => {
    let g = grupy.find((x) => x.profil === w.profil);
    if (!g) {
      g = { profil: w.profil, warianty: [] };
      grupy.push(g);
    }
    g.warianty.push({ w, gi });
  });
  return grupy;
}

function ChipWskaznika({ e, p, suf = "" }: { e: string; p: PoleWskaznika; suf?: string }) {
  const z = ZRODLO_WSK[p.zrodlo];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-grunt-border px-2 py-1 text-[11px]">
      <span className="text-grunt-text-muted2">{e}:</span>
      <span className="mono font-medium text-grunt-text">{p.wartosc}{suf}</span>
      <span className={`badge ${z.kl} text-[10px]`}>{z.txt}</span>
    </span>
  );
}

// Kolory segmentów mix metraży (skala chart, monochromatyczna).
const KOLORY_MIX = ["bg-grunt-ink", "bg-grunt-chart-4", "bg-grunt-chart-5", "bg-grunt-chart-3"];

export function Poziom2View({
  p2,
  profilRek,
  sygnaly,
  braki,
}: {
  p2: WynikPoziom2;
  profilRek?: ProfilRekomendowany;
  sygnaly?: Sygnal[];
  braki?: BrakDanych[];
}) {
  const o = p2.obwiednia;
  // Rekomendowany wariant: pierwszy zgodny z rekomendowanym profilem (fallback: pierwszy).
  const idxRek = Math.max(
    0,
    p2.warianty.findIndex((w) => profilRek === "oba" || w.profil === profilRek)
  );

  return (
    <>
      <WerdyktM2Karta ocena={p2.ocenaM2} />

      {(sygnaly || braki) && (
        <div className={`grid gap-4 items-start ${braki ? "md:grid-cols-2" : ""}`}>
          {sygnaly && (
            <Karta tytul="Flagi i sygnały">
              {sygnaly.length === 0 ? (
                <p className="text-[12px] text-grunt-text-muted2">Brak istotnych flag — brak twardych ograniczeń ani wyróżniających atutów.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sygnaly.map((s, i) => {
                    const kl =
                      s.ton === "pozytyw"
                        ? "bg-grunt-green-bg text-grunt-green"
                        : s.ton === "ostrzezenie"
                          ? "bg-grunt-amber-bg text-grunt-amber-text"
                          : "bg-grunt-neutral-bg text-grunt-text-muted";
                    const kropka = s.ton === "pozytyw" ? "bg-grunt-green" : s.ton === "ostrzezenie" ? "bg-grunt-amber" : "bg-grunt-neutral";
                    return (
                      <span key={i} className={`badge ${kl}`}>
                        <span className={`w-2 h-2 rounded-full ${kropka}`} /> {s.tekst}
                      </span>
                    );
                  })}
                </div>
              )}
            </Karta>
          )}
          {braki && (
            <Karta tytul="Czego nie pobrano" prawy={<span className="badge bg-grunt-surface-3 text-grunt-text-muted mono">{braki.length}</span>}>
              {braki.length === 0 ? (
                <p className="text-[12px] text-grunt-text-muted2">Komplet danych wejściowych — brak białych plam dla tej działki.</p>
              ) : (
                <div className="space-y-2">
                  {braki.map((b, i) => (
                    <div key={i} className="rounded-md border border-dashed border-grunt-border-soft px-3 py-2">
                      <div className="text-[13px] font-semibold text-grunt-text">{b.tytul}</div>
                      <div className="text-[12px] text-grunt-text-muted2">{b.opis}</div>
                      <div className="mono text-[11px] text-grunt-amber-text2 mt-0.5">{b.wplyw}</div>
                    </div>
                  ))}
                </div>
              )}
            </Karta>
          )}
        </div>
      )}

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
        {o.prowenancja && (
          <div className="mt-2 flex flex-wrap gap-2">
            <ChipWskaznika e="% zabudowy" p={o.prowenancja.kZabPct} suf="%" />
            <ChipWskaznika e="Intensywność" p={o.prowenancja.far} />
            <ChipWskaznika e="Kondygnacje" p={o.prowenancja.kondygnacje} />
            <ChipWskaznika e="PBC" p={o.prowenancja.pbcPct} suf="%" />
          </div>
        )}
        {o.prowenancja && o.prowenancja.flagi.length > 0 && (
          <ul className="mt-2 space-y-1">
            {o.prowenancja.flagi.map((f, i) => (
              <li key={i} className="text-[11px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded px-2 py-1">⚑ {f}</li>
            ))}
          </ul>
        )}
      </Karta>

      <Karta
        tytul="Warianty zabudowy — dwa kierunki do porównania"
        podtytul="Senioralny i społeczny dla młodych × skala (optymalny / maksymalny / kameralny). Wybór przechodzi do modelu finansowego."
      >
        {grupujProfile(p2.warianty).map((g) => {
          const pumy = g.warianty.map((x) => x.w.pumM2);
          const gMin = Math.min(...pumy);
          const gMax = Math.max(...pumy);
          const kierunekRek = p2.warianty[idxRek]?.profil;
          return (
            <div key={g.profil} className="mb-6 last:mb-0">
              <div className="text-[12px] font-semibold text-grunt-text mb-2 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${g.profil === "seniorzy" ? "bg-grunt-senior" : "bg-grunt-young"}`} />
                {ETYK_PROFIL[g.profil]}
                {g.profil === kierunekRek && <span className="badge bg-grunt-ink text-white text-[10px]">rekomendowany kierunek</span>}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {g.warianty.map((x, li) => (
                  <KartaWariantu
                    key={x.gi}
                    w={x.w}
                    rekomendowany={x.gi === idxRek}
                    intensywnosc={x.w.pumM2 === gMin ? "niska" : x.w.pumM2 === gMax ? "maks" : "srednia"}
                    kolejność={li}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Karta>
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
