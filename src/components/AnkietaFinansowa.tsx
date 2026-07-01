"use client";

import { useMemo, useState } from "react";
import type {
  ProfilFinansowy,
  RezimFinansowy,
  SposobWniesieniaDzialki,
  TypInwestora,
  TypZasobu,
  UdzialGminy,
  WspolpracaGmina,
} from "@/lib/finanse/typy";
import { dostepneZasoby, sugerujRezim, walidujUprawnienia } from "@/lib/finanse";
import {
  ETYK_GRUNTU,
  ETYK_INWESTORA,
  ETYK_REZIMU,
  ETYK_WSPOLPRACY,
  ETYK_ZASOBU,
} from "@/lib/finanse/etykiety";
import { Karta } from "./ui";

const INWESTORZY = Object.keys(ETYK_INWESTORA) as TypInwestora[];
const GRUNT_OPCJE = Object.keys(ETYK_GRUNTU) as SposobWniesieniaDzialki[];
const WSPOLPRACA_OPCJE = Object.keys(ETYK_WSPOLPRACY) as WspolpracaGmina[];
const KWALIFIKACJA_INVESTEU: TypInwestora[] = ["SIM_GMINNY", "SIM_MIESZANY", "SIM_PRYWATNY", "TBS", "SPOLDZIELNIA", "SPOLKA_GMINNA"];

export function AnkietaFinansowa({
  onSubmit,
  licze,
  domyslnaData,
}: {
  onSubmit: (profil: ProfilFinansowy) => void;
  licze?: boolean;
  domyslnaData?: string;
}) {
  const [typInwestora, setTypInwestora] = useState<TypInwestora>("SIM_GMINNY");
  const [udzialGminy, setUdzialGminy] = useState<UdzialGminy>("wiekszosciowy");
  const [nowyPodmiot, setNowyPodmiot] = useState(false);
  const [dataWniosku, setDataWniosku] = useState(domyslnaData ?? "2026-06-01");
  const sugestia = useMemo(() => sugerujRezim(dataWniosku), [dataWniosku]);
  const [rezim, setRezim] = useState<RezimFinansowy>(sugestia.rezim);
  // Reżim śledzi sugestię z daty, dopóki użytkownik ręcznie nie zmieni (uproszczenie: podpowiedź).
  const [rezimReczny, setRezimReczny] = useState(false);
  const rezimEff = rezimReczny ? rezim : sugestia.rezim;

  const opcjeZasobu = useMemo(() => dostepneZasoby(rezimEff, typInwestora), [rezimEff, typInwestora]);
  const [typZasobu, setTypZasobu] = useState<TypZasobu>("SPOLECZNY_CZYNSZOWY");
  // Jeśli bieżący zasób nie jest dostępny w nowej konfiguracji — wybierz pierwszy dostępny.
  const zasobEff = opcjeZasobu.some((o) => o.zasob === typZasobu) ? typZasobu : opcjeZasobu[0]?.zasob;

  const [sposobWniesieniaDzialki, setSposob] = useState<SposobWniesieniaDzialki>("APORT_GMINNY");
  const [wspolpracaGmina, setWspolpraca] = useState<WspolpracaGmina>("UMOWA_PARTNERSKA");
  const [efektywnoscEnergetyczna, setEE] = useState(false);
  const [mieszkanieNaStart, setMnS] = useState(false);

  const profil: ProfilFinansowy | null = zasobEff
    ? {
        typInwestora,
        udzialGminy: typInwestora === "SIM_MIESZANY" ? udzialGminy : undefined,
        nowyPodmiot: KWALIFIKACJA_INVESTEU.includes(typInwestora) ? nowyPodmiot : undefined,
        typZasobu: zasobEff,
        rezim: rezimEff,
        sposobWniesieniaDzialki,
        wspolpracaGmina,
        efektywnoscEnergetyczna,
        mieszkanieNaStart,
        dataWniosku,
      }
    : null;

  const walidacja = profil ? walidujUprawnienia(profil) : null;

  return (
    <Karta
      tytul="Ankieta finansowa — kto pyta o analizę (brama Poziomu 3)"
      podtytul="Typ inwestora, zasób, reżim i sposób wniesienia działki determinują montaż i wynik finansowy"
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Q1 — inwestor */}
        <Sel label="Q1. Typ inwestora" value={typInwestora} onChange={(v) => setTypInwestora(v as TypInwestora)}
          opcje={INWESTORZY.map((i) => [i, ETYK_INWESTORA[i]])} />

        {/* Q1a — udział gminy (SIM_MIESZANY) */}
        {typInwestora === "SIM_MIESZANY" && (
          <Sel label="Q1a. Udział gminy" value={udzialGminy} onChange={(v) => setUdzialGminy(v as UdzialGminy)}
            opcje={[["wiekszosciowy", "Większościowy"], ["mniejszosciowy", "Mniejszościowy"], ["symboliczny", "Symboliczny"]]} />
        )}

        {/* Q8 — data wniosku (steruje reżimem) */}
        <label className="text-sm block">
          <span className="text-xs text-slate-500">Q8. Data złożenia wniosku o finansowanie</span>
          <input type="date" value={dataWniosku} onChange={(e) => setDataWniosku(e.target.value)} className="inp mt-0.5" />
        </label>

        {/* Q3 — reżim (sugerowany z daty) */}
        <label className="text-sm block">
          <span className="text-xs text-slate-500">Q3. Reżim prawny analizy</span>
          <select
            value={rezimEff}
            onChange={(e) => { setRezim(e.target.value as RezimFinansowy); setRezimReczny(true); }}
            className="inp bg-white mt-0.5"
          >
            <option value="current">{ETYK_REZIMU.current}</option>
            <option value="future">{ETYK_REZIMU.future}</option>
          </select>
          <span className="text-[11px] text-slate-500">Sugerowany z daty: {ETYK_REZIMU[sugestia.rezim]}</span>
        </label>

        {/* Q2 — zasób (dynamiczny filtr) */}
        <label className="text-sm block">
          <span className="text-xs text-slate-500">Q2. Typ zasobu (co ma powstać)</span>
          <select value={zasobEff ?? ""} onChange={(e) => setTypZasobu(e.target.value as TypZasobu)} className="inp bg-white mt-0.5">
            {opcjeZasobu.map((o) => (
              <option key={o.zasob} value={o.zasob}>
                {ETYK_ZASOBU[o.zasob]}{o.dostep === "ograniczony" ? " (ograniczony)" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400">Filtrowane wg macierzy dostępu; „brak" ukryty.</span>
        </label>

        {/* Q4 — sposób wniesienia działki */}
        <Sel label="Q4. Sposób wniesienia działki" value={sposobWniesieniaDzialki} onChange={(v) => setSposob(v as SposobWniesieniaDzialki)}
          opcje={GRUNT_OPCJE.map((g) => [g, ETYK_GRUNTU[g]])} />

        {/* Q5 — współpraca z gminą */}
        <Sel label="Q5. Forma współpracy z gminą" value={wspolpracaGmina} onChange={(v) => setWspolpraca(v as WspolpracaGmina)}
          opcje={WSPOLPRACA_OPCJE.map((w) => [w, ETYK_WSPOLPRACY[w]])} />
      </div>

      {/* Checkboxy Q1b / Q6 / Q7 */}
      <div className="flex flex-wrap gap-4 mt-3">
        {KWALIFIKACJA_INVESTEU.includes(typInwestora) && (
          <Chk label="Q1b. Nowo utworzony podmiot bez zdolności kredytowej (gwarancja InvestEU)" checked={nowyPodmiot} onChange={setNowyPodmiot} />
        )}
        <Chk label="Q6. Efektywność energetyczna / OZE (FEnIKS)" checked={efektywnoscEnergetyczna} onChange={setEE} />
        <Chk label="Q7. Mieszkanie na Start (dopłata do czynszu — OPEX)" checked={mieszkanieNaStart} onChange={setMnS} />
      </div>

      {sugestia.oknoPrzejsciowe && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          ⚑ {sugestia.uzasadnienie} Analiza pokaże porównanie obu reżimów.
        </p>
      )}
      {walidacja?.zablokowana && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          ⛔ {walidacja.ostrzezenia[0]}
        </p>
      )}
      {walidacja && !walidacja.zablokowana && walidacja.dostep === "ograniczony" && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          ⚑ {walidacja.ostrzezenia[0]}
        </p>
      )}

      <button
        onClick={() => profil && onSubmit(profil)}
        disabled={licze || !profil || !!walidacja?.zablokowana}
        className="mt-4 bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50"
      >
        {licze ? "Składam montaż i liczę…" : "Zatwierdź profil i złóż montaż →"}
      </button>
    </Karta>
  );
}

function Sel({ label, value, onChange, opcje }: { label: string; value: string; onChange: (v: string) => void; opcje: [string, string][] }) {
  return (
    <label className="text-sm block">
      <span className="text-xs text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="inp bg-white mt-0.5">
        {opcje.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
      {label}
    </label>
  );
}
