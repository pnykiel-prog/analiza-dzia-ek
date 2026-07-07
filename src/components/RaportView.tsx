"use client";

import type { WynikAnalizy } from "@/lib/types";
import { WskaznikPewnosci, StosMontazu, type SegmentStosu } from "./grunt";
import { etykietaTypologii, liczba, plnMln, statusSlowny } from "@/lib/format";
import { KONFIG_FINANSE } from "@/lib/config";
import { zlozKolumne, rolaZeSposobu, uzbrojenieProxy, type KolumnaMontazu } from "@/lib/finanse/montaz";

/** Drukowalne „Studium potencjału inwestycyjnego działki" (arkusz A4). */
export function RaportView({ wynik, data }: { wynik: WynikAnalizy; data?: string }) {
  const { dane, poziom1: p1, poziom2: p2, poziom3: p3 } = wynik;

  // Montaż finansowy = TEN SAM silnik co przekrój M3 (grant wg zasobu, wkład domykający).
  const profilFin = p3.analizaFinansowa?.profil ?? null;
  const rezimFin = p3.analizaFinansowa?.rezim ?? "current";
  const idxWar = Math.max(0, p2.warianty.findIndex((w) => p1.profilRekomendowany === "oba" || w.profil === p1.profilRekomendowany));
  const wariantFin = p2.warianty[idxWar];
  const kolMontaz: KolumnaMontazu | null =
    profilFin && wariantFin
      ? zlozKolumne(profilFin, rezimFin, {
          kosztBudowyM2: dane.kosztBudowyM2 ?? KONFIG_FINANSE.kosztBudowySuwak.domyslny,
          powierzchniaBudowyM2: wariantFin.pumM2 + wariantFin.powWspolneUslugoweM2,
          pumMieszkalnaM2: wariantFin.pumM2,
          wartoscOdtworzeniowaM2: dane.wartoscOdtworzeniowaM2 ?? 7000,
          wartoscDzialkiPln: profilFin.wartoscDzialkiPln ?? dane.cenaGruntu ?? 0,
          rolaDzialki: rolaZeSposobu(profilFin.sposobWniesieniaDzialki),
          uzbrojeniePln: uzbrojenieProxy(dane.odlegloscDoSieciM),
        })
      : null;

  return (
    <div className="raport-arkusz bg-grunt-surface rounded-panel shadow-sheet mx-auto max-w-[880px] p-5 sm:p-8 md:p-10">
      {/* Nagłówek */}
      <div className="flex items-start justify-between border-b-2 border-grunt-ink pb-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="grid place-items-center w-7 h-7 rounded-sm bg-grunt-ink">
              <span className="block w-2 h-2 rounded-[2px] bg-grunt-mint" />
            </span>
            <span className="text-[14px] font-bold text-grunt-ink" style={{ letterSpacing: "0.14em" }}>GRUNT</span>
          </div>
          <h1 className="text-[24px] font-semibold text-grunt-text leading-tight tracking-[-0.01em]">
            Studium potencjału<br />inwestycyjnego działki
          </h1>
        </div>
        <div className="text-right text-[12px] text-grunt-text-muted space-y-0.5">
          {data && <div>Data: <span className="mono text-grunt-text">{data}</span></div>}
          <div>{dane.gmina ? `Gmina ${dane.gmina}` : "—"}</div>
          <div className="mono text-grunt-text">{dane.id}</div>
          {dane.powierzchniaM2 > 0 && <div className="mono">{liczba(dane.powierzchniaM2, " m²")}</div>}
        </div>
      </div>

      {/* 01 Werdykt przesiewu */}
      <SekcjaRap numer="01" tytul="Werdykt przesiewu">
        <div className="grid grid-cols-2 gap-4">
          <WerdyktMini nazwa="Młodzi" profil="mlodzi" score={p1.scoreMlodzi} werdykt={p1.werdyktMlodzi} pewnosc={p1.pewnosc} rek={p1.profilRekomendowany === "mlodzi" || p1.profilRekomendowany === "oba"} />
          <WerdyktMini nazwa="Seniorzy" profil="seniorzy" score={p1.scoreSeniorzy} werdykt={p1.werdyktSeniorzy} pewnosc={p1.pewnosc} rek={p1.profilRekomendowany === "seniorzy" || p1.profilRekomendowany === "oba"} />
        </div>
      </SekcjaRap>

      {/* 02 Popyt i dopasowanie (Poziom 1) — bez orientacyjnej prognozy pojemności
          (PUM/mieszkań); pojemność wyznacza Poziom 2. */}
      <SekcjaRap numer="02" tytul="Popyt i dopasowanie (Poziom 1)">
        <div className="text-[12px]">
          <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">Dopasowanie popyt ↔ pojemność</div>
          <div className="text-grunt-text-muted2">Młodzi: <span className="mono text-grunt-text">{p1.dopasowanie.mlodzi.score}/100</span> · popyt {p1.dopasowanie.mlodzi.popyt}</div>
          <div className="text-grunt-text-muted2">Seniorzy: <span className="mono text-grunt-text">{p1.dopasowanie.seniorzy.score}/100</span> · popyt {p1.dopasowanie.seniorzy.popyt}</div>
          <p className="mt-2 text-[10px] text-grunt-text-faint">Model pojemności (PUM, kondygnacje, liczba mieszkań) — Poziom 2.</p>
        </div>
      </SekcjaRap>

      {/* 03 Rekomendowany model zabudowy */}
      {(() => {
        const idx = Math.max(0, p2.warianty.findIndex((w) => p1.profilRekomendowany === "oba" || w.profil === p1.profilRekomendowany));
        const w = p2.warianty[idx];
        if (!w) return null;
        return (
          <SekcjaRap numer="03" tytul="Rekomendowany model zabudowy">
            <div className="border border-grunt-border rounded-panel p-4">
              <div className="text-[14px] font-semibold text-grunt-text mb-3">
                {w.nazwa} <span className="text-grunt-text-muted2 font-normal">· {etykietaTypologii[w.typologia]}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <StatRap v={liczba(w.liczbaKondygnacji)} e="kondygnacji" />
                <StatRap v={liczba(w.liczbaMieszkan)} e="mieszkań" />
                <StatRap v={liczba(w.pumM2)} e="m² PUM" />
                <StatRap v={w.parkingPodziemny ? "Podziemny" : "Naziemny"} e="parking" maly />
              </div>
            </div>
          </SekcjaRap>
        );
      })()}

      {/* 04 Model finansowy — kalkulacja (nie werdykt); wkład własny domyka */}
      <SekcjaRap numer="04" tytul={`Model finansowy — ${kolMontaz ? kolMontaz.nazwa : etykietaRezimSkrot(p3.rezimDomyslny)}`}>
        {kolMontaz ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-panel p-4 bg-grunt-surface-3">
              <div className="flex justify-between text-[13px] py-1">
                <span className="text-grunt-text-muted2">Koszt inwestycji (razem)</span>
                <span className="mono font-semibold text-grunt-text">{plnMln(kolMontaz.koszt.razem)}</span>
              </div>
              <div className="flex justify-between text-[13px] py-1 border-t border-black/5">
                <span className="text-grunt-text-muted2">Grant / dotacja</span>
                <span className="mono font-semibold text-grunt-text">{plnMln(kolMontaz.zrodla.grant)} · {kolMontaz.zalozenia.grantPct}%</span>
              </div>
              <div className="flex justify-between text-[13px] py-1 border-t border-black/5">
                <span className="text-grunt-text-muted2">Kredyt (zdolność czynszowa)</span>
                <span className="mono font-semibold text-grunt-text">{plnMln(kolMontaz.zrodla.kredyt)}</span>
              </div>
              <div className="flex justify-between text-[13px] py-1 border-t border-black/5">
                <span className="text-grunt-text-muted2">{kolMontaz.etykietaWkladu.replace(" (domyka)", "")}</span>
                <span className="mono font-semibold text-grunt-text">{plnMln(kolMontaz.zrodla.wkladWlasny)} · {Math.round((kolMontaz.zrodla.wkladWlasny / (kolMontaz.koszt.razem || 1)) * 100)}%</span>
              </div>
            </div>
            <div className="border border-grunt-border rounded-panel p-4">
              <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-2">Montaż finansowy (kalkulacja)</div>
              <StosMontazu segmenty={montazZKolumny(kolMontaz)} />
              {kolMontaz.brakParametrow && (
                <p className="text-[11px] text-grunt-amber-text mt-2">⚑ Brak parametrów montażu dla tej kombinacji — wynik do uzupełnienia.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-grunt-text-muted">Model finansowy dostępny po wypełnieniu ankiety finansowej (Poziom 3).</p>
        )}
      </SekcjaRap>

      {/* Prowenancja + zastrzeżenie */}
      <div className="mt-6">
        <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-2">Prowenancja danych</div>
        <div className="flex flex-wrap gap-2">
          {["ULDK — geometria", "GUS BDL — demografia", "GDOŚ — środowisko", "OSM — usługi", "Rejestr cen — rynek", "Ręczne — własność, geotechnika"].map((p) => (
            <span key={p} className="badge bg-grunt-surface-3 text-grunt-text-muted mono text-[10px]">{p}</span>
          ))}
        </div>
      </div>
      {p1.pewnosc < 100 && (
        <p className="mt-4 text-[12px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded-md px-3 py-2">
          ⚠ Wynik częściowy: część danych to białe plamy — pewność ogólna obniżona. Wartości oznaczone jako „do
          potwierdzenia" wymagają weryfikacji przed decyzją inwestycyjną.
        </p>
      )}
    </div>
  );
}

// ── Pomocnicze ───────────────────────────────────────────────────────────────

function montazZKolumny(k: KolumnaMontazu): SegmentStosu[] {
  const koszt = k.koszt.razem || 1;
  const def = [
    { nazwa: "Dotacja / grant", v: k.zrodla.grant, kolor: "bg-grunt-chart-1" },
    { nazwa: "Kredyt", v: k.zrodla.kredyt, kolor: "bg-grunt-ink" },
    { nazwa: "Aport działki", v: k.zrodla.aport, kolor: "bg-grunt-chart-5" },
    { nazwa: "Partycypacja najemców", v: k.zrodla.partycypacjaNajemcow, kolor: "bg-grunt-chart-4" },
    { nazwa: k.etykietaWkladu.replace(" (domyka)", ""), v: k.zrodla.wkladWlasny, kolor: "bg-grunt-chart-6" },
  ];
  return def.filter((c) => c.v > 0).map((c) => ({ nazwa: c.nazwa, kolor: c.kolor, udzialPct: Math.round((c.v / koszt) * 100) }));
}

function etykietaRezimSkrot(r: string): string {
  if (r === "A_SBC_2026") return "A · SBC 2026";
  if (r === "B_program_2027") return "B · Program 2027+";
  return "C · Upside unijny";
}

function SekcjaRap({ numer, tytul, children }: { numer: string; tytul: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3 border-b border-grunt-divider pb-1.5">
        <span className="mono text-[11px] text-grunt-text-faint2">{numer}</span>
        <h2 className="text-[15px] font-semibold text-grunt-text">{tytul}</h2>
      </div>
      {children}
    </section>
  );
}

function WerdyktMini({
  nazwa, profil, score, werdykt, pewnosc, rek,
}: {
  nazwa: string; profil: "mlodzi" | "seniorzy"; score: number; werdykt: import("@/lib/types").Werdykt; pewnosc: number; rek: boolean;
}) {
  const dot = profil === "mlodzi" ? "bg-grunt-young" : "bg-grunt-senior";
  const txt = profil === "mlodzi" ? "text-grunt-young" : "text-grunt-senior";
  const stKolor = werdykt === "zielony" ? "text-grunt-green" : werdykt === "zolty" ? "text-grunt-amber" : "text-grunt-red";
  return (
    <div className={`rounded-panel border p-3 ${rek ? "border-grunt-ink" : "border-grunt-border"}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium">
          <span className={`w-2 h-2 rounded-full ${dot}`} /> <span className={txt}>Profil: {nazwa}</span>
        </span>
        {rek && <span className="text-[10px] text-grunt-text-muted2">★ rekomendowany</span>}
      </div>
      <div className="flex items-end justify-between mt-2">
        <span className={`text-[15px] font-semibold ${stKolor}`}>{statusSlowny[werdykt]}</span>
        <span className="mono text-[26px] font-semibold leading-none text-grunt-text">{score}<span className="text-[12px] text-grunt-text-faint2">/100</span></span>
      </div>
      <div className="mt-2"><WskaznikPewnosci pewnosc={pewnosc} rozmiar="sm" /></div>
    </div>
  );
}

function StatRap({ v, e, maly }: { v: string; e: string; maly?: boolean }) {
  return (
    <div>
      <div className={`mono font-semibold leading-none text-grunt-text ${maly ? "text-[15px]" : "text-[24px]"}`}>{v}</div>
      <div className="text-[10px] text-grunt-text-muted2 mt-1">{e}</div>
    </div>
  );
}
