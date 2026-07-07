"use client";

import { useMemo, useState } from "react";
import type {
  ProfilFinansowy,
  SposobWniesieniaDzialki,
  TypInwestora,
  TypZasobu,
  UdzialGminy,
  WspolpracaGmina,
} from "@/lib/finanse/typy";
import { dostepneZasoby, sugerujRezim, walidujUprawnienia } from "@/lib/finanse";
import { rolaZeSposobu } from "@/lib/finanse/montaz";
import {
  ETYK_GRUNTU,
  ETYK_INWESTORA,
  ETYK_WSPOLPRACY,
  ETYK_ZASOBU,
} from "@/lib/finanse/etykiety";
import { Karta } from "./ui";
import { Chip, CalloutWalidacji } from "./grunt";

const INWESTORZY = Object.keys(ETYK_INWESTORA) as TypInwestora[];
const GRUNT_OPCJE = Object.keys(ETYK_GRUNTU) as SposobWniesieniaDzialki[];
const KWALIFIKACJA_INVESTEU: TypInwestora[] = ["SIM_GMINNY", "SIM_MIESZANY", "SIM_PRYWATNY", "TBS", "SPOLDZIELNIA", "SPOLKA_GMINNA"];

// Podmioty powiązane z gminą — tylko one mogą wnieść działkę aportem gminnym / Lokal za Grunt.
const PODMIOTY_GMINNE: TypInwestora[] = ["GMINA", "SPOLKA_GMINNA", "SIM_GMINNY", "SIM_MIESZANY"];
/** Sposoby wniesienia dozwolone dla podmiotu (drabinka: filtr po podmiocie). */
function dozwoloneWniesienie(inwestor: TypInwestora): SposobWniesieniaDzialki[] {
  const gminny = PODMIOTY_GMINNE.includes(inwestor);
  return GRUNT_OPCJE.filter((g) => (g === "APORT_GMINNY" || g === "LOKAL_ZA_GRUNT" ? gminny : true));
}

/**
 * Formy współpracy dozwolone dla podmiotu (wytyczne „forma współpracy per podmiot").
 * ZAPORA: to TYLKO filtr list w drabince — nie zmienia obliczeń montażu. Gmina wyposaża
 * własny podmiot (aport/udziały), nie zawiera partnerstwa → „umowa partnerska" ukryta dla
 * gminnych. Wpływ na montaż ma wyłącznie LzG/ZPI (max grant komunalny przyszły) — w silniku.
 */
const WSPOLPRACA_PER_PODMIOT: Record<TypInwestora, WspolpracaGmina[]> = {
  GMINA: ["BRAK"], // inwestor bezpośredni — nie partner
  SIM_GMINNY: ["APORT", "UDZIAL_KAPITALOWY", "BRAK"],
  SPOLKA_GMINNA: ["APORT", "UDZIAL_KAPITALOWY", "BRAK"],
  SIM_MIESZANY: ["UMOWA_PARTNERSKA", "UDZIAL_KAPITALOWY", "APORT"],
  SIM_PRYWATNY: ["UMOWA_PARTNERSKA", "LOKAL_ZA_GRUNT", "ZPI", "BRAK"],
  TBS: ["UMOWA_PARTNERSKA", "LOKAL_ZA_GRUNT", "ZPI", "BRAK"],
  SPOLDZIELNIA: ["UMOWA_PARTNERSKA", "LOKAL_ZA_GRUNT", "ZPI", "BRAK"],
};

/**
 * Ekran ankiety finansowej (osobny, między M2 a M3). Pyta TYLKO o to, co klient
 * zna lub czym decyduje — parametry systemowe (oprocentowanie, okres, grant, indeksy)
 * są w konfiguracji, reżim nie jest pytaniem (wynik pokazuje OBA). Na tym ekranie
 * klient NIE widzi montażu — tylko rosnący „Profil finansowy" (motywacja).
 */
export function AnkietaFinansowa({
  onSubmit,
  licze,
  domyslnaData,
  wartoscDzialkiSugestia,
}: {
  onSubmit: (profil: ProfilFinansowy) => void;
  licze?: boolean;
  domyslnaData?: string;
  wartoscDzialkiSugestia?: number | null;
}) {
  const [typInwestora, setTypInwestora] = useState<TypInwestora>("SIM_GMINNY");
  const [udzialGminy, setUdzialGminy] = useState<UdzialGminy>("wiekszosciowy");
  const [nowyPodmiot, setNowyPodmiot] = useState(false);
  const [dataWniosku] = useState(domyslnaData ?? "2026-06-01");
  const sugestia = useMemo(() => sugerujRezim(dataWniosku), [dataWniosku]);
  const rezimEff = sugestia.rezim; // reżim nie jest pytaniem — wynik pokazuje oba

  const opcjeZasobu = useMemo(() => dostepneZasoby(rezimEff, typInwestora), [rezimEff, typInwestora]);
  const [typZasobu, setTypZasobu] = useState<TypZasobu>("SPOLECZNY_CZYNSZOWY");
  const zasobEff = opcjeZasobu.some((o) => o.zasob === typZasobu) ? typZasobu : opcjeZasobu[0]?.zasob;

  // Wniesienie działki — filtrowane po podmiocie (drabinka), z fallbackiem na dozwolone.
  const opcjeWniesienia = useMemo(() => dozwoloneWniesienie(typInwestora), [typInwestora]);
  const [sposobWybrany, setSposob] = useState<SposobWniesieniaDzialki>("APORT_GMINNY");
  const sposobWniesieniaDzialki = opcjeWniesienia.includes(sposobWybrany) ? sposobWybrany : opcjeWniesienia[0];
  // Forma współpracy — filtrowana po podmiocie (drabinka), z fallbackiem na dozwolone.
  const opcjeWspolpracy = useMemo(() => WSPOLPRACA_PER_PODMIOT[typInwestora], [typInwestora]);
  const [wspolpracaWybrana, setWspolpraca] = useState<WspolpracaGmina>("BRAK");
  const wspolpracaGmina = opcjeWspolpracy.includes(wspolpracaWybrana) ? wspolpracaWybrana : opcjeWspolpracy[0];
  const [efektywnoscEnergetyczna, setEE] = useState(false);
  const [pozwolenieNaBudowe, setPnB] = useState(false);

  const [wartoscDzialki, setWartoscDzialki] = useState(wartoscDzialkiSugestia ? String(Math.round(wartoscDzialkiSugestia)) : "");

  const rola = rolaZeSposobu(sposobWniesieniaDzialki);
  const etykietaDzialki =
    rola === "koszt" ? "Cena zakupu działki (koszt) [R]" : rola === "zrodlo" ? "Wartość działki (aport — źródło) [R]" : "Wartość działki (informacyjnie) [R]";

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
        mieszkanieNaStart: false, // usunięte z ankiety (wsparcie najemcy, nie montaż inwestora)
        dataWniosku,
        wartoscDzialkiPln: wartoscDzialki ? Number(wartoscDzialki) : undefined,
        // Partycypacja i wkład są liczone automatycznie (silnik montażu), nie pytane.
        pozwolenieNaBudowe,
      }
    : null;

  const walidacja = profil ? walidujUprawnienia(profil) : null;

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,320px)] gap-4 items-start">
    <Karta
      tytul="Ankieta finansowa — kto pyta i jak finansuje"
      podtytul="Tylko dane, które znasz lub którymi decydujesz. Parametry systemowe są w konfiguracji; wynik pokaże oba reżimy."
    >
      <div className="space-y-4">
        {/* Q1 — inwestor */}
        <Grupa label="Typ inwestora">
          {INWESTORZY.map((i) => (
            <Chip key={i} selected={typInwestora === i} onClick={() => setTypInwestora(i)}>{ETYK_INWESTORA[i]}</Chip>
          ))}
        </Grupa>

        {/* Q1a — udział gminy (SIM_MIESZANY) */}
        {typInwestora === "SIM_MIESZANY" && (
          <Grupa label="Udział gminy">
            {(["wiekszosciowy", "mniejszosciowy", "symboliczny"] as UdzialGminy[]).map((u) => (
              <Chip key={u} selected={udzialGminy === u} onClick={() => setUdzialGminy(u)}>
                {u === "wiekszosciowy" ? "Większościowy" : u === "mniejszosciowy" ? "Mniejszościowy" : "Symboliczny"}
              </Chip>
            ))}
          </Grupa>
        )}

        {/* 2. Sposób wniesienia działki — filtrowany po podmiocie */}
        <Grupa label="Sposób wniesienia działki" podpis="Aport gminny / Lokal za Grunt tylko dla podmiotów powiązanych z gminą.">
          {opcjeWniesienia.map((g) => (
            <Chip key={g} selected={sposobWniesieniaDzialki === g} onClick={() => setSposob(g)}>{ETYK_GRUNTU[g]}</Chip>
          ))}
        </Grupa>

        {/* 3. Zasób (co ma powstać) — filtr wg macierzy dostępu */}
        <Grupa label="Typ zasobu (co ma powstać)" podpis="Filtrowane wg macierzy dostępu; „brak” ukryty.">
          {opcjeZasobu.map((o) => (
            <Chip key={o.zasob} selected={zasobEff === o.zasob} limited={o.dostep === "ograniczony"} onClick={() => setTypZasobu(o.zasob)}>
              {ETYK_ZASOBU[o.zasob]}
            </Chip>
          ))}
        </Grupa>

        {/* 4. Współpraca z gminą — filtrowana po podmiocie; LzG/ZPI odblokowują max grant komunalny (reżim przyszły) */}
        <Grupa label="Forma współpracy z gminą" podpis="Filtrowana wg podmiotu. Lokal za Grunt / ZPI podnoszą maksymalny grant komunalny (reżim przyszły).">
          {opcjeWspolpracy.map((w) => (
            <Chip key={w} selected={wspolpracaGmina === w} onClick={() => setWspolpraca(w)}>{ETYK_WSPOLPRACY[w]}</Chip>
          ))}
        </Grupa>

        {/* 5. Wartość działki [R] — rola (źródło/koszt) wg sposobu wniesienia */}
        <div className="grid sm:grid-cols-2 gap-3">
          <PoleLiczbowe label={etykietaDzialki} value={wartoscDzialki} onChange={setWartoscDzialki} sufiks="zł" />
        </div>
        <p className="text-[11px] text-grunt-text-faint2 -mt-2">
          Partycypacja najemców i wkład domykający są liczone automatycznie (partycypacja przysługuje tylko przy zasobie społecznym czynszowym).
        </p>

        {/* 6. Flagi końcowe: InvestEU · FEnIKS/OZE · PnB (info) */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          {KWALIFIKACJA_INVESTEU.includes(typInwestora) && (
            <Chk label="Nowo utworzony podmiot bez zdolności kredytowej (gwarancja InvestEU)" checked={nowyPodmiot} onChange={setNowyPodmiot} />
          )}
          <Chk label="Efektywność energetyczna / OZE (FEnIKS)" checked={efektywnoscEnergetyczna} onChange={setEE} />
          <Chk label="Pozwolenie na budowę (informacyjnie — dojrzałość projektu)" checked={pozwolenieNaBudowe} onChange={setPnB} />
        </div>
      </div>

      {/* Walidacja / okno przejściowe */}
      <div className="mt-4 space-y-2">
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
        {licze ? "Składam montaż i liczę…" : "Zatwierdź profil i pokaż montaż →"}
      </button>
    </Karta>

    {/* Live profil finansowy (sticky) — BEZ montażu (motywacja) */}
    <div className="lg:sticky" style={{ top: "var(--grunt-sticky-top)" }}>
      <Karta tytul="Profil finansowy">
        <dl className="divide-y divide-grunt-divider-row">
          <ProfilRow k="Inwestor" v={ETYK_INWESTORA[typInwestora]} />
          <ProfilRow k="Zasób" v={zasobEff ? ETYK_ZASOBU[zasobEff] : "—"} />
          <ProfilRow k="Reżim" v="Oba (porównanie)" />
          <ProfilRow k="Wniesienie działki" v={ETYK_GRUNTU[sposobWniesieniaDzialki]} />
          <ProfilRow k="Współpraca z gminą" v={ETYK_WSPOLPRACY[wspolpracaGmina]} />
          {wartoscDzialki && <ProfilRow k={rola === "koszt" ? "Cena działki" : "Wartość działki"} v={`${Number(wartoscDzialki).toLocaleString("pl-PL")} zł`} mono />}
          <ProfilRow k="Efektywność / OZE" v={efektywnoscEnergetyczna ? "Tak (FEnIKS)" : "Nie"} />
          {KWALIFIKACJA_INVESTEU.includes(typInwestora) && (
            <ProfilRow k="Nowy podmiot (InvestEU)" v={nowyPodmiot ? "Tak" : "Nie"} />
          )}
          <ProfilRow k="Pozwolenie na budowę" v={pozwolenieNaBudowe ? "Tak" : "Nie"} />
        </dl>
        <p className="text-[11px] text-grunt-text-faint2 mt-3">Montaż finansowy pokaże się po zatwierdzeniu profilu.</p>
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

function PoleLiczbowe({ label, value, onChange, sufiks }: { label: string; value: string; onChange: (v: string) => void; sufiks?: string }) {
  return (
    <label className="text-sm block">
      <span className="text-[11px] font-medium text-grunt-text-muted2">{label}</span>
      <div className="relative mt-1">
        <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="inp mono" placeholder="—" />
        {sufiks && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grunt-text-faint2 pointer-events-none">{sufiks}</span>}
      </div>
    </label>
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
