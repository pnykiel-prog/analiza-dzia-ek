/**
 * Kaskada priorytetów źródeł wskaźników urbanistycznych (wg
 * `kaskada_zrodel_wskaznikow.md`). Rozstrzyga PER POLE, które źródło wchodzi do
 * modelu pojemności: %zabudowy (k_zab), intensywność (FAR), maks. kondygnacje
 * (limit wysokości), PBC.
 *
 * Priorytet (per pole, niezależnie — wynik może być mieszany):
 *   P1 AUTO        — KIMPZP/plan (legalne wskaźniki) + BDOT (fizyczne wysokości).
 *   P2 DEKLAROWANE — pakiet ręczny POTWIERDZONY jako realne dane z MPZP/dokumentu.
 *   P3 PROGNOZA    — nasz szacunek z kształtu + estymowane kondygnacje sąsiedztwa.
 *
 * Wyjątek §5 (legalne vs fizyczne): dla LIMITU „ile wolno" (kondygnacje/wysokość)
 * źródło LEGALNE (plan/potwierdzony wypis) bije FIZYCZNE (BDOT/sąsiedztwo) — nawet
 * gdy fizyczne jest „auto" — bo fizyczna wysokość sąsiedztwa to nie pułap prawny.
 *
 * Pewność wyniku = najsłabsze użyte źródło. Determinizm: jedno przejście per pole.
 */

import type { DaneDzialki, PoleWskaznika, RozstrzygnieteWskazniki, ZrodloWskaznika } from "../types";
import type { KonfiguracjaZabudowy } from "../config";
import { KONFIG_ZABUDOWA } from "../config";

const PEWNOSC: Record<ZrodloWskaznika, number> = { auto: 85, deklarowane: 65, prognoza: 45 };
const pole = (wartosc: number, zrodlo: ZrodloWskaznika): PoleWskaznika => ({ wartosc, zrodlo, pewnosc: PEWNOSC[zrodlo] });

/** Liczba z tekstu KIMPZP („12", „12 m", „1,4", pusty) — pierwsza liczba, przecinek→kropka. */
function liczbaZTekstu(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : null;
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

export function kaskadaWskaznikow(d: DaneDzialki, cfg: KonfiguracjaZabudowy = KONFIG_ZABUDOWA): RozstrzygnieteWskazniki {
  const flagi: string[] = [];
  const f = cfg.fallbackSasiedztwo;
  const hKond = cfg.wysokoscKondygnacjiM;

  // ── Źródła surowe ──────────────────────────────────────────────────────────
  // AUTO legalne: KIMPZP mpzpMeta (wysokość, intensywność) + wskaznikiPlanistyczne (plan wektorowy/próbki).
  const planWysM = liczbaZTekstu(d.mpzpMeta?.maxWysokoscM);
  const autoKond = planWysM != null ? Math.max(1, Math.round(planWysM / hKond)) : d.wskaznikiPlanistyczne?.maxKondygnacje ?? null;
  const autoFar = liczbaZTekstu(d.mpzpMeta?.intensywnoscZabudowy) ?? d.wskaznikiPlanistyczne?.intensywnosc ?? null;
  const autoKZab = d.wskaznikiPlanistyczne?.maxPowZabudowyPct ?? null;
  const autoPbc = d.wskaznikiPlanistyczne?.minPbcPct ?? null;

  // DEKLAROWANE: ręczne, tylko gdy potwierdzone jako realne z MPZP/dokumentu.
  const man = d.wskaznikiPotwierdzone ? d.wskaznikiReczne ?? null : null;
  const manKond = man?.maxWysokoscM != null && man.maxWysokoscM > 0 ? Math.max(1, Math.round(man.maxWysokoscM / hKond)) : null;
  const manFar = man?.intensywnosc != null && man.intensywnosc > 0 ? man.intensywnosc : null;
  const manKZab = man?.maxPowZabudowyPct != null && man.maxPowZabudowyPct > 0 ? man.maxPowZabudowyPct : null;
  const manPbc = man?.minPbcPct != null && man.minPbcPct > 0 ? man.minPbcPct : null;

  // FIZYCZNE: wysokość zabudowy w okolicy (piętra) — odniesienie sąsiedztwa (nie pułap prawny).
  const fizKond = d.wysokoscOkolicyPieter != null && d.wysokoscOkolicyPieter > 0 ? Math.floor(d.wysokoscOkolicyPieter) : null;

  // ── Rozstrzyganie per pole ──────────────────────────────────────────────────
  const kZabPct =
    autoKZab != null ? pole(autoKZab, "auto") : manKZab != null ? pole(manKZab, "deklarowane") : pole(f.maxPowZabudowyPct, "prognoza");

  // Kondygnacje = LIMIT: legalne (auto plan → deklarowane wypis) > fizyczne (sąsiedztwo) > prognoza.
  const kondygnacje =
    autoKond != null
      ? pole(autoKond, "auto")
      : manKond != null
        ? pole(manKond, "deklarowane")
        : fizKond != null
          ? pole(fizKond, "prognoza")
          : pole(f.maxKondygnacje, "prognoza");

  const pbcPct = autoPbc != null ? pole(autoPbc, "auto") : manPbc != null ? pole(manPbc, "deklarowane") : pole(f.minPbcPct, "prognoza");

  // FAR: auto > deklarowane > prognoza (spójna = kondygnacje × %zabudowy/100).
  const far =
    autoFar != null
      ? pole(autoFar, "auto")
      : manFar != null
        ? pole(manFar, "deklarowane")
        : pole(Math.round((kondygnacje.wartosc * kZabPct.wartosc) / 100 * 100) / 100, "prognoza");

  // ── Walidacja warstwy ręcznej + rozbieżności ────────────────────────────────
  if (manKZab != null && manKZab > 60) flagi.push(`Wpisany % zabudowy ${manKZab}% > 60% — sprawdź wypis z MPZP.`);
  if (manFar != null && manFar > 2.0) flagi.push(`Wpisana intensywność ${manFar} > 2,0 — sprawdź wypis z MPZP.`);
  if (autoKZab != null && manKZab != null && Math.abs(autoKZab - manKZab) > 1)
    flagi.push(`Wpisano ${manKZab}% zabudowy, plan ${autoKZab}% — używamy planu.`);
  if (autoFar != null && manFar != null && Math.abs(autoFar - manFar) > 0.05)
    flagi.push(`Wpisano intensywność ${manFar}, plan ${autoFar} — używamy planu.`);
  // Rozbieżność wpisanej intensywności z otoczeniem (sąsiedztwo × % zabudowy).
  if (manFar != null && autoFar == null && fizKond != null) {
    const refFar = (fizKond * kZabPct.wartosc) / 100;
    if (manFar - refFar > 0.5) flagi.push(`Wpisana intensywność ${manFar} odbiega od otoczenia (~${refFar.toFixed(1)}) — sprawdź wypis z MPZP.`);
  }
  if ((kondygnacje.zrodlo === "auto" || kondygnacje.zrodlo === "deklarowane") && fizKond != null && kondygnacje.wartosc > fizKond + 1)
    flagi.push(`Limit z planu ${kondygnacje.wartosc} kond. > zabudowa sąsiedztwa (${fizKond}) — plan wiąże, nie zaniżamy pojemności.`);

  const pewnosc = Math.min(kZabPct.pewnosc, far.pewnosc, kondygnacje.pewnosc, pbcPct.pewnosc);
  return { kZabPct, far, kondygnacje, pbcPct, pewnosc, flagi };
}
