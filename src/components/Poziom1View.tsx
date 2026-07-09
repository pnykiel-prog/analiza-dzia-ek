import type { KluczWerdyktu, WerdyktP1, Werdykt, WynikPoziom1 } from "@/lib/types";
import { Karta, Statystyka } from "./ui";
import { WskaznikPewnosci, Gauge } from "./grunt";
import { liczba, statusSlowny } from "@/lib/format";

// Oba profile definiuje wspólny warunek: brak własnego lokalu (kwalifikacja do
// budownictwa społecznego). Wiek jedynie je rozdziela: aktywni (18–wiek emer.) / seniorzy.
const ETYK_WERDYKT: Record<KluczWerdyktu, string> = {
  spolecznyMlodzi: "Społeczny — aktywni (bez własnego M)",
  spolecznySeniorzy: "Społeczny — seniorzy (bez własnego M)",
  komunalnyMlodzi: "Komunalny — aktywni (bez własnego M)",
  komunalnySeniorzy: "Komunalny — seniorzy (bez własnego M)",
};

const KOLOR_STATUSU: Record<Werdykt, string> = {
  zielony: "text-grunt-green",
  zolty: "text-grunt-amber",
  czerwony: "text-grunt-red",
};
const KROPKA: Record<Werdykt, string> = {
  zielony: "bg-grunt-green",
  zolty: "bg-grunt-amber",
  czerwony: "bg-grunt-red",
};

/**
 * Widok Poziomu 1 (wersja pełna): SIATKA 4 WERDYKTÓW dwóch natur — społeczne i
 * komunalne. Każdy kafel to POZIOM POTRZEBY (niski/umiarkowany/wysoki) z proporcji
 * kohortowej (kwalifikujący ÷ własna kohorta), plus korekta migracyjna i kwalifikacje
 * dochodowe. P1 NIE odnosi się do pojemności/liczby mieszkań — wystarczalność wobec
 * projektu wyznacza dopiero Poziom 2 (obwiednia + warianty).
 */
export function Poziom1View({ p1, pelny = true, pokazRekomendacje = true }: { p1: WynikPoziom1; pelny?: boolean; pokazRekomendacje?: boolean }) {
  const ocena = p1.ocenaPopytu;
  const w = ocena.werdykty;
  const rek = w[ocena.rekomendowanyKierunek];

  return (
    <>
      {p1.funkcjaMieszkaniowaDozwolona === false && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-red/25 bg-grunt-red-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-red text-white text-[13px] font-bold">✕</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-red">Funkcja mieszkaniowa niedozwolona</div>
            <div className="text-[12px] text-grunt-text-muted">Wskazane przeznaczenie jest sprzeczne z zabudową mieszkaniową — werdykty społeczne wyzerowane.</div>
          </div>
        </div>
      )}

      {/* Rekomendowany kierunek (ukrywany, gdy pokazany w panelu potwierdzenia) */}
      {pokazRekomendacje && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-grunt-ink/15 bg-grunt-surface-3 px-3.5 py-2.5">
          <div className="text-[13px] text-grunt-text-muted">
            Rekomendowany kierunek: <strong className="text-grunt-text">{ETYK_WERDYKT[ocena.rekomendowanyKierunek]}</strong>
            <span className={`ml-2 font-semibold ${KOLOR_STATUSU[rek.werdykt]}`}>{statusSlowny[rek.werdykt]} · {rek.score}/100</span>
          </div>
          <span className="text-[11px] text-grunt-text-faint2">pewność ogólna {ocena.pewnoscOgolna}%</span>
        </div>
      )}

      {/* SIATKA 4 WERDYKTÓW */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-grunt-text-faint mb-2">
          Społeczne — poziom potrzeby w kohorcie klienta (wystarczalność wobec liczby mieszkań: Poziom 2)
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <KartaWerdyktu w={w.spolecznyMlodzi} rekomendowany={ocena.rekomendowanyKierunek === "spolecznyMlodzi"} />
          <KartaWerdyktu w={w.spolecznySeniorzy} rekomendowany={ocena.rekomendowanyKierunek === "spolecznySeniorzy"} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-grunt-text-faint mb-2">
          Komunalne — poziom potrzeby w kohorcie klienta (segment komunalny)
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <KartaWerdyktu w={w.komunalnyMlodzi} rekomendowany={ocena.rekomendowanyKierunek === "komunalnyMlodzi"} />
          <KartaWerdyktu w={w.komunalnySeniorzy} rekomendowany={ocena.rekomendowanyKierunek === "komunalnySeniorzy"} />
        </div>
      </div>

      {/* Korekta migracyjna — JEDEN mnożnik (oczyszczony model), waga per kafel */}
      <Karta
        tytul="Korekta migracyjna"
        podtytul="Jeden mnożnik z salda migracji; przyłożony z wagą per kafel (najmocniej: aktywni społeczni)"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Statystyka etykieta="Mnożnik popytu" wartosc={`×${ocena.korektaMigracyjna.mBazowy.toFixed(2)}`} akcent />
          <Statystyka
            etykieta={ocena.korektaMigracyjna.zNaplywu ? "Napływ vs benchmark" : "Saldo migracji"}
            wartosc={ocena.korektaMigracyjna.saldo1000 == null ? "brak danych" : `${ocena.korektaMigracyjna.saldo1000 > 0 ? "+" : ""}${ocena.korektaMigracyjna.saldo1000}/1000`}
          />
          <Statystyka etykieta="Wpływ" wartosc={ocena.korektaMigracyjna.mBazowy > 1 ? "podnosi popyt" : ocena.korektaMigracyjna.mBazowy < 1 ? "obniża popyt" : "neutralny"} />
        </div>
        {ocena.korektaMigracyjna.zNaplywu && (
          <p className="text-[11px] text-grunt-amber-text2 mt-2">Oszacowane z samego napływu zameldowań (brak odpływu i salda netto w BDL) — słabszy sygnał, niższa pewność.</p>
        )}
        {!ocena.korektaMigracyjna.dostepna && (
          <p className="text-[11px] text-grunt-amber-text2 mt-2">Brak danych migracyjnych (napływ/odpływ) — mnożnik neutralny ×1,00 (bez korekty).</p>
        )}
        <p className="text-[10px] text-grunt-text-faint2 mt-2">Wagi kafli: aktywni–społeczny 1,0 · aktywni–komunalny 0,3 · seniorzy–społeczny 0,2 · seniorzy–komunalny 0,0.</p>
      </Karta>

      {/* Kwalifikacje — trójdzielny podział dochodowy (liczby) */}
      {pelny && (
        <Karta tytul="Kwalifikacje dochodowe (liczby)" podtytul="Trójdzielny podział rozkładu dochodów: K = komunalny, S = społeczny, R = rynek">
          <div className="grid md:grid-cols-2 gap-4">
            {(["mlodzi", "seniorzy"] as const).map((p) => {
              const k = ocena.kwalifikacje[p];
              return (
                <div key={p} className="rounded-panel border border-grunt-border p-4">
                  <div className="text-[13px] font-semibold text-grunt-text mb-2">{p === "mlodzi" ? "Aktywni bez własnego lokalu (20–64)" : "Seniorzy bez własnego lokalu (65+)"}</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <MiniStat e="Grupa (N)" v={k.nGrupa == null ? "brak" : liczba(k.nGrupa)} />
                    <MiniStat e="Komunalny (K)" v={k.nKomunalny == null ? "brak" : liczba(k.nKomunalny)} />
                    <MiniStat e="Społeczny (S)" v={k.nSpoleczny == null ? "brak" : liczba(k.nSpoleczny)} />
                  </div>
                  <p className="text-[11px] text-grunt-text-faint2 mt-2">
                    Udziały: K {k.qK == null ? "–" : `${Math.round(k.qK * 100)}%`} · S {k.qS == null ? "–" : `${Math.round(k.qS * 100)}%`}
                    {k.estymacja ? " · estymowane z rozkładu regionalnego" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </Karta>
      )}

      {/* Prognoza pojemności (PUM / kondygnacje / liczba mieszkań) świadomie pominięta na M1 —
          orientacyjny model dawał zbyt nietrafione wartości. Pojemność liczona jest na Poziomie 2
          (obwiednia + warianty), gdzie wchodzą potwierdzone wskaźniki. */}
    </>
  );
}

// Hex kolorów werdyktu (do łuku gauge — SVG stroke, nie klasa Tailwind).
const KOLOR_HEX: Record<Werdykt, string> = {
  zielony: "#1C8A5A",
  zolty: "#B5790B",
  czerwony: "#C0392B",
};

function KartaWerdyktu({ w, rekomendowany }: { w: WerdyktP1; rekomendowany: boolean }) {
  const spol = w.natura === "spoleczny";
  const mlodzi = w.klucz.includes("Mlodzi");
  const akcent = mlodzi ? "var(--grunt-young)" : "var(--grunt-senior)"; // kolor profilu
  // Spójność P1/P2: P1 = poziom potrzeby w kohorcie (BEZ pojemności — ta wchodzi w P2).
  const natura = spol ? "poziom potrzeby (segment społeczny)" : "poziom potrzeby (segment komunalny)";
  return (
    <div
      className={`relative rounded-2xl border overflow-hidden ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border shadow-card"}`}
      style={{ background: "var(--grunt-surface)" }}
    >
      {/* Pasek akcentu profilu (kierunek wizualny §3) */}
      <div style={{ height: 4, background: akcent }} />
      {rekomendowany && (
        <span
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full text-white text-[11px] font-semibold uppercase"
          style={{ background: "var(--grunt-ink)", padding: "5px 11px", letterSpacing: ".03em" }}
        >
          ★ Rekomendowany
        </span>
      )}
      <div className="px-5 pt-5 pb-5">
        {/* Profil */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: akcent }} />
          <span className="text-[13px] font-semibold text-grunt-text-3">{ETYK_WERDYKT[w.klucz]}</span>
        </div>
        {/* Werdykt + gauge */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {w.nieoznaczony ? (
              <span className="flex items-center gap-2.5 text-[22px] font-semibold text-grunt-text-muted2">
                <span className="w-3 h-3 rounded-full bg-grunt-text-faint2" />
                Nieoznaczona
              </span>
            ) : (
              <span className={`flex items-center gap-2.5 text-[26px] font-semibold ${KOLOR_STATUSU[w.werdykt]}`} style={{ letterSpacing: "-.01em" }}>
                <span className={`w-[13px] h-[13px] rounded-full ${KROPKA[w.werdykt]}`} />
                {statusSlowny[w.werdykt]}
              </span>
            )}
            {!w.nieoznaczony && w.poziom && (
              <div className="mt-2 flex items-center gap-2 text-[12px]">
                <span className="text-grunt-text-muted2">Poziom potrzeby:</span>
                <span className="font-semibold text-grunt-text capitalize">{w.poziom}</span>
                {w.proporcjaKohortowaPct != null && (
                  <span className="mono text-grunt-text-faint2">· {w.proporcjaKohortowaPct}% kohorty</span>
                )}
              </div>
            )}
            <div className="mt-3">
              <WskaznikPewnosci pewnosc={w.pewnosc} />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mt-2">{natura}</div>
          </div>
          {/* Nieoznaczona: pierścień pusty (bez ostrej liczby przy nieznanej podstawie). */}
          <Gauge wartosc={w.score} kolor={KOLOR_HEX[w.werdykt]} nieoznaczony={w.nieoznaczony} />
        </div>
        {/* Drivery: kwalifikujący + komentarz + flagi */}
        <div className="mt-5 pt-4 border-t border-grunt-divider-row flex flex-col gap-2.5">
          <DriverRow ton="info" txt={`${spol ? "Kwalifikujący (segment S)" : "Kwalifikujący (segment K)"}: ${w.liczbaKwalifikujacych == null ? "brak danych" : `${liczba(w.liczbaKwalifikujacych)} os.`}`} />
          {w.komentarz && <DriverRow ton="info" txt={w.komentarz} />}
          {w.flagi.map((f, i) => (
            <DriverRow key={i} ton="warn" txt={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Wiersz drivera (kierunek wizualny §6): okrągła ikona semantyczna 20px + tekst 13.5px. */
function DriverRow({ ton, txt }: { ton: "plus" | "warn" | "info"; txt: string }) {
  const bg = ton === "plus" ? "bg-grunt-green" : ton === "warn" ? "bg-grunt-amber" : "bg-grunt-border-input";
  const ico = ton === "plus" ? "✓" : ton === "warn" ? "!" : "—";
  return (
    <div className="flex gap-2.5 items-start">
      <span className={`grid place-items-center shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-bold ${bg}`}>{ico}</span>
      <span className="text-[13.5px] text-grunt-text-3 leading-snug">{txt}</span>
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
