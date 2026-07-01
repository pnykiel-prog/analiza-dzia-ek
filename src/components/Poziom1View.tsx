import type { DopasowanieProfil, Profil, Werdykt, WynikPopytu, WynikPoziom1 } from "@/lib/types";
import { Karta, Statystyka } from "./ui";
import { WskaznikPewnosci } from "./grunt";
import { etykietaProfilu, liczba, statusSlowny } from "@/lib/format";

const ETYK_PODSTAWA: Record<string, string> = {
  MPZP: "MPZP (plan miejscowy)",
  WZ: "Decyzja o warunkach zabudowy (WZ)",
  PnB: "Pozwolenie na budowę (PnB)",
  BRAK: "Brak podstawy planistycznej",
};

/**
 * Widok Poziomu 1 (rewizja): dopasowanie pojemności zabudowy do popytu.
 * `pelny` (administrator) dokłada dekompozycję popytu; klient widzi sam wynik.
 */
export function Poziom1View({ p1, pelny = true }: { p1: WynikPoziom1; pelny?: boolean }) {
  const poj = p1.pojemnosc;
  // Sygnał braku danych demograficznych: „Grupa docelowa" na fallbacku dla obu profili
  // (tzn. GUS nie dostarczył udziałów wiekowych) — wtedy werdykt jest orientacyjny.
  const grupaFallback = (p: WynikPopytu) => p.skladniki.find((s) => s.nazwa === "Grupa docelowa")?.fallback ?? false;
  const brakDanychPopytu = grupaFallback(p1.popyt.mlodzi) && grupaFallback(p1.popyt.seniorzy);
  return (
    <>
      {brakDanychPopytu && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-amber/25 bg-grunt-amber-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-amber text-white text-[13px] font-bold">!</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-amber-text">Brak danych demograficznych/rynkowych dla tej działki</div>
            <div className="text-[12px] text-grunt-text-muted">
              Źródło automatyczne (GUS BDL / rynek) nie zwróciło danych dla tej gminy, więc popyt liczony jest z wartości domyślnych —
              werdykt jest orientacyjny i będzie zbliżony niezależnie od działki. Sprawdź „Raport źródeł danych” (widok administratora),
              aby zobaczyć status źródeł.
            </div>
          </div>
        </div>
      )}
      {p1.funkcjaMieszkaniowaDozwolona === false && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-red/25 bg-grunt-red-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-red text-white text-[13px] font-bold">✕</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-red">Funkcja mieszkaniowa niedozwolona</div>
            <div className="text-[12px] text-grunt-text-muted">Podstawa planistyczna nie dopuszcza zabudowy mieszkaniowej — działka nieprzydatna pod budownictwo społeczne.</div>
          </div>
        </div>
      )}
      {p1.tryb === "ograniczony" && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-amber/25 bg-grunt-amber-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-amber text-white text-[13px] font-bold">!</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-amber-text">Tryb ograniczony — brak podstawy planistycznej</div>
            <div className="text-[12px] text-grunt-text-muted">Pojemność zabudowy nieoznaczona; werdykt liczony z samego popytu. Uzupełnij MPZP/WZ/PnB, aby ocenić pojemność.</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <KartaWerdyktu nazwa="Młodzi" profil="mlodzi" rekomendowany={p1.profilRekomendowany === "mlodzi" || p1.profilRekomendowany === "oba"} dop={p1.dopasowanie.mlodzi} pewnosc={p1.pewnosc} />
        <KartaWerdyktu nazwa="Seniorzy" profil="seniorzy" rekomendowany={p1.profilRekomendowany === "seniorzy" || p1.profilRekomendowany === "oba"} dop={p1.dopasowanie.seniorzy} pewnosc={p1.pewnosc} />
      </div>
      <div className="text-[13px] text-grunt-text-muted">
        Profil rekomendowany: <strong className="text-grunt-text">{etykietaProfilu[p1.profilRekomendowany]}</strong>
      </div>

      {/* Pojemność zabudowy (z podstawy planistycznej) */}
      <Karta
        tytul="Pojemność zabudowy"
        podtytul="Z powierzchni działki (ULDK) i ręcznych wskaźników podstawy planistycznej"
        prawy={<span className="badge bg-grunt-surface-3 text-grunt-text-muted">{ETYK_PODSTAWA[p1.podstawa.typ]}{p1.podstawa.symbol ? ` · ${p1.podstawa.symbol}` : ""}</span>}
      >
        {poj.pumM2 === null ? (
          <p className="text-[12px] text-grunt-text-muted2">Pojemność nieoznaczona — brak wskaźników podstawy planistycznej (tryb ograniczony).</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Statystyka etykieta="Powierzchnia działki" wartosc={liczba(p1.powierzchniaM2, " m²")} />
            <Statystyka etykieta="Max pow. zabudowy" wartosc={liczba(poj.maxPowZabudowyM2, " m²")} />
            <Statystyka etykieta="Pow. całkowita" wartosc={liczba(poj.powCalkowitaM2, " m²")} />
            <Statystyka etykieta="PUM (szac.)" wartosc={liczba(poj.pumM2, " m²")} akcent />
            <Statystyka etykieta="Szac. mieszkań (M / S)" wartosc={`${liczba(poj.szacLiczbaMieszkanMlodzi)} / ${liczba(poj.szacLiczbaMieszkanSeniorzy)}`} />
          </div>
        )}
      </Karta>

      {/* Popyt — demografia + rynek (bez usług; usługi = Poziom 2) */}
      <Karta tytul="Popyt — demografia + rynek" podtytul="Popyt realizowalny = (wewnętrzny + zewnętrzny) × mnożnik luki cenowej (bez usług na P1)">
        <div className="grid md:grid-cols-2 gap-4">
          <PopytKolumna p={p1.popyt.mlodzi} nazwa="Młodzi" pelny={pelny} />
          <PopytKolumna p={p1.popyt.seniorzy} nazwa="Seniorzy" pelny={pelny} />
        </div>
      </Karta>
    </>
  );
}

const KOLOR_STATUSU: Record<Werdykt, string> = {
  zielony: "text-grunt-green",
  zolty: "text-grunt-amber",
  czerwony: "text-grunt-red",
};

function KartaWerdyktu({
  nazwa,
  profil,
  rekomendowany,
  dop,
  pewnosc,
}: {
  nazwa: string;
  profil: Profil;
  rekomendowany: boolean;
  dop: DopasowanieProfil;
  pewnosc: number;
}) {
  const tint = profil === "mlodzi" ? "bg-grunt-young-bg" : "bg-grunt-senior-bg";
  const dot = profil === "mlodzi" ? "bg-grunt-young" : "bg-grunt-senior";
  const txt = profil === "mlodzi" ? "text-grunt-young" : "text-grunt-senior";
  const stKolor = KOLOR_STATUSU[dop.werdykt];
  const kropka = dop.werdykt === "zielony" ? "bg-grunt-green" : dop.werdykt === "zolty" ? "bg-grunt-amber" : "bg-grunt-red";
  return (
    <div className={`relative rounded-card border overflow-hidden ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${tint}`}>
        <span className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className={`text-[13px] font-semibold ${txt}`}>Profil: {nazwa}</span>
        </span>
        {rekomendowany && <span className="badge bg-grunt-ink text-white text-[10px]">★ REKOMENDOWANY PROFIL</span>}
      </div>
      <div className="p-4">
        <div className="flex items-end justify-between">
          <span className={`flex items-center gap-2 text-[22px] font-semibold ${stKolor}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${kropka}`} />
            {statusSlowny[dop.werdykt]}
          </span>
          <span className="mono text-[38px] font-semibold leading-none text-grunt-text">
            {dop.score}
            <span className="text-[15px] text-grunt-text-faint2">/100</span>
          </span>
        </div>
        <div className="mt-3">
          <WskaznikPewnosci pewnosc={pewnosc} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <MiniStat e="Popyt (realizowalny)" v={`${dop.popyt}/100`} />
          <MiniStat e="Pojemność" v={dop.pojemnoscMieszkan === null ? "nieoznaczona" : `${dop.pojemnoscMieszkan} mieszk.`} />
        </div>
        <p className="text-[12px] text-grunt-text-muted mt-3">{dop.komentarz}</p>
      </div>
    </div>
  );
}

function PopytKolumna({ p, nazwa, pelny }: { p: WynikPopytu; nazwa: string; pelny: boolean }) {
  const teal = p.profil === "mlodzi";
  const akcent = teal ? "text-grunt-young" : "text-grunt-senior";
  const dot = teal ? "bg-grunt-young" : "bg-grunt-senior";
  return (
    <div className="rounded-panel border border-grunt-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} /> <span className={akcent}>{nazwa}</span>
        </span>
        <span className="mono text-[20px] font-semibold text-grunt-text">
          {p.realizowalny}<span className="text-[12px] text-grunt-text-faint2">/100</span>
        </span>
      </div>
      <PopytPasek etykieta="Popyt wewnętrzny" wartosc={p.wewnetrzny} kolor="bg-grunt-chart-3" />
      <PopytPasek etykieta="Popyt zewnętrzny" wartosc={p.zewnetrzny} kolor="bg-grunt-chart-4" />
      {pelny && (
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <MiniStat e="Kwalifikacja doch." v={p.udzialKwalifikujacyPct === null ? "szac." : `${p.udzialKwalifikujacyPct}%`} />
          <MiniStat e="Mnożnik luki" v={`×${p.mnoznikLuka.toFixed(2)}`} />
        </div>
      )}
      <p className="text-[11px] text-grunt-text-muted mt-3 bg-grunt-surface-3 rounded-md px-2.5 py-1.5">{p.interpretacja}</p>
      {p.flagi.length > 0 && (
        <ul className="mt-2 space-y-1">
          {p.flagi.map((f, i) => (
            <li key={i} className="text-[11px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded px-2 py-1">⚑ {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PopytPasek({ etykieta, wartosc, kolor }: { etykieta: string; wartosc: number; kolor: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="w-32 shrink-0 text-[11px] text-grunt-text-muted2">{etykieta}</span>
      <div className="flex-1 h-2.5 bg-grunt-surface-3 rounded-full overflow-hidden">
        <div className={`h-full ${kolor} rounded-full`} style={{ width: `${Math.min(100, wartosc)}%` }} />
      </div>
      <span className="mono w-8 text-right text-[11px] font-medium text-grunt-text">{wartosc}</span>
    </div>
  );
}

function MiniStat({ e, v }: { e: string; v: string }) {
  return (
    <div className="bg-grunt-surface-3 rounded px-2 py-1">
      <div className="text-grunt-text-muted2">{e}</div>
      <div className="mono font-medium text-grunt-text">{v}</div>
    </div>
  );
}
