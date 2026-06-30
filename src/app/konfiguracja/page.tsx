"use client";

import { useEffect, useState } from "react";
import type { Konfiguracja } from "@/lib/config";
import type { OpisZrodla } from "@/lib/data/adapters";
import type { WynikAnalizy } from "@/lib/types";
import { Karta } from "@/components/ui";
import { etykietaRezimu, etykietaScenariusza, liczba, pct, plnMln } from "@/lib/format";

const POZYSKANIE_BADGE: Record<string, string> = {
  auto: "🟢 auto",
  pol_auto: "🟡 pół-auto",
  reczne: "🔴 ręczne",
};

export default function KonfiguracjaPage() {
  const [konfig, setKonfig] = useState<Konfiguracja | null>(null);
  const [zrodla, setZrodla] = useState<OpisZrodla[]>([]);
  const [dzialki, setDzialki] = useState<{ id: string; gmina: string }[]>([]);
  const [wybranaDzialka, setWybranaDzialka] = useState<string>("");
  const [wynik, setWynik] = useState<WynikAnalizy | null>(null);
  const [licze, setLicze] = useState(false);

  useEffect(() => {
    fetch("/api/konfiguracja")
      .then((r) => r.json())
      .then((d) => {
        setKonfig(d.konfiguracja);
        setZrodla(d.zrodla);
      });
    fetch("/api/dzialki")
      .then((r) => r.json())
      .then((d) => {
        setDzialki(d.dzialki);
        if (d.dzialki[0]) setWybranaDzialka(d.dzialki[0].id);
      });
  }, []);

  async function przelicz() {
    if (!wybranaDzialka || !konfig) return;
    setLicze(true);
    const r = await fetch(`/api/analiza/${encodeURIComponent(wybranaDzialka)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ konfiguracja: konfig }),
    });
    setWynik(await r.json());
    setLicze(false);
  }

  if (!konfig) return <p className="text-slate-500">Wczytywanie konfiguracji…</p>;

  const fin = konfig.finanse;
  const rezimB = fin.rezimy.B_program_2027;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h1 className="text-xl font-bold text-slate-800">Warstwa konfiguracji</h1>
        <p className="text-slate-600 mt-1 text-sm max-w-3xl">
          Parametry edytowalne poza kodem (zasada przekrojowa #6). Zmień wartości i przelicz wybraną działkę, aby
          zobaczyć wpływ na werdykt i wymaganą dotację. Reset = odświeżenie strony.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Wagi wymiarów P1 */}
        <Karta tytul="Poziom 1 — wagi wymiarów per profil" podtytul="Suma per profil powinna wynosić 100">
          <div className="space-y-3">
            {(["mlodzi", "seniorzy"] as const).map((profil) => (
              <div key={profil}>
                <div className="text-sm font-medium text-slate-600 mb-1">{profil === "mlodzi" ? "Dla młodych" : "Senioralny"}</div>
                <div className="grid grid-cols-5 gap-2">
                  {(["W1", "W2", "W3", "W4", "W5"] as const).map((w) => (
                    <label key={w} className="text-xs">
                      <span className="text-slate-400">{w}</span>
                      <input
                        type="number"
                        className="w-full border border-slate-200 rounded px-2 py-1 mt-0.5"
                        value={konfig.scoring.wagiWymiarow[profil][w]}
                        onChange={(e) =>
                          setKonfig((k) => {
                            if (!k) return k;
                            const kopia = structuredClone(k);
                            kopia.scoring.wagiWymiarow[profil][w] = Number(e.target.value);
                            return kopia;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Suwak
              etykieta="Próg werdyktu „zielony”"
              wartosc={konfig.scoring.pasma.zielony}
              min={50}
              max={90}
              onChange={(v) => setKonfig((k) => mut(k, (kk) => (kk.scoring.pasma.zielony = v)))}
            />
          </div>
        </Karta>

        {/* Parametry finansowe P3 — reżim B */}
        <Karta tytul="Poziom 3 — reżim B (program 2027+)" podtytul="Zmieniają się co rok / co nowelizację">
          <div className="space-y-3">
            <Suwak
              etykieta={`Oprocentowanie kredytu: ${pct(rezimB.oprocentowanie * 100, 2)}`}
              wartosc={rezimB.oprocentowanie * 100}
              min={0}
              max={8}
              krok={0.25}
              onChange={(v) => setKonfig((k) => mut(k, (kk) => (kk.finanse.rezimy.B_program_2027.oprocentowanie = v / 100)))}
            />
            <Suwak
              etykieta={`Okres kredytu: ${rezimB.okresKredytuLata} lat`}
              wartosc={rezimB.okresKredytuLata}
              min={20}
              max={50}
              krok={5}
              onChange={(v) => setKonfig((k) => mut(k, (kk) => (kk.finanse.rezimy.B_program_2027.okresKredytuLata = v)))}
            />
            <Suwak
              etykieta={`Grant: ${rezimB.maxGrantPct}%`}
              wartosc={rezimB.maxGrantPct}
              min={0}
              max={50}
              onChange={(v) => setKonfig((k) => mut(k, (kk) => (kk.finanse.rezimy.B_program_2027.maxGrantPct = v)))}
            />
            <Suwak
              etykieta={`Indeks wartości odtworzeniowej: ${pct(fin.indeksy.wartoscOdtworzeniowaRocznie * 100, 1)}/rok`}
              wartosc={fin.indeksy.wartoscOdtworzeniowaRocznie * 100}
              min={0}
              max={10}
              krok={0.5}
              onChange={(v) => setKonfig((k) => mut(k, (kk) => (kk.finanse.indeksy.wartoscOdtworzeniowaRocznie = v / 100)))}
            />
          </div>
        </Karta>
      </div>

      {/* Przeliczanie */}
      <Karta tytul="Przelicz działkę z bieżącą konfiguracją">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="border border-slate-200 rounded px-3 py-2 text-sm"
            value={wybranaDzialka}
            onChange={(e) => setWybranaDzialka(e.target.value)}
          >
            {dzialki.map((d) => (
              <option key={d.id} value={d.id}>
                {d.gmina} — {d.id}
              </option>
            ))}
          </select>
          <button
            onClick={przelicz}
            disabled={licze}
            className="bg-slate-900 text-white text-sm px-4 py-2 rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {licze ? "Liczę…" : "Przelicz"}
          </button>
        </div>

        {wynik && wynik.poziom1 && (
          <div className="grid md:grid-cols-4 gap-3 mt-4">
            <Wynik etykieta="Score młodzi" wartosc={`${wynik.poziom1.scoreMlodzi}/100`} />
            <Wynik etykieta="Score seniorzy" wartosc={`${wynik.poziom1.scoreSeniorzy}/100`} />
            <Wynik etykieta="Pewność" wartosc={pct(wynik.poziom1.pewnosc)} />
            <Wynik
              etykieta="Wym. dotacja (oczekiwany)"
              wartosc={pct(wynik.poziom3.scenariusze.find((s) => s.scenariusz === "oczekiwany")?.wymaganaDotacjaPct, 1)}
            />
          </div>
        )}
        {wynik && wynik.poziom3 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1 pr-2">Scenariusz</th>
                  <th className="py-1 px-2">Reżim</th>
                  <th className="py-1 px-2 text-right">Koszt</th>
                  <th className="py-1 px-2 text-right">DSCR</th>
                  <th className="py-1 px-2 text-right">Dotacja</th>
                  <th className="py-1 pl-2">Domyka</th>
                </tr>
              </thead>
              <tbody>
                {wynik.poziom3.scenariusze.map((s) => (
                  <tr key={s.scenariusz} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{etykietaScenariusza[s.scenariusz]}</td>
                    <td className="py-1 px-2 text-slate-500">{etykietaRezimu[s.rezim]}</td>
                    <td className="py-1 px-2 text-right">{plnMln(s.koszt.razem)}</td>
                    <td className="py-1 px-2 text-right">{liczba(s.dscr, "", 2)}</td>
                    <td className="py-1 px-2 text-right">{pct(s.wymaganaDotacjaPct, 1)}</td>
                    <td className="py-1 pl-2">{s.domyka ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Karta>

      {/* Katalog źródeł danych */}
      <Karta tytul="Katalog źródeł danych" podtytul="Warstwa adapterów — realne API podpina się bez zmiany silników">
        <div className="grid md:grid-cols-2 gap-2">
          {zrodla.map((z) => (
            <div key={z.klucz} className="text-xs border border-slate-100 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{z.nazwa}</span>
                <span className="text-slate-500">{POZYSKANIE_BADGE[z.pozyskanie]}</span>
              </div>
              <div className="text-slate-500 mt-0.5">{z.zasila}</div>
              {z.endpoint && <div className="text-slate-300 font-mono mt-0.5 truncate">{z.endpoint}</div>}
            </div>
          ))}
        </div>
      </Karta>
    </div>
  );
}

function mut(k: Konfiguracja | null, f: (kk: Konfiguracja) => void): Konfiguracja | null {
  if (!k) return k;
  const kopia = structuredClone(k);
  f(kopia);
  return kopia;
}

function Suwak({
  etykieta,
  wartosc,
  min,
  max,
  krok = 1,
  onChange,
}: {
  etykieta: string;
  wartosc: number;
  min: number;
  max: number;
  krok?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">{etykieta}</div>
      <input
        type="range"
        className="w-full accent-slate-800"
        min={min}
        max={max}
        step={krok}
        value={wartosc}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Wynik({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{etykieta}</div>
      <div className="text-lg font-semibold text-slate-800 mt-0.5">{wartosc}</div>
    </div>
  );
}
