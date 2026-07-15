"use client";

import { useMemo } from "react";
import type { WariantZabudowy, WartoscOdtworzeniowaMeta } from "@/lib/types";
import type { ProfilFinansowy } from "@/lib/finanse/typy";
import { KONFIG_FINANSE } from "@/lib/config";
import { przekrojMontazu, rolaZeSposobu, udzialPct, uzbrojenieProxy, type KolumnaMontazu, type WejscieMontazu } from "@/lib/finanse/montaz";
import { Karta } from "./ui";
import { ETYK_GRUNTU } from "@/lib/finanse/etykiety";

/** Kwota PLN kompaktowo: „12,3 mln zł" / „850 tys. zł". */
function pln(k: number): string {
  if (Math.abs(k) >= 1_000_000) return `${(k / 1_000_000).toFixed(1).replace(".", ",")} mln zł`;
  if (Math.abs(k) >= 10_000) return `${Math.round(k / 1000)} tys. zł`;
  return `${Math.round(k)} zł`;
}

/**
 * Wynik M3 — przekrój montażu, OBA reżimy obok siebie. Jeden silnik (`przekrojMontazu`)
 * czyta grant/kredyt/partycypację WG ZASOBU. Wkład własny domyka. Suwak kosztu
 * budowy przelicza cały montaż w obu reżimach na żywo. Kalkulacja, nie werdykt.
 */
export function MontazPrzekrojView({
  wariant,
  wartoscOdtworzeniowaM2,
  onWO,
  woMeta,
  odlegloscDoSieciM,
  profil,
  kosztBudowyM2,
  onKoszt,
  oprocPct,
  onOproc,
}: {
  wariant: WariantZabudowy;
  wartoscOdtworzeniowaM2: number; // kontrolowane przez stronę (współdzielone z raportem)
  onWO: (v: number) => void;
  woMeta?: WartoscOdtworzeniowaMeta | null;
  odlegloscDoSieciM: number | null;
  profil: ProfilFinansowy;
  kosztBudowyM2: number; // suwak — kontrolowany przez stronę
  onKoszt: (v: number) => void;
  oprocPct: number | null; // override oprocentowania [%], null = wg reżimu
  onOproc: (v: number | null) => void;
}) {
  const suwak = KONFIG_FINANSE.kosztBudowySuwak;
  const wo = wartoscOdtworzeniowaM2;
  const oprocOverride = oprocPct != null && oprocPct > 0 ? oprocPct / 100 : undefined;

  const rola = rolaZeSposobu(profil.sposobWniesieniaDzialki);
  const powierzchniaBudowy = wariant.pumM2 + wariant.powWspolneUslugoweM2;
  const przekroj = useMemo(() => {
    const wej: WejscieMontazu = {
      kosztBudowyM2,
      powierzchniaBudowyM2: powierzchniaBudowy,
      pumMieszkalnaM2: wariant.pumM2,
      wartoscOdtworzeniowaM2: wo,
      wartoscDzialkiPln: profil.wartoscDzialkiPln ?? 0,
      rolaDzialki: rola,
      uzbrojeniePln: uzbrojenieProxy(odlegloscDoSieciM),
      oprocOverride,
    };
    return przekrojMontazu(profil, wej);
  }, [wariant, wo, oprocOverride, odlegloscDoSieciM, profil, kosztBudowyM2, rola, powierzchniaBudowy]);

  const okres = woMeta?.okresOd && woMeta?.okresDo ? `${woMeta.okresOd} – ${woMeta.okresDo}` : null;
  const przeterm = !!woMeta?.okresDo && woMeta.okresDo < "2026-07-07";

  return (
    <div className="space-y-4">
      {/* Jawne założenia — WO (z okresu obwieszczenia) + oprocentowanie, edytowalne */}
      <Karta tytul="Założenia montażu (edytowalne)" podtytul="Dwie liczby najmocniej ruszają wynik — wartość odtworzeniowa i oprocentowanie">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            <span className="text-[11px] font-medium text-grunt-text-muted2">Wartość odtworzeniowa [zł/m²]</span>
            <input type="number" value={wartoscOdtworzeniowaM2 || ""} onChange={(e) => onWO(Number(e.target.value) || 0)} className="inp mono mt-1" />
            <span className="text-[10px] text-grunt-text-faint2 block mt-1">
              {woMeta?.benchmark
                ? `benchmark (brak obwieszczenia dla tej lokalizacji) — ${woMeta.jednostka}`
                : `${woMeta?.jednostka ?? ""}${okres ? ` · okres ${okres}` : ""}${woMeta?.obwieszczenie ? ` · ${woMeta.obwieszczenie}` : ""}`}
              {przeterm && <span className="text-grunt-amber-text"> · ⚑ stawka przeterminowana — sprawdź obwieszczenie</span>}
            </span>
          </label>
          <label className="text-sm block">
            <span className="text-[11px] font-medium text-grunt-text-muted2">Oprocentowanie kredytu [%] — oba reżimy</span>
            <input type="number" step="0.25" value={oprocPct ?? ""} onChange={(e) => onOproc(e.target.value === "" ? null : Number(e.target.value))} placeholder="wg reżimu (np. 3)" className="inp mono mt-1" />
            <span className="text-[10px] text-grunt-text-faint2 block mt-1">Puste → obecny środek zakresu SBC 2–4%; przyszły wg programu (do potwierdzenia).</span>
          </label>
        </div>
      </Karta>
      {/* Suwak kosztu budowy */}
      <Karta tytul="Koszt budowy — dźwignia montażu" podtytul={`zł/m² × powierzchnia (${Math.round(powierzchniaBudowy)} m²) · przelicza oba reżimy na żywo`}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={suwak.min}
            max={suwak.max}
            step={suwak.krok}
            value={kosztBudowyM2}
            onChange={(e) => onKoszt(Number(e.target.value))}
            className="flex-1 accent-grunt-ink"
          />
          <div className="shrink-0 text-right">
            <div className="mono text-[22px] font-semibold leading-none text-grunt-text">{kosztBudowyM2.toLocaleString("pl-PL")}</div>
            <div className="text-[11px] text-grunt-text-faint2">zł/m² pod klucz</div>
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-grunt-text-faint2 mt-1">
          <span>{suwak.min.toLocaleString("pl-PL")}</span>
          <span>{suwak.max.toLocaleString("pl-PL")}</span>
        </div>
        <p className="text-[11px] text-grunt-text-muted2 mt-2">
          Droższa budowa → większy wkład własny (czynsz i kredyt mają sufit). Reżim przyszły (dłuższy, tańszy kredyt) łagodzi wrażliwość.
        </p>
      </Karta>

      {/* Dwie kolumny reżimów */}
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <KolumnaRezimu k={przekroj.obecny} etykietaWniesienia={ETYK_GRUNTU[profil.sposobWniesieniaDzialki]} />
        <KolumnaRezimu k={przekroj.przyszly} etykietaWniesienia={ETYK_GRUNTU[profil.sposobWniesieniaDzialki]} />
      </div>

      <p className="text-[11px] text-grunt-text-faint2">
        Kalkulacja, nie werdykt — porównanie reżimów jest samo w sobie informacją decyzyjną. Wartość działki jako {rola === "koszt" ? "koszt (zakup)" : rola === "zrodlo" ? "źródło (aport — obniża wkład własny)" : "pozycja neutralna (działka już posiadana)"}.
      </p>
    </div>
  );
}

const TYT_REZIMU: Record<"obecny" | "przyszly", string> = {
  obecny: "Reżim obecny",
  przyszly: "Reżim przyszły (2027+)",
};

function KolumnaRezimu({ k, etykietaWniesienia }: { k: KolumnaMontazu; etykietaWniesienia: string }) {
  if (!k.dostepny) {
    return (
      <div className="rounded-card border border-grunt-border overflow-hidden">
        <div className="px-4 py-2.5 bg-grunt-surface-3 border-b border-grunt-border">
          <span className="text-[13px] font-semibold text-grunt-text">{TYT_REZIMU[k.rezim]}</span>
        </div>
        <div className="p-4 text-[12px] text-grunt-text-muted">{k.flagi[0] ?? "Kombinacja niedostępna w tym reżimie."}</div>
      </div>
    );
  }
  const razem = k.koszt.razem;
  return (
    <div className="rounded-card border border-grunt-border overflow-hidden">
      <div className="px-4 py-2.5 bg-grunt-surface-3 border-b border-grunt-border flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-grunt-text">{TYT_REZIMU[k.rezim]}</span>
        {k.rezimFin === "future" && (
          <span className="badge bg-grunt-amber-bg text-grunt-amber-text text-[10px]">parametry do potwierdzenia</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {/* KOSZT */}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">Koszt inwestycji</div>
          <Pozycja label="Koszt budowy" kwota={k.koszt.budowa} razem={razem} />
          {k.koszt.grunt > 0 && <Pozycja label="Cena gruntu (zakup)" kwota={k.koszt.grunt} razem={razem} />}
          <Pozycja label="Uzbrojenie" kwota={k.koszt.uzbrojenie} razem={razem} />
          <Pozycja label="Projekt i przygotowanie" kwota={k.koszt.projekt} razem={razem} />
          <Pozycja label="Koszty finansowe" kwota={k.koszt.kosztyFinansowe} razem={razem} />
          <Pozycja label="Rezerwa na ryzyko" kwota={k.koszt.rezerwa} razem={razem} />
          <div className="flex items-baseline justify-between border-t border-grunt-divider mt-1.5 pt-1.5">
            <span className="text-[12px] font-semibold text-grunt-text">Razem koszt</span>
            <span className="mono text-[14px] font-semibold text-grunt-text">{pln(razem)}</span>
          </div>
        </div>

        {/* ŹRÓDŁA */}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mb-1">Źródła finansowania</div>
          <Pozycja label={`Grant / dotacja (${k.zalozenia.grantPct}%)`} kwota={k.zrodla.grant} razem={razem} />
          {k.zalozenia.grantSufitPct != null && (
            <div className="text-[10.5px] text-grunt-amber-text2 -mt-0.5 mb-1 pl-0.5">
              ↑ do {k.zalozenia.grantSufitPct}% po zadeklarowaniu efektywności energetycznej / OZE (FEnIKS) w ankiecie
            </div>
          )}
          <Pozycja label="Kredyt (ze zdolności czynszowej)" kwota={k.zrodla.kredyt} razem={razem} />
          {k.zrodla.aport > 0 && <Pozycja label={`Aport działki (${etykietaWniesienia})`} kwota={k.zrodla.aport} razem={razem} />}
          {k.zrodla.partycypacjaNajemcow > 0 && <Pozycja label="Partycypacja najemców" kwota={k.zrodla.partycypacjaNajemcow} razem={razem} />}
        </div>

        {/* WKŁAD WŁASNY — pozycja domykająca (wyróżniona) */}
        <div className="rounded-md bg-grunt-ink/5 border border-grunt-ink/20 px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold text-grunt-text">{k.etykietaWkladu}</span>
            <span className="mono text-[22px] font-semibold leading-none text-grunt-text">{pln(k.zrodla.wkladWlasny)}</span>
          </div>
          <div className="text-[11px] text-grunt-text-muted2 mt-0.5 text-right">{udzialPct(k.zrodla.wkladWlasny, razem)}% kosztu</div>
        </div>

        {k.flagi.length > 0 && (
          <ul className="space-y-1">
            {k.flagi.map((f, i) => (
              <li key={i} className="text-[11px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded px-2 py-1">⚑ {f}</li>
            ))}
          </ul>
        )}

        {/* Założenia dyskretnie */}
        <details className="text-[11px] text-grunt-text-muted2">
          <summary className="cursor-pointer text-grunt-text-faint2">Założenia montażu</summary>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <span>Kredyt: {k.zalozenia.oprocentowaniePct}% · {k.zalozenia.okresLat} lat</span>
            <span>Grant: {k.zalozenia.grantPct}% (wg zasobu)</span>
            <span>Czynsz SIM: {k.zalozenia.stopaCzynszuPct}% wart. odtw.</span>
            <span>≈ {k.czynszM2} zł/m²/mc</span>
          </div>
        </details>
      </div>
    </div>
  );
}

function Pozycja({ label, kwota, razem }: { label: string; kwota: number; razem: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[12px] text-grunt-text-muted">{label}</span>
      <span className="shrink-0 text-right">
        <span className="mono text-[12.5px] font-medium text-grunt-text">{pln(kwota)}</span>
        <span className="text-[10px] text-grunt-text-faint2 ml-1.5">{udzialPct(kwota, razem)}%</span>
      </span>
    </div>
  );
}
