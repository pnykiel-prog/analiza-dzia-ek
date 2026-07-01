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
import { Chip, CalloutWalidacji } from "./grunt";

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
  const [rezimReczny, setRezimReczny] = useState(false);
  const rezimEff = rezimReczny ? rezim : sugestia.rezim;

  const opcjeZasobu = useMemo(() => dostepneZasoby(rezimEff, typInwestora), [rezimEff, typInwestora]);
  const [typZasobu, setTypZasobu] = useState<TypZasobu>("SPOLECZNY_CZYNSZOWY");
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
    <div className="grid lg:grid-cols-[1fr_minmax(0,320px)] gap-4 items-start">
    <Karta
      tytul="Ankieta finansowa — kto pyta o analizę (brama Poziomu 3)"
      podtytul="Typ inwestora, zasób, reżim i sposób wniesienia działki determinują montaż i wynik finansowy"
    >
      <div className="space-y-4">
        {/* Q1 — inwestor */}
        <Grupa label="Q1. Typ inwestora">
          {INWESTORZY.map((i) => (
            <Chip key={i} selected={typInwestora === i} onClick={() => setTypInwestora(i)}>{ETYK_INWESTORA[i]}</Chip>
          ))}
        </Grupa>

        {/* Q1a — udział gminy (SIM_MIESZANY) */}
        {typInwestora === "SIM_MIESZANY" && (
          <Grupa label="Q1a. Udział gminy">
            {(["wiekszosciowy", "mniejszosciowy", "symboliczny"] as UdzialGminy[]).map((u) => (
              <Chip key={u} selected={udzialGminy === u} onClick={() => setUdzialGminy(u)}>
                {u === "wiekszosciowy" ? "Większościowy" : u === "mniejszosciowy" ? "Mniejszościowy" : "Symboliczny"}
              </Chip>
            ))}
          </Grupa>
        )}

        {/* Q2 — zasób (dynamiczny filtr) */}
        <Grupa label="Q2. Typ zasobu (co ma powstać)" podpis="Filtrowane wg macierzy dostępu; „brak” ukryty.">
          {opcjeZasobu.map((o) => (
            <Chip key={o.zasob} selected={zasobEff === o.zasob} limited={o.dostep === "ograniczony"} onClick={() => setTypZasobu(o.zasob)}>
              {ETYK_ZASOBU[o.zasob]}
            </Chip>
          ))}
        </Grupa>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Q8 — data wniosku */}
          <label className="text-sm block">
            <span className="text-[11px] font-medium text-grunt-text-muted2">Q8. Data złożenia wniosku o finansowanie</span>
            <input type="date" value={dataWniosku} onChange={(e) => setDataWniosku(e.target.value)} className="inp mono mt-1" />
          </label>

          {/* Q3 — reżim (chipy, sugerowany z daty) */}
          <div>
            <span className="text-[11px] font-medium text-grunt-text-muted2">Q3. Reżim prawny analizy</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {(["current", "future"] as RezimFinansowy[]).map((r) => (
                <Chip key={r} selected={rezimEff === r} onClick={() => { setRezim(r); setRezimReczny(true); }}>{ETYK_REZIMU[r]}</Chip>
              ))}
            </div>
            <span className="text-[10px] text-grunt-text-faint2">Sugerowany z daty: {ETYK_REZIMU[sugestia.rezim]}</span>
          </div>
        </div>

        {/* Q4 — sposób wniesienia działki */}
        <Grupa label="Q4. Sposób wniesienia działki">
          {GRUNT_OPCJE.map((g) => (
            <Chip key={g} selected={sposobWniesieniaDzialki === g} onClick={() => setSposob(g)}>{ETYK_GRUNTU[g]}</Chip>
          ))}
        </Grupa>

        {/* Q5 — współpraca z gminą */}
        <Grupa label="Q5. Forma współpracy z gminą">
          {WSPOLPRACA_OPCJE.map((w) => (
            <Chip key={w} selected={wspolpracaGmina === w} onClick={() => setWspolpraca(w)}>{ETYK_WSPOLPRACY[w]}</Chip>
          ))}
        </Grupa>

        {/* Checkboxy Q1b / Q6 / Q7 */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          {KWALIFIKACJA_INVESTEU.includes(typInwestora) && (
            <Chk label="Q1b. Nowo utworzony podmiot bez zdolności kredytowej (gwarancja InvestEU)" checked={nowyPodmiot} onChange={setNowyPodmiot} />
          )}
          <Chk label="Q6. Efektywność energetyczna / OZE (FEnIKS)" checked={efektywnoscEnergetyczna} onChange={setEE} />
          <Chk label="Q7. Mieszkanie na Start (dopłata do czynszu — OPEX)" checked={mieszkanieNaStart} onChange={setMnS} />
        </div>
      </div>

      {/* Walidacja / okno przejściowe */}
      <div className="mt-4 space-y-2">
        {sugestia.oknoPrzejsciowe && (
          <CalloutWalidacji ton="ostrzezenie" tytul="Okno przejściowe 2027–2028" opis={`${sugestia.uzasadnienie} Analiza pokaże porównanie obu reżimów.`} />
        )}
        {walidacja?.zablokowana && <CalloutWalidacji ton="blad" tytul="Profil zablokowany" opis={walidacja.ostrzezenia[0]} />}
        {walidacja && !walidacja.zablokowana && walidacja.dostep === "ograniczony" && (
          <CalloutWalidacji ton="ostrzezenie" tytul="Dostęp ograniczony" opis={walidacja.ostrzezenia[0]} />
        )}
      </div>

      <button
        onClick={() => profil && onSubmit(profil)}
        disabled={licze || !profil || !!walidacja?.zablokowana}
        className="btn-primary mt-4"
        style={{ height: "var(--grunt-h-cta)" }}
      >
        {licze ? "Składam montaż i liczę…" : "Zatwierdź profil i złóż montaż →"}
      </button>
    </Karta>

    {/* Live profil finansowy (sticky) */}
    <div className="lg:sticky" style={{ top: "var(--grunt-sticky-top)" }}>
      <Karta tytul="Profil finansowy">
        <dl className="divide-y divide-grunt-divider-row">
          <ProfilRow k="Inwestor" v={ETYK_INWESTORA[typInwestora]} />
          <ProfilRow k="Zasób" v={zasobEff ? ETYK_ZASOBU[zasobEff] : "—"} />
          <ProfilRow k="Reżim" v={ETYK_REZIMU[rezimEff]} />
          <ProfilRow k="Wniesienie działki" v={ETYK_GRUNTU[sposobWniesieniaDzialki]} />
          <ProfilRow k="Współpraca z gminą" v={ETYK_WSPOLPRACY[wspolpracaGmina]} />
          <ProfilRow k="Efektywność / OZE" v={efektywnoscEnergetyczna ? "Tak (FEnIKS)" : "Nie"} />
          <ProfilRow k="Mieszkanie na Start" v={mieszkanieNaStart ? "Tak" : "Nie"} />
          {KWALIFIKACJA_INVESTEU.includes(typInwestora) && (
            <ProfilRow k="Nowy podmiot (InvestEU)" v={nowyPodmiot ? "Tak" : "Nie"} />
          )}
          <ProfilRow k="Data wniosku" v={dataWniosku} mono />
        </dl>
      </Karta>
    </div>
    </div>
  );
}

function ProfilRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[11px] text-grunt-text-muted2 shrink-0">{k}</dt>
      <dd className={`text-[12.5px] font-medium text-grunt-text text-right ${mono ? "mono" : ""}`}>{v}</dd>
    </div>
  );
}

function Grupa({ label, podpis, children }: { label: string; podpis?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-grunt-text-muted2">{label}</span>
      <div className="flex flex-wrap gap-2 mt-1.5">{children}</div>
      {podpis && <span className="text-[10px] text-grunt-text-faint2 mt-1 block">{podpis}</span>}
    </div>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-grunt-text-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-grunt-ink" />
      {label}
    </label>
  );
}
