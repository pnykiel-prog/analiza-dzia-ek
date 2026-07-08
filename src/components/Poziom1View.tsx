import type { KluczWerdyktu, WerdyktP1, Werdykt, WynikPoziom1 } from "@/lib/types";
import { Karta, Statystyka } from "./ui";
import { WskaznikPewnosci } from "./grunt";
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
 * Widok Poziomu 1 (wersja pełna): SIATKA 4 WERDYKTÓW dwóch natur —
 * społeczne (ocena projektu vs pojemność) i komunalne (skala potrzeby w gminie
 * per mieszkaniec). Plus atrakcyjność migracyjna i kwalifikacje dochodowe.
 * Prognoza pojemności (PUM/kondygnacje/liczba mieszkań) NIE jest pokazywana na M1 —
 * orientacyjny model bywał zbyt nietrafiony; pojemność wyznacza Poziom 2.
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
          Społeczne — ocena projektu na działce (wystarczalność vs pojemność)
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <KartaWerdyktu w={w.spolecznyMlodzi} rekomendowany={ocena.rekomendowanyKierunek === "spolecznyMlodzi"} />
          <KartaWerdyktu w={w.spolecznySeniorzy} rekomendowany={ocena.rekomendowanyKierunek === "spolecznySeniorzy"} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-grunt-text-faint mb-2">
          Komunalne — skala potrzeby w gminie (per mieszkaniec vs mediana regionalna)
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <KartaWerdyktu w={w.komunalnyMlodzi} rekomendowany={ocena.rekomendowanyKierunek === "komunalnyMlodzi"} />
          <KartaWerdyktu w={w.komunalnySeniorzy} rekomendowany={ocena.rekomendowanyKierunek === "komunalnySeniorzy"} />
        </div>
      </div>

      {/* Atrakcyjność migracyjna (zastępuje popyt zewnętrzny) */}
      <Karta
        tytul="Atrakcyjność migracyjna"
        podtytul="A1 zmierzone (napływ) jest bramką dla A2/A3 estymowanych — zasila werdykty społeczne"
        prawy={<span className="badge bg-grunt-surface-3 text-grunt-text-muted">pewność {ocena.atrakcyjnoscMigracyjna.pewnosc}%</span>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Statystyka etykieta="A1 · napływ (zmierz.)" wartosc={`${ocena.atrakcyjnoscMigracyjna.a1}/100`} />
          <Statystyka etykieta="A2 · odblok. (estym.)" wartosc={`${ocena.atrakcyjnoscMigracyjna.a2}/100`} />
          <Statystyka etykieta="A3 · zatrzym. (estym.)" wartosc={`${ocena.atrakcyjnoscMigracyjna.a3}/100`} />
          <Statystyka etykieta="Łącznie" wartosc={`${ocena.atrakcyjnoscMigracyjna.wartosc}/100`} akcent />
        </div>
        {ocena.atrakcyjnoscMigracyjna.fallback && (
          <p className="text-[11px] text-grunt-amber-text2 mt-2">A1 z proxy salda migracji (brak napływu brutto) — obniżona pewność.</p>
        )}
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

function KartaWerdyktu({ w, rekomendowany }: { w: WerdyktP1; rekomendowany: boolean }) {
  const spol = w.natura === "spoleczny";
  const tint = spol ? "bg-grunt-young-bg" : "bg-grunt-senior-bg";
  const natura = spol ? "ocena projektu (vs pojemność)" : "skala potrzeby (per mieszk.)";
  return (
    <div className={`relative rounded-card border overflow-hidden ${rekomendowany ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${tint}`}>
        <span className="text-[13px] font-semibold text-grunt-text">{ETYK_WERDYKT[w.klucz]}</span>
        {rekomendowany && <span className="badge bg-grunt-ink text-white text-[10px]">★ REKOMENDOWANY</span>}
      </div>
      <div className="p-4">
        <div className="flex items-end justify-between">
          <span className={`flex items-center gap-2 text-[20px] font-semibold ${KOLOR_STATUSU[w.werdykt]}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${KROPKA[w.werdykt]}`} />
            {statusSlowny[w.werdykt]}
          </span>
          <span className="mono text-[34px] font-semibold leading-none text-grunt-text">
            {w.score}
            <span className="text-[14px] text-grunt-text-faint2">/100</span>
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-grunt-text-faint mt-1">{natura}</div>
        <div className="mt-3"><WskaznikPewnosci pewnosc={w.pewnosc} /></div>
        <div className="grid grid-cols-1 gap-2 mt-3 text-[11px]">
          <MiniStat e={spol ? "Kwalifikujący (segment S)" : "Kwalifikujący (segment K)"} v={w.liczbaKwalifikujacych == null ? "brak danych" : `${liczba(w.liczbaKwalifikujacych)} os.`} />
        </div>
        <p className="text-[12px] text-grunt-text-muted mt-3">{w.komentarz}</p>
        {w.flagi.length > 0 && (
          <ul className="mt-2 space-y-1">
            {w.flagi.map((f, i) => (
              <li key={i} className="text-[11px] text-grunt-amber-text bg-grunt-amber-bg border border-grunt-amber/25 rounded px-2 py-1">⚑ {f}</li>
            ))}
          </ul>
        )}
      </div>
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
