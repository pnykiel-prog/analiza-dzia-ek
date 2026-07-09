"use client";

import { useState } from "react";
import type { DaneDzialki, DaneTransportu } from "@/lib/types";
import { KONFIG_M2 } from "@/lib/config";
import { Karta } from "./ui";

/** Odpowiedzi klienta w M2 (wszystkie opcjonalne — puste = nieznane). */
export interface OdpowiedziM2 {
  dostepDrogi: boolean | null;
  odleglosci: Record<string, number | null>; // metry
  wysokoscOkolicyPieter: number | null;
  transport: DaneTransportu | null; // ręczny panel transportu; null = pominięte
  zalewowy: boolean | null; // deklaracja: teren zalewowy? tak/nie/nie wiem (fallback WFS)
  osuwiska: boolean | null; // deklaracja: teren zagrożony osuwiskami? tak/nie/nie wiem
  planistyka: {
    intensywnosc: number | null;
    maxWysokoscM: number | null;
    maxPowZabudowyPct: number | null;
    minPbcPct: number | null;
  } | null;
  planistykaPotwierdzona: boolean; // klient potwierdził: realne dane z MPZP/dokumentu
}

/** Wszystkie kategorie odległościowe (równorzędnie): usługi pieszo (kanał A) + otoczenie (modyfikator). */
const KATEGORIE_ODL: { klucz: string; etykieta: string }[] = [
  ...KONFIG_M2.odleglosciPieszo.map((o) => ({ klucz: o.klucz, etykieta: o.etykieta })),
  ...KONFIG_M2.otoczenie.kategorie.map((k) => ({ klucz: k, etykieta: KONFIG_M2.otoczenie.etykiety[k] ?? k })),
];

/**
 * Poziom 2 — proste pytania do klienta (wersja uproszczona, bez audytu braków).
 * Auto pobiera co się da w tle; tu pytamy tylko o to, czego auto nie ustaliło
 * i co klient realnie zna. Każde pole opcjonalne — puste = nieznane, dalej zawsze można.
 */
export function PytaniaM2({
  dane,
  onPrzelicz,
  licze,
}: {
  dane: DaneDzialki;
  onPrzelicz: (o: OdpowiedziM2) => void;
  licze: boolean;
}) {
  const drogaAuto = dane.dostepDrogaPubliczna != null; // auto rozstrzygnęło?
  const wysokoscAuto = dane.wysokoscOkolicyPieter != null;

  const [droga, setDroga] = useState<string>(dane.dostepDrogaPubliczna == null ? "" : dane.dostepDrogaPubliczna ? "tak" : "nie");
  const [odl, setOdl] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const o of KATEGORIE_ODL) {
      const v = dane.odleglosciM2?.[o.klucz];
      start[o.klucz] = v == null ? "" : String(v);
    }
    return start;
  });
  const [wys, setWys] = useState<string>(dane.wysokoscOkolicyPieter == null ? "" : String(dane.wysokoscOkolicyPieter));
  // Panel transportu (ręczny): "" = pominięte, "jest" / "niema". Przystanki tylko gdy "jest".
  const pustyPrzystanek = { odlegloscM: "", liczbaLinii: "", kursyDzien: "", kursyNoc: "" };
  const [komunikacja, setKomunikacja] = useState<"" | "jest" | "niema">(
    dane.transport == null ? "" : dane.transport.jest ? "jest" : "niema"
  );
  const [przystanki, setPrzystanki] = useState<Record<string, string>[]>(() =>
    dane.transport?.jest && dane.transport.przystanki.length
      ? dane.transport.przystanki.map((p) => ({
          odlegloscM: p.odlegloscM == null ? "" : String(p.odlegloscM),
          liczbaLinii: p.liczbaLinii == null ? "" : String(p.liczbaLinii),
          kursyDzien: p.kursyDzien == null ? "" : String(p.kursyDzien),
          kursyNoc: p.kursyNoc == null ? "" : String(p.kursyNoc),
        }))
      : [{ ...pustyPrzystanek }]
  );
  // Panel środowiskowy (fallback WFS): teren zalewowy / osuwiska — tak/nie/nie wiem.
  // Pytamy tylko o to, czego auto (warstwa WFS) nie rozstrzygnęło. „nie wiem" → null
  // → trafia na listę „do weryfikacji", NIE blokuje (naprawa CAP).
  const zalewowyAuto = dane.ryzykoPowodzioweSzczegolne != null;
  const osuwiskaAuto = dane.osuwisko != null;
  const stanNaOdp = (v: boolean | null): "" | "tak" | "nie" => (v == null ? "" : v ? "tak" : "nie");
  const [zalewowy, setZalewowy] = useState<"" | "tak" | "nie">(stanNaOdp(dane.ryzykoPowodzioweSzczegolne));
  const [osuwiska, setOsuwiska] = useState<"" | "tak" | "nie">(stanNaOdp(dane.osuwisko));

  const [planOtwarte, setPlanOtwarte] = useState(false);
  const [potwierdzona, setPotwierdzona] = useState(false);
  const [plan, setPlan] = useState<Record<string, string>>({ intensywnosc: "", maxWysokoscM: "", maxPowZabudowyPct: "", minPbcPct: "" });

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  // Odległości: rozdziel na ustalone automatycznie (nie pytamy) i brakujące (pytamy) — spec §7.
  const odlAuto = KATEGORIE_ODL
    .map((o) => ({ ...o, m: dane.odleglosciM2?.[o.klucz] }))
    .filter((o): o is typeof o & { m: number } => o.m != null);
  const odlDoPytania = KATEGORIE_ODL.filter((o) => dane.odleglosciM2?.[o.klucz] == null);

  function przelicz() {
    // Wysyłamy tylko odległości, o które pytaliśmy (auto trzyma się w dane.odleglosciM2 z prowenancją).
    const odleglosci: Record<string, number | null> = {};
    for (const o of odlDoPytania) odleglosci[o.klucz] = num(odl[o.klucz] ?? "");
    const planPodane = planOtwarte && (plan.intensywnosc || plan.maxWysokoscM || plan.maxPowZabudowyPct || plan.minPbcPct);
    // Transport: "" → null (pominięte); "niema" → jest:false; "jest" → przystanki z wartościami.
    const transport =
      komunikacja === ""
        ? null
        : komunikacja === "niema"
          ? { jest: false, przystanki: [] }
          : {
              jest: true,
              przystanki: przystanki
                .map((p) => ({ odlegloscM: num(p.odlegloscM), liczbaLinii: num(p.liczbaLinii), kursyDzien: num(p.kursyDzien), kursyNoc: num(p.kursyNoc) }))
                .filter((p) => p.odlegloscM != null || p.liczbaLinii != null || p.kursyDzien != null || p.kursyNoc != null),
            };
    const naStan = (v: "" | "tak" | "nie"): boolean | null => (v === "" ? null : v === "tak");
    onPrzelicz({
      dostepDrogi: droga === "" ? null : droga === "tak",
      odleglosci,
      wysokoscOkolicyPieter: num(wys),
      transport,
      zalewowy: naStan(zalewowy),
      osuwiska: naStan(osuwiska),
      planistyka: planPodane
        ? {
            intensywnosc: num(plan.intensywnosc),
            maxWysokoscM: num(plan.maxWysokoscM),
            maxPowZabudowyPct: num(plan.maxPowZabudowyPct),
            minPbcPct: num(plan.minPbcPct),
          }
        : null,
      planistykaPotwierdzona: Boolean(planPodane && potwierdzona),
    });
  }

  // Czy wpisano jakikolwiek wskaźnik planistyczny (do czytelnej podpowiedzi o potwierdzeniu).
  const czyWpisanoPlan = Boolean(plan.intensywnosc || plan.maxWysokoscM || plan.maxPowZabudowyPct || plan.minPbcPct);

  return (
    <Karta
      tytul="Uzupełnij dane do analizy (opcjonalnie)"
      podtytul="Część danych pobraliśmy automatycznie. Uzupełnij, co znasz — albo pomiń wszystko i przejdź do analizy. Wyniki zobaczysz na następnym ekranie."
    >
      {/* 1. Dostęp do drogi — tylko gdy auto nie rozstrzygnęło */}
      {!drogaAuto && (
        <div className="mb-4">
          <div className="text-[13px] text-grunt-text mb-1.5">Czy działka ma dostęp do drogi publicznej?</div>
          <div className="flex gap-2">
            {[["tak", "Tak"], ["nie", "Nie"], ["", "Nie wiem"]].map(([v, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => setDroga(v)}
                className={`badge ${droga === v ? "bg-grunt-ink text-white" : "bg-grunt-surface-3 text-grunt-text-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. PANEL: Odległości i komunikacja — wszystkie kategorie równorzędnie + przystanki. */}
      <div className="mb-4 rounded-lg border border-grunt-divider p-3">
        <div className="text-[13px] font-semibold text-grunt-text mb-2">Odległości i komunikacja</div>

        {odlAuto.length > 0 && (
          <div className="mb-2 text-[12px] text-grunt-green">
            ✓ {odlAuto.length} z {KATEGORIE_ODL.length} odległości ustalono automatycznie — pełna lista ze statusem jest w wynikach analizy.
          </div>
        )}

        {odlDoPytania.length > 0 ? (
          <>
            <div className="text-[11px] text-grunt-text-muted2 mb-1.5">
              {odlAuto.length > 0 ? "Uzupełnij pozostałe odległości (opcjonalnie):" : "Podaj odległości, jeśli znasz (opcjonalnie):"}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {odlDoPytania.map((o) => (
                <label key={o.klucz} className="text-sm block">
                  <span className="text-xs text-grunt-text-muted">{o.etykieta}</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={odl[o.klucz] ?? ""}
                    onChange={(e) => setOdl((s) => ({ ...s, [o.klucz]: e.target.value }))}
                    placeholder="m (opcjonalnie)"
                    className="inp mt-0.5"
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-grunt-text-muted2">Wszystkie odległości ustalone automatycznie — nic nie musisz podawać.</div>
        )}

        {/* Transport publiczny — w tym samym panelu. Modyfikator jakości + flaga, nie bramka. */}
        <div className="border-t border-grunt-divider pt-3 mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[13px] text-grunt-text">Komunikacja publiczna (przystanki)</div>
          {komunikacja !== "" && (
            <button type="button" onClick={() => setKomunikacja("")} className="text-[11px] text-grunt-text-faint2 underline">
              Pomiń
            </button>
          )}
        </div>
        <div className="flex gap-2 mb-1">
          {([["jest", "Jest"], ["niema", "Nie ma"]] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setKomunikacja(v)}
              className={`badge ${komunikacja === v ? "bg-grunt-ink text-white" : "bg-grunt-surface-3 text-grunt-text-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {komunikacja === "niema" && (
          <div className="text-[11px] text-grunt-text-muted2">
            Ustawi flagę „teren bez komunikacji zbiorowej" — informacyjnie, <b>nie obniża oceny</b> (ciężar dostępności bierze bliskość aglomeracji).
          </div>
        )}
        {komunikacja === "jest" && (
          <div className="mt-2 space-y-2">
            <div className="text-[11px] text-grunt-text-muted2">Podaj dane najbliższych przystanków (każda liczba dotyczy tego przystanka):</div>
            {przystanki.map((p, i) => (
              <div key={i} className="rounded-md bg-grunt-surface-2 border border-grunt-divider px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-grunt-text-muted">Przystanek {i + 1}</span>
                  {przystanki.length > 1 && (
                    <button type="button" onClick={() => setPrzystanki((s) => s.filter((_, j) => j !== i))} className="text-[11px] text-grunt-text-faint2 underline">
                      Usuń
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {([
                    ["odlegloscM", "Odległość [m]"],
                    ["liczbaLinii", "Linii"],
                    ["kursyDzien", "Kursów/dzień"],
                    ["kursyNoc", "Kursów/noc"],
                  ] as const).map(([k, l]) => (
                    <label key={k} className="text-sm block">
                      <span className="text-[11px] text-grunt-text-muted">{l}</span>
                      <input
                        type="number"
                        min="0"
                        value={p[k] ?? ""}
                        onChange={(e) => setPrzystanki((s) => s.map((row, j) => (j === i ? { ...row, [k]: e.target.value } : row)))}
                        placeholder="opcjonalnie"
                        className="inp mt-0.5"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setPrzystanki((s) => [...s, { ...pustyPrzystanek }])} className="text-[12px] text-grunt-text-muted underline">
              + dodaj przystanek
            </button>
          </div>
        )}
        </div>
      </div>

      {/* 2b. PANEL ŚRODOWISKOWY (fallback WFS): teren zalewowy / osuwiska.
          Pytamy tylko o to, czego auto nie rozstrzygnęło. „Nie wiem" → nie blokuje,
          trafia na listę „do weryfikacji". „Tak" → wynik warunkowy (CAP). */}
      {(!zalewowyAuto || !osuwiskaAuto) && (
        <div className="mb-4 rounded-lg border border-grunt-divider p-3">
          <div className="text-[13px] font-semibold text-grunt-text mb-1">Zagrożenia środowiskowe</div>
          <p className="text-[11px] text-grunt-text-muted2 mb-3">
            Jeśli nie wiesz — zostaw „Nie wiem". Nie zablokuje to oceny, ale trafi na listę „Do weryfikacji". „Tak" oznacza wynik warunkowy do potwierdzenia.
          </p>
          {!zalewowyAuto && (
            <TrojstanPytanie
              pytanie="Czy działka leży w terenie zalewowym (zagrożenie powodziowe)?"
              podpowiedz="Sprawdź: Hydroportal Wód Polskich (mapy zagrożenia powodziowego)."
              wartosc={zalewowy}
              onChange={setZalewowy}
            />
          )}
          {!osuwiskaAuto && (
            <TrojstanPytanie
              pytanie="Czy działka leży w terenie zagrożonym osuwiskami?"
              podpowiedz="Sprawdź: Geoportal SOPO / PIG (osuwiska). Istotne głównie w terenie górskim/pofałdowanym."
              wartosc={osuwiska}
              onChange={setOsuwiska}
              className={!zalewowyAuto ? "mt-3" : ""}
            />
          )}
        </div>
      )}

      {/* 3. Wysokość zabudowy w okolicy — tylko gdy auto (BDOT) nie pobrało */}
      {!wysokoscAuto && (
        <div className="mb-4">
          <label className="text-sm block max-w-[240px]">
            <span className="text-[13px] text-grunt-text">Typowa wysokość zabudowy w okolicy (piętra)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={wys}
              onChange={(e) => setWys(e.target.value)}
              placeholder="np. 4 (opcjonalnie)"
              className="inp mt-0.5"
            />
          </label>
        </div>
      )}

      {/* 4. Opcjonalne, zwijane: szczegóły planistyczne */}
      <div className="border-t border-grunt-divider pt-3">
        <button
          type="button"
          onClick={() => setPlanOtwarte((o) => !o)}
          className="text-[13px] text-grunt-text-muted flex items-center gap-2"
        >
          <span className={`inline-block transition-transform ${planOtwarte ? "rotate-90" : ""}`}>▸</span>
          Czy masz szczegóły planistyczne dla działki (np. wypis z MPZP)?
        </button>
        {planOtwarte && (
          <div className="mt-3">
            <p className="text-[11px] text-grunt-text-faint2 mb-3">
              Domyślnie korzystamy z danych z Poziomu 1 (KIMPZP + prognoza). Podanie wskaźników z wypisu uściśla model zabudowy i podnosi pewność. Wymaga <strong>dwóch kroków</strong>: wpisz wartości, a następnie <strong>potwierdź</strong>, że pochodzą z dokumentu.
            </p>

            {/* KROK 1 — wpisz wskaźniki z wypisu */}
            <div className="text-[11px] uppercase tracking-wide text-grunt-text-faint mb-1.5">Krok 1 — wpisz wskaźniki</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["intensywnosc", "Intensywność zabudowy", "0.1"],
                ["maxWysokoscM", "Maks. wysokość (m)", "1"],
                ["maxPowZabudowyPct", "Maks. % zabudowy", "1"],
                ["minPbcPct", "Min. PBC (%)", "1"],
              ].map(([k, l, step]) => (
                <label key={k} className="text-sm block">
                  <span className="text-xs text-grunt-text-muted">{l}</span>
                  <input
                    type="number"
                    step={step}
                    value={plan[k] ?? ""}
                    onChange={(e) => setPlan((s) => ({ ...s, [k]: e.target.value }))}
                    className="inp mt-0.5"
                  />
                </label>
              ))}
            </div>

            {/* KROK 2 — świadome potwierdzenie (warunek wejścia danej do oceny) */}
            <div className="text-[11px] uppercase tracking-wide text-grunt-text-faint mt-3 mb-1.5">Krok 2 — potwierdź źródło</div>
            <label className="flex items-start gap-2 text-[12px] text-grunt-text-muted">
              <input type="checkbox" className="mt-0.5" checked={potwierdzona} onChange={(e) => setPotwierdzona(e.target.checked)} />
              <span>Potwierdzam: to realne dane z MPZP / dokumentu urzędowego (bez potwierdzenia model użyje prognozy).</span>
            </label>

            {/* Podpowiedź stanu — jawnie mówi, czy wpis wpływa na ocenę i JAK go aktywować. */}
            {czyWpisanoPlan && !potwierdzona && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-grunt-amber/30 bg-grunt-amber-bg px-3 py-2">
                <span className="mono grid place-items-center shrink-0 w-5 h-5 rounded-full bg-grunt-amber text-white text-[11px] font-bold">!</span>
                <span className="text-[12px] text-grunt-amber-text">
                  Wpisane, <strong>niepotwierdzone</strong> — nie wpływa jeszcze na ocenę. Zaznacz „Potwierdzam", żeby dane weszły do oceny i zdjęły pozycję z listy „Do weryfikacji".
                </span>
              </div>
            )}
            {czyWpisanoPlan && potwierdzona && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-grunt-green/30 bg-grunt-green-bg px-3 py-2">
                <span className="mono grid place-items-center shrink-0 w-5 h-5 rounded-full bg-grunt-green text-white text-[11px] font-bold">✓</span>
                <span className="text-[12px] text-grunt-green">
                  Potwierdzone — wejdą do oceny i zdejmą pozycję „Wskaźniki zabudowy" oraz „Przeznaczenie w planie" z listy „Do weryfikacji" (podnosi pewność).
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <button onClick={przelicz} disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
          {licze ? "Liczę…" : "Przejdź do analizy →"}
        </button>
      </div>
    </Karta>
  );
}

/** Pytanie trójstanowe tak/nie/nie wiem (fallback środowiskowy jak transport). */
function TrojstanPytanie({
  pytanie,
  podpowiedz,
  wartosc,
  onChange,
  className = "",
}: {
  pytanie: string;
  podpowiedz: string;
  wartosc: "" | "tak" | "nie";
  onChange: (v: "" | "tak" | "nie") => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[13px] text-grunt-text mb-1.5">{pytanie}</div>
      <div className="flex gap-2 mb-1">
        {([["tak", "Tak"], ["nie", "Nie"], ["", "Nie wiem"]] as const).map(([v, l]) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className={`badge ${wartosc === v ? "bg-grunt-ink text-white" : "bg-grunt-surface-3 text-grunt-text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-grunt-text-faint2">{podpowiedz}</div>
    </div>
  );
}
