import Link from "next/link";
import { GruntMap } from "@/components/GruntMap";

/**
 * Publiczna strona startowa (landing) — wg „GRUNT — wytyczne: strona startowa".
 * Renderuje się bez chrome aplikacji (root layout). Wszystkie CTA prowadzą do /nowa.
 * Jedyne „dane" to poglądowa karta-zajawka w hero; reszta to treść marketingowa.
 */
const APP_URL = "/nowa";

const HERO_STATY = [
  { num: "3", label: "poziomy analizy" },
  { num: "6+", label: "rejestrów publicznych" },
  { num: "2027", label: "gotowe na nowy reżim" },
];

const KONTEKST = [
  { mark: "▦", title: "Biała plama planistyczna", body: "Większość działek nie ma MPZP. GRUNT liczy obwiednię z sąsiedztwa i flaguje niepewność." },
  { mark: "⇄", title: "Okno przejściowe 2027–2028", body: "Dwa reżimy finansowania się nakładają. Pokazujemy oba scenariusze, nie wybieramy za Ciebie." },
  { mark: "≡", title: "Złożony montaż", body: "Grant, kredyt BGK, partycypacja, aport — składane automatycznie pod typ podmiotu i zasobu." },
];

const POZIOMY = [
  {
    n: "1", kicker: "Szybki przesiew", title: "Czy warto się zająć", badgeBg: "var(--grunt-young-bg)", badgeFg: "var(--grunt-young)", wyroz: false,
    body: "Sam numer działki. W minutę: werdykt dla obu profili, pewność wstępna i flagi ryzyka.",
    punkty: ["Werdykt „nadaje się / warunkowo”", "Pewność i flagi (MPZP, środowisko)", "Wynik nawet przy brakach danych"],
  },
  {
    n: "2", kicker: "Ocena profesjonalna", title: "Pełny obraz działki", badgeBg: "var(--grunt-ink)", badgeFg: "#fff", wyroz: true,
    body: "Mapa z warstwami, planistyka, uzbrojenie, środowisko i rynek — z możliwością korekty danych i podniesienia pewności.",
    punkty: ["Warstwy: izochrony, Natura 2000, MPZP", "Tryby pól i prowenancja źródeł", "Warianty modelu zabudowy"],
  },
  {
    n: "3", kicker: "Model finansowy", title: "Czy się spina", badgeBg: "var(--grunt-senior-bg)", badgeFg: "var(--grunt-senior)", wyroz: false,
    body: "Po ankiecie finansowej: montaż, oś czasu, DSCR, czynsz wynikowy i wymagana dotacja — z porównaniem reżimów.",
    punkty: ["Składany montaż pod podmiot", "Domknięcie DSCR i suwaki wrażliwości", "Porównanie reżimu obecnego i 2027+"],
  },
];

const ZASADY = [
  { mark: "%", markBg: "var(--grunt-ink)", markFg: "#fff", mono: true, title: "Jawna pewność", body: "Każdy wynik ma pokazaną pewność — kropki i procent. Brak danej nie blokuje analizy, tylko obniża pewność." },
  { mark: "↳", markBg: "var(--grunt-young-bg)", markFg: "var(--grunt-young)", mono: false, title: "Prowenancja danych", body: "Wartość mówi, skąd pochodzi i czy była korygowana ręcznie. Zmiany są odwracalne, ślad audytowy zostaje." },
  { mark: "tbc", markBg: "var(--grunt-amber-bg)", markFg: "var(--grunt-amber-text)", mono: true, title: "Uczciwa niepewność", body: "Parametry przyszłego reżimu oznaczamy flagą „tbc”. Nie udajemy pewności tam, gdzie prawo dopiero powstaje." },
];

const ZRODLA = [
  { tag: "ULDK", label: "Geometria i powierzchnia działki", ostrzez: false },
  { tag: "GUS", label: "Demografia gminy i okolicy (BDL)", ostrzez: false },
  { tag: "GDOŚ", label: "Formy ochrony przyrody", ostrzez: false },
  { tag: "OSM", label: "Usługi i izochrony dojścia", ostrzez: false },
  { tag: "MPZP", label: "Plan / studium — z flagą białej plamy", ostrzez: true },
  { tag: "RCiWN", label: "Rejestr cen i wartości nieruchomości", ostrzez: false },
];

const PROFILE = [
  { name: "Młodzi", color: "var(--grunt-young)", bg: "var(--grunt-young-bg)", body: "Priorytet: dojście do transportu, szkoły i żłobka, dostęp do usług. Mieszkania mniejsze, wyższa intensywność.", tags: ["Przystanek < 500 m", "Szkoła i żłobek", "Wyższa intensywność"] },
  { name: "Seniorzy", color: "var(--grunt-senior)", bg: "var(--grunt-senior-bg)", body: "Priorytet: przychodnia w zasięgu, łagodny teren, cisza i zieleń. Dostępność i bezpieczeństwo dojścia.", tags: ["Przychodnia < 500 m", "Łagodny spadek terenu", "Cisza i tereny zielone"] },
];

const FIN_PUNKTY = [
  "Ankieta dobiera reżim i instrumenty pod podmiot",
  "Walidacja uprawnień wg macierzy inwestor × zasób",
  "Grant, kredyt BGK, partycypacja, aport — złożone automatycznie",
];

const STOS = [
  { label: "Dotacja / grant", pct: 57, color: "var(--grunt-chart-1)" },
  { label: "Kredyt BGK", pct: 25, color: "var(--grunt-ink)" },
  { label: "Partycypacja", pct: 10, color: "var(--grunt-chart-4)" },
  { label: "Wkład JST / grunt", pct: 8, color: "var(--grunt-chart-6)" },
];

function ZnakMarki({ rozmiar = 32 }: { rozmiar?: number }) {
  return (
    <span className="relative shrink-0 rounded-lg" style={{ width: rozmiar, height: rozmiar, background: "var(--grunt-ink)" }}>
      <span className="absolute rounded-[2px]" style={{ inset: rozmiar * 0.25, border: "1.5px solid var(--grunt-mint)" }} />
      <span className="absolute rounded-full" style={{ width: 5, height: 5, background: "var(--grunt-mint)", top: rozmiar * 0.28, left: rozmiar * 0.28 }} />
    </span>
  );
}

function Eyebrow({ children, kolor = "var(--grunt-young)" }: { children: React.ReactNode; kolor?: string }) {
  return <div className="text-[12px] uppercase font-semibold mb-3" style={{ letterSpacing: ".1em", color: kolor }}>{children}</div>;
}

function H2({ children, mniej = false }: { children: React.ReactNode; mniej?: boolean }) {
  return <h2 className="m-0 font-semibold" style={{ fontSize: mniej ? 32 : 36, letterSpacing: "-.015em" }}>{children}</h2>;
}

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff", color: "var(--grunt-ink)" }}>
      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 border-b" style={{ background: "rgba(255,255,255,.86)", backdropFilter: "blur(10px)", borderColor: "var(--grunt-divider)" }}>
        <div className="mx-auto flex items-center gap-6 px-7" style={{ maxWidth: 1200, height: 66 }}>
          <a href="#top" className="flex items-center gap-2.5">
            <ZnakMarki />
            <span className="leading-none">
              <span className="block font-bold text-[17px]" style={{ letterSpacing: ".14em" }}>GRUNT</span>
              <span className="block text-[9px] uppercase mt-[3px]" style={{ letterSpacing: ".06em", color: "var(--grunt-text-faint)" }}>Studium potencjału działki</span>
            </span>
          </a>
          <nav className="hidden md:flex flex-1 items-center justify-center gap-7 text-[13.5px] font-medium" style={{ color: "var(--grunt-text-3)" }}>
            <a href="#jak" className="hover:text-grunt-ink">Jak to działa</a>
            <a href="#metoda" className="hover:text-grunt-ink">Metoda</a>
            <a href="#dane" className="hover:text-grunt-ink">Dane</a>
            <a href="#finanse" className="hover:text-grunt-ink">Finansowanie</a>
          </nav>
          <Link href={APP_URL} className="ml-auto md:ml-0 inline-flex items-center gap-2 rounded-input px-4 text-[13.5px] font-semibold text-white" style={{ height: 40, background: "var(--grunt-ink)" }}>
            Uruchom analizę <span className="opacity-75">→</span>
          </Link>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* ── HERO ── */}
        <section className="mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-[52px] items-center px-7" style={{ maxWidth: 1200, paddingTop: 64, paddingBottom: 40 }}>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-5" style={{ border: "1px solid var(--grunt-border)", background: "var(--grunt-surface-2)" }}>
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--grunt-green)" }} />
              <span className="text-[12px] font-medium" style={{ color: "var(--grunt-text-3)" }}>Dla samorządów i inwestorów mieszkalnictwa społecznego</span>
            </div>
            <h1 className="m-0 font-semibold" style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: "-.02em" }}>
              Oceń potencjał<br />inwestycyjny działki<br /><span style={{ color: "var(--grunt-young)" }}>w kilka minut</span>
            </h1>
            <p className="mt-[22px] max-w-[520px]" style={{ fontSize: 16.5, lineHeight: 1.55, color: "var(--grunt-text-muted)" }}>
              Od numeru ewidencyjnego do modelu finansowego. GRUNT łączy dane publiczne, planistykę i reżimy finansowania w jedno studium — z jawną pewnością każdego wyniku.
            </p>
            <div className="flex flex-wrap items-center gap-3.5 mt-7">
              <Link href={APP_URL} className="inline-flex items-center gap-2.5 rounded-xl px-6 font-semibold text-white" style={{ height: 52, fontSize: 15.5, background: "var(--grunt-ink)" }}>
                Rozpocznij analizę działki <span className="opacity-75">→</span>
              </Link>
              <a href="#jak" className="inline-flex items-center rounded-xl px-5 font-medium" style={{ height: 52, fontSize: 14.5, border: "1px solid var(--grunt-border-input)", color: "var(--grunt-text-2)" }}>
                Zobacz, jak działa
              </a>
            </div>
            <div className="flex gap-7 mt-8 pt-6" style={{ borderTop: "1px solid var(--grunt-divider)" }}>
              {HERO_STATY.map((s) => (
                <div key={s.label}>
                  <div className="mono font-semibold" style={{ fontSize: 24, letterSpacing: "-.01em" }}>{s.num}</div>
                  <div className="text-[12px] mt-[3px]" style={{ color: "var(--grunt-text-faint)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* karta-zajawka produktu */}
          <div className="relative">
            <div className="absolute rounded-3xl" style={{ inset: -14, background: "radial-gradient(circle at 70% 20%, var(--grunt-young-bg), transparent 60%)" }} />
            <div className="relative rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid var(--grunt-border)", boxShadow: "0 24px 60px rgba(20,38,63,.14)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--grunt-divider)" }}>
                <span className="mono text-[12px] font-medium">143019_2.0010 · 142/7+142/8</span>
                <span className="mono text-[11px] font-medium rounded-md px-2 py-1" style={{ background: "var(--grunt-green-bg)", color: "var(--grunt-green)" }}>0,87 ha</span>
              </div>
              <GruntMap mode="ok" view="level2" layers={{ parcel: true, env: true, iso_m: true }} height={300} />
              <div className="flex items-center gap-4 px-4 py-4" style={{ borderTop: "1px solid var(--grunt-divider)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-[11px] h-[11px] rounded-full" style={{ background: "var(--grunt-green)" }} />
                    <span className="text-[15px] font-semibold" style={{ color: "var(--grunt-green)" }}>Nadaje się · Młodzi</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10.5px] uppercase" style={{ letterSpacing: ".04em", color: "var(--grunt-text-faint2)" }}>Pewność</span>
                    <span className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className="w-[9px] h-[9px] rounded-full" style={{ background: i < 4 ? "var(--grunt-ink)" : "var(--grunt-border)" }} />
                      ))}
                    </span>
                    <span className="mono text-[12.5px] font-semibold">84%</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="mono font-semibold" style={{ fontSize: 38, lineHeight: 1 }}>78</span>
                  <span className="text-[14px]" style={{ color: "var(--grunt-text-faint2)" }}>/100</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── KONTEKST ── */}
        <section style={{ background: "var(--grunt-surface-2)", borderTop: "1px solid var(--grunt-divider)", borderBottom: "1px solid var(--grunt-divider)" }}>
          <div className="mx-auto grid md:grid-cols-3 gap-6 px-7 py-9" style={{ maxWidth: 1200 }}>
            {KONTEKST.map((c) => (
              <div key={c.title} className="flex gap-3.5 items-start">
                <span className="grid place-items-center shrink-0 rounded-lg text-[17px]" style={{ width: 38, height: 38, background: "#fff", border: "1px solid var(--grunt-border)", color: "var(--grunt-ink)" }}>{c.mark}</span>
                <div>
                  <div className="text-[14px] font-semibold mb-1">{c.title}</div>
                  <div className="text-[13px] leading-relaxed" style={{ color: "var(--grunt-text-muted2)" }}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── JAK TO DZIAŁA ── */}
        <section id="jak" className="mx-auto px-7" style={{ maxWidth: 1200, paddingTop: 80, paddingBottom: 20 }}>
          <div className="text-center mx-auto mb-12" style={{ maxWidth: 640 }}>
            <Eyebrow>Kaskada trzech poziomów</Eyebrow>
            <H2>Od szybkiego przesiewu<br />do modelu finansowego</H2>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: "var(--grunt-text-muted)" }}>Każdy poziom pogłębia analizę i odsłania nowe dane. Brak informacji nie zatrzymuje pracy — obniża jedynie pewność wyniku.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {POZIOMY.map((l) => (
              <div key={l.n} className="rounded-2xl p-6" style={{ background: "#fff", border: l.wyroz ? "1.5px solid var(--grunt-ink)" : "1px solid var(--grunt-border)", boxShadow: l.wyroz ? "var(--grunt-shadow-raised)" : "var(--grunt-shadow-card)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="grid place-items-center rounded-[10px] mono font-semibold text-[16px]" style={{ width: 40, height: 40, background: l.badgeBg, color: l.badgeFg }}>{l.n}</span>
                  <div>
                    <div className="text-[11px] uppercase font-semibold" style={{ letterSpacing: ".05em", color: "var(--grunt-text-faint2)" }}>{l.kicker}</div>
                    <div className="text-[17px] font-semibold mt-px">{l.title}</div>
                  </div>
                </div>
                <p className="m-0 mb-3.5 text-[13.5px] leading-relaxed" style={{ color: "var(--grunt-text-muted2)" }}>{l.body}</p>
                <div className="flex flex-col gap-2 pt-3.5" style={{ borderTop: "1px solid var(--grunt-divider-row)" }}>
                  {l.punkty.map((p, i) => (
                    <div key={i} className="flex gap-2.5 text-[12.5px] leading-snug" style={{ color: "var(--grunt-text-3)" }}>
                      <span className="shrink-0 font-bold" style={{ color: l.badgeFg === "#fff" ? "var(--grunt-ink)" : l.badgeFg }}>›</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── METODA / 3 IDEE ── */}
        <section id="metoda" className="mx-auto px-7" style={{ maxWidth: 1200, paddingTop: 80, paddingBottom: 20 }}>
          <div className="mb-12" style={{ maxWidth: 640 }}>
            <Eyebrow>Metoda, której można zaufać</Eyebrow>
            <H2>Trzy zasady w każdym wyniku</H2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {ZASADY.map((p) => (
              <div key={p.title} className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid var(--grunt-border)", boxShadow: "var(--grunt-shadow-card)" }}>
                <span className={`inline-flex items-center justify-center ${p.mono ? "mono" : ""}`} style={{ minWidth: 44, height: 44, padding: p.mark === "tbc" ? "0 12px" : 0, borderRadius: 11, background: p.markBg, color: p.markFg, fontSize: p.mark === "tbc" ? 14 : p.mono ? 19 : 22, fontWeight: p.mono ? 600 : 700 }}>{p.mark}</span>
                <div className="text-[18px] font-semibold mt-4 mb-2">{p.title}</div>
                <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: "var(--grunt-text-muted2)" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── DANE ── */}
        <section id="dane" style={{ background: "var(--grunt-surface-2)", borderTop: "1px solid var(--grunt-divider)", borderBottom: "1px solid var(--grunt-divider)", marginTop: 80 }}>
          <div className="mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-[52px] items-center px-7 py-16" style={{ maxWidth: 1200 }}>
            <div>
              <Eyebrow>Źródła danych</Eyebrow>
              <H2 mniej>Rejestry publiczne,<br />zebrane automatycznie</H2>
              <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--grunt-text-muted)" }}>Każda wartość w raporcie wskazuje swoje źródło i tryb — automatyczny, edytowalny albo ręczny. Wartość skorygowaną można cofnąć; ślad audytowy zostaje.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {ZRODLA.map((s) => (
                <div key={s.tag} className="flex items-center gap-3.5 rounded-xl px-4 py-3" style={{ background: "#fff", border: "1px solid var(--grunt-border)" }}>
                  <span className="mono text-[12px] font-semibold text-center rounded-md px-2 py-1" style={{ minWidth: 64, background: "var(--grunt-surface-3)", border: "1px solid var(--grunt-border-2)", color: "var(--grunt-ink)" }}>{s.tag}</span>
                  <span className="flex-1 text-[13.5px]" style={{ color: "var(--grunt-text-3)" }}>{s.label}</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: s.ostrzez ? "var(--grunt-amber)" : "var(--grunt-green)" }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROFILE ── */}
        <section className="mx-auto px-7" style={{ maxWidth: 1200, paddingTop: 80, paddingBottom: 20 }}>
          <div className="text-center mx-auto mb-12" style={{ maxWidth: 640 }}>
            <Eyebrow>Dwa profile odbiorców</Eyebrow>
            <H2>Ocena osobno dla każdej grupy</H2>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: "var(--grunt-text-muted)" }}>Ta sama działka bywa świetna dla jednych, a warunkowa dla drugich. Izochrony dojścia, usługi i dopasowanie liczymy oddzielnie.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PROFILE.map((p) => (
              <div key={p.name} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid var(--grunt-border)", boxShadow: "var(--grunt-shadow-card)" }}>
                <div className="flex items-center gap-3" style={{ background: p.bg, padding: "18px 22px" }}>
                  <span className="w-[13px] h-[13px] rounded-full" style={{ background: p.color }} />
                  <span className="text-[17px] font-semibold">{p.name}</span>
                </div>
                <div style={{ padding: "20px 22px" }}>
                  <p className="m-0 mb-3.5 text-[13.5px] leading-relaxed" style={{ color: "var(--grunt-text-muted2)" }}>{p.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span key={t} className="text-[12px] rounded-md" style={{ color: p.color, background: p.bg, border: `1px solid ${p.color}22`, padding: "5px 11px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINANSE ── */}
        <section id="finanse" className="mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-[52px] items-center px-7" style={{ maxWidth: 1200, paddingTop: 80, paddingBottom: 40 }}>
          <div>
            <Eyebrow kolor="var(--grunt-senior)">Model finansowy</Eyebrow>
            <H2 mniej>Czy inwestycja się spina</H2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--grunt-text-muted)", marginBottom: 22 }}>Ankieta finansowa dobiera reżim, instrumenty i montaż pod Twój podmiot i typ zasobu. Model liczy domknięcie (DSCR), czynsz wynikowy i wymaganą dotację — z porównaniem reżimu obecnego i przyszłego w oknie 2027–2028.</p>
            <div className="flex flex-col gap-2.5">
              {FIN_PUNKTY.map((f) => (
                <div key={f} className="flex gap-2.5 text-[13.5px] leading-snug" style={{ color: "var(--grunt-text-3)" }}>
                  <span className="shrink-0 font-bold" style={{ color: "var(--grunt-green)" }}>✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-[22px]" style={{ background: "#fff", border: "1px solid var(--grunt-border)", boxShadow: "0 8px 30px rgba(20,38,63,.08)" }}>
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[13px] font-semibold">Stos montażu finansowego</span>
              <span className="mono text-[13px] font-semibold">6,8 mln zł</span>
            </div>
            <div className="flex h-[30px] rounded-md overflow-hidden mb-4" style={{ gap: 2 }}>
              {STOS.map((s) => (
                <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, height: "100%" }} />
              ))}
            </div>
            {STOS.map((s) => (
              <div key={s.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--grunt-divider-row)" }}>
                <span className="flex items-center gap-2.5 text-[12.5px]" style={{ color: "var(--grunt-text-3)" }}>
                  <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: s.color }} />{s.label}
                </span>
                <span className="mono text-[12.5px] font-semibold">{s.pct}%</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 mt-4 rounded-[10px] px-3.5 py-3" style={{ background: "var(--grunt-green-bg)", border: "1px solid rgba(28,138,90,.2)" }}>
              <span className="w-[11px] h-[11px] rounded-full" style={{ background: "var(--grunt-green)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--grunt-green)" }}>Inwestycja się spina</span>
              <span className="flex-1" />
              <span className="mono text-[12px]" style={{ color: "var(--grunt-text-muted)" }}>DSCR 1,63</span>
            </div>
          </div>
        </section>

        {/* ── CTA KOŃCOWE ── */}
        <section className="mx-auto px-7" style={{ maxWidth: 1200, margin: "40px auto 72px" }}>
          <div className="relative overflow-hidden text-center" style={{ background: "var(--grunt-ink)", backgroundImage: "radial-gradient(circle at 85% 0%, var(--grunt-ink-2), var(--grunt-ink))", borderRadius: 20, padding: "56px 48px" }}>
            <h2 className="m-0 font-semibold text-white" style={{ fontSize: 34, letterSpacing: "-.015em" }}>Sprawdź swoją działkę</h2>
            <p className="mx-auto mt-3.5 text-[15.5px] leading-relaxed" style={{ color: "#A9BBD2", maxWidth: 520 }}>Wpisz numer ewidencyjny i przejdź przez pełną kaskadę — od przesiewu po model finansowy.</p>
            <Link href={APP_URL} className="inline-flex items-center gap-2.5 rounded-xl px-7 font-semibold mt-7" style={{ height: 54, fontSize: 16, background: "#fff", color: "var(--grunt-ink)" }}>
              Uruchom analizę działki <span className="opacity-70">→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* ── STOPKA ── */}
      <footer style={{ background: "#0F1B2E", color: "#A9BBD2", padding: "40px 28px" }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-6" style={{ maxWidth: 1200 }}>
          <div className="flex items-center gap-3">
            <span className="relative shrink-0 rounded-md" style={{ width: 28, height: 28, background: "#fff" }}>
              <span className="absolute rounded-[2px]" style={{ inset: 7, border: "1.5px solid var(--grunt-ink)" }} />
            </span>
            <div>
              <div className="font-bold text-[14px] text-white" style={{ letterSpacing: ".14em" }}>GRUNT</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--grunt-text-muted2)" }}>Studium potencjału inwestycyjnego działki</div>
            </div>
          </div>
          <div className="flex gap-6 text-[13px]">
            <a href="#jak" className="hover:text-white">Jak to działa</a>
            <a href="#metoda" className="hover:text-white">Metoda</a>
            <a href="#dane" className="hover:text-white">Dane</a>
            <Link href={APP_URL} className="text-white font-semibold">Uruchom analizę →</Link>
          </div>
        </div>
        <div className="mx-auto mt-6 pt-5 text-[11.5px]" style={{ maxWidth: 1200, borderTop: "1px solid #ffffff14", color: "var(--grunt-text-muted)" }}>
          Prototyp warstwy wizualnej. Dane przykładowe. Parametry przyszłego reżimu finansowania oznaczone „tbc” są wstępne.
        </div>
      </footer>
    </div>
  );
}
