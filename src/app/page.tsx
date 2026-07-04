import Link from "next/link";
import { GruntMap } from "@/components/GruntMap";

/**
 * Strona startowa (landing) GRUNT — publiczna strona marketingowa wg
 * `GRUNT-strona-startowa-wytyczne.md`. NIE jest ekranem aplikacji: brak chrome
 * (paska poziomów/steppera). Wszystkie CTA prowadzą do aplikacji (`APP_URL`).
 * Jedyne miejsce z „danymi" to karta-zajawka w hero (poglądowa wizualizacja).
 */
const APP_URL = "/nowa";
const MAXW = "1200px";
const PADX = "28px";

export default function LandingPage() {
  return (
    <div className="bg-white text-grunt-text">
      <Nawigacja />
      <Hero />
      <PasKontekstu />
      <JakToDziala />
      <Metoda />
      <Dane />
      <Profile />
      <Finansowanie />
      <CtaKoncowe />
      <Stopka />
    </div>
  );
}

// ── 1. Nawigacja (sticky) ────────────────────────────────────────────────────
function Nawigacja() {
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ height: 66, background: "rgba(255,255,255,.86)", backdropFilter: "blur(10px)", borderColor: "#EEF1F5" }}
    >
      <div className="mx-auto h-full flex items-center justify-between gap-6" style={{ maxWidth: MAXW, paddingInline: PADX }}>
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-[13.5px]" style={{ color: "#3A4D6B" }}>
          <a href="#jak" className="hover:text-grunt-ink">Jak to działa</a>
          <a href="#metoda" className="hover:text-grunt-ink">Metoda</a>
          <a href="#dane" className="hover:text-grunt-ink">Dane</a>
          <a href="#finanse" className="hover:text-grunt-ink">Finansowanie</a>
        </nav>
        <Link href={APP_URL} className="inline-flex items-center gap-2 rounded-[9px] bg-grunt-ink text-white text-[13.5px] font-semibold px-4" style={{ height: 40 }}>
          Uruchom analizę <span aria-hidden>→</span>
        </Link>
      </div>
    </header>
  );
}

function Logo({ ciemne = false }: { ciemne?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <span className={`relative grid place-items-center w-[34px] h-[34px] rounded-md ${ciemne ? "bg-white/10" : "bg-grunt-ink"}`}>
        <span className="block w-3 h-3 rounded-[3px] bg-grunt-mint" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={`text-[17px] font-bold ${ciemne ? "text-white" : "text-grunt-ink"}`} style={{ letterSpacing: "0.10em" }}>GRUNT</span>
        <span className={`text-[9.5px] uppercase mt-0.5 ${ciemne ? "text-white/55" : "text-grunt-text-faint2"}`} style={{ letterSpacing: "0.11em" }}>
          Studium potencjału działki
        </span>
      </span>
    </Link>
  );
}

// ── 2. Hero ──────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <Sekcja>
      <div className="grid items-center lg:grid-cols-[1.05fr_1fr] gap-[52px]" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "#DDE3EB", color: "#3A4D6B" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#1C8A5A" }} />
            Dla samorządów i inwestorów mieszkalnictwa społecznego
          </span>
          <h1 className="mt-6 font-semibold text-grunt-ink" style={{ fontSize: 52, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
            Oceń potencjał<br />inwestycyjny<br />działki<br />
            <span style={{ color: "#0E7C8B" }}>w kilka minut</span>
          </h1>
          <p className="mt-6 max-w-[440px] text-[16.5px] leading-relaxed" style={{ color: "#5C6B82" }}>
            Od numeru ewidencyjnego do modelu finansowego. GRUNT łączy dane publiczne, planistykę i reżimy
            finansowania w jedno studium — z jawną pewnością każdego wyniku.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={APP_URL} className="inline-flex items-center justify-between gap-8 rounded-[10px] bg-grunt-ink text-white text-[14.5px] font-semibold px-5" style={{ height: 52 }}>
              Rozpocznij analizę działki <span aria-hidden>→</span>
            </Link>
            <a href="#jak" className="inline-flex items-center rounded-[10px] border text-[14.5px] font-medium px-5" style={{ height: 52, borderColor: "#C7D0DC", color: "#2A3F5F" }}>
              Zobacz, jak działa
            </a>
          </div>
          <div className="mt-9 grid grid-cols-3 gap-6 border-t pt-5 max-w-[440px]" style={{ borderColor: "#EEF1F5" }}>
            <MiniStat liczba="3" opis="poziomy analizy" />
            <MiniStat liczba="6+" opis="rejestrów publicznych" />
            <MiniStat liczba="2027" opis="gotowe na nowy reżim" />
          </div>
        </div>
        <KartaZajawka />
      </div>
    </Sekcja>
  );
}

function MiniStat({ liczba, opis }: { liczba: string; opis: string }) {
  return (
    <div>
      <div className="mono font-semibold text-grunt-ink" style={{ fontSize: 24 }}>{liczba}</div>
      <div className="text-[12px] mt-0.5" style={{ color: "#6B7A92" }}>{opis}</div>
    </div>
  );
}

function KartaZajawka() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10" style={{ background: "radial-gradient(60% 55% at 55% 40%, #E0F0F2 0%, rgba(224,240,242,0) 70%)" }} />
      <div className="rounded-[16px] bg-white border overflow-hidden" style={{ borderColor: "#E2E6EC", boxShadow: "0 24px 60px rgba(20,38,63,.14)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#EEF1F5" }}>
          <span className="mono text-[12.5px] text-grunt-text-2">143019_2.0010 · 142/7+142/8</span>
          <span className="rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium mono" style={{ background: "#E4F3EB", color: "#1C8A5A" }}>0,87 ha</span>
        </div>
        <div style={{ height: 250 }}>
          <GruntMap mode="ok" view="level2" layers={{ parcel: true, env: true, iso_m: true }} fill />
        </div>
        <div className="flex items-end justify-between px-4 py-3.5 border-t" style={{ borderColor: "#EEF1F5" }}>
          <div>
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-grunt-text">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1C8A5A" }} />
              Nadaje się · Młodzi
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "#6B7A92" }}>
              <span className="uppercase tracking-wide">Pewność</span>
              <Kropki wypelnione={4} wszystkie={5} />
              <span className="mono">84%</span>
            </div>
          </div>
          <div className="mono font-semibold leading-none text-grunt-ink" style={{ fontSize: 40 }}>
            78<span className="text-[15px]" style={{ color: "#9AA7BA" }}>/100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kropki({ wypelnione, wszystkie }: { wypelnione: number; wszystkie: number }) {
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: wszystkie }).map((_, i) => (
        <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < wypelnione ? "#16263F" : "#D6DCE5" }} />
      ))}
    </span>
  );
}

// ── 3. Pas kontekstu ─────────────────────────────────────────────────────────
const KONTEKST = [
  { ikona: "plan", tytul: "Biała plama planistyczna", opis: "Większość działek nie ma MPZP. GRUNT liczy obwiednię z sąsiedztwa i flaguje niepewność." },
  { ikona: "okno", tytul: "Okno przejściowe 2027–2028", opis: "Dwa reżimy finansowania się nakładają. Pokazujemy oba scenariusze, nie wybieramy za Ciebie." },
  { ikona: "montaz", tytul: "Złożony montaż", opis: "Grant, kredyt BGK, partycypacja, aport — składane automatycznie pod typ podmiotu i zasobu." },
];

function PasKontekstu() {
  return (
    <div className="border-y" style={{ background: "#FAFBFC", borderColor: "#EEF1F5" }}>
      <Sekcja>
        <div className="grid md:grid-cols-3 gap-8 py-12">
          {KONTEKST.map((k) => (
            <div key={k.tytul} className="flex gap-3.5">
              <IkonaKafelek rodzaj={k.ikona} />
              <div>
                <h3 className="text-[15px] font-semibold text-grunt-text">{k.tytul}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#5C6B82" }}>{k.opis}</p>
              </div>
            </div>
          ))}
        </div>
      </Sekcja>
    </div>
  );
}

function IkonaKafelek({ rodzaj }: { rodzaj: string }) {
  const sciezka: Record<string, React.ReactNode> = {
    plan: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>,
    okno: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>,
    montaz: <><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /><rect x="8.5" y="4" width="7" height="7" rx="1" /></>,
  };
  return (
    <span className="grid place-items-center shrink-0 w-9 h-9 rounded-[9px]" style={{ background: "#EEF3F8" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3A4D6B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {sciezka[rodzaj]}
      </svg>
    </span>
  );
}

// ── 4. Jak to działa ─────────────────────────────────────────────────────────
const POZIOMY = [
  {
    nr: "1", eyebrow: "Szybki przesiew", tytul: "Czy warto się zająć", tint: "#E0F0F2", tekstNr: "#0E7C8B", wyroznik: false,
    opis: "Sam numer działki. W minutę: werdykt dla obu profili, pewność wstępna i flagi ryzyka.",
    punkty: ["Werdykt „nadaje się / warunkowo”", "Pewność i flagi (MPZP, środowisko)", "Wynik nawet przy brakach danych"],
  },
  {
    nr: "2", eyebrow: "Ocena profesjonalna", tytul: "Pełny obraz działki", tint: "#16263F", tekstNr: "#FFFFFF", wyroznik: true,
    opis: "Mapa z warstwami, planistyka, uzbrojenie, środowisko i rynek — z możliwością korekty danych i podniesienia pewności.",
    punkty: ["Warstwy: izochrony, Natura 2000, MPZP", "Tryby pól i prowenancja źródeł", "Warianty modelu zabudowy"],
  },
  {
    nr: "3", eyebrow: "Model finansowy", tytul: "Czy się spina", tint: "#F0E8F2", tekstNr: "#7A4A86", wyroznik: false,
    opis: "Po ankiecie finansowej: montaż, oś czasu, DSCR, czynsz wynikowy i wymagana dotacja — z porównaniem reżimów.",
    punkty: ["Składany montaż pod podmiot", "Domknięcie DSCR i suwaki wrażliwości", "Porównanie reżimu obecnego i 2027+"],
  },
];

function JakToDziala() {
  return (
    <Sekcja id="jak">
      <div className="py-16">
        <Naglowek eyebrow="Kaskada trzech poziomów" tytul={<>Od szybkiego przesiewu<br />do modelu finansowego</>} />
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {POZIOMY.map((p) => (
            <div
              key={p.nr}
              className="rounded-[14px] bg-white p-6 flex flex-col"
              style={p.wyroznik
                ? { border: "1.5px solid #16263F", boxShadow: "0 6px 22px rgba(20,38,63,.10)" }
                : { border: "1px solid #E2E6EC" }}
            >
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-[10px] mono font-semibold text-[15px]" style={{ background: p.tint, color: p.tekstNr }}>{p.nr}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8E9BAE" }}>{p.eyebrow}</span>
              </div>
              <h3 className="mt-3 text-[18px] font-semibold text-grunt-text">{p.tytul}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "#5C6B82" }}>{p.opis}</p>
              <ul className="mt-4 pt-4 space-y-2 border-t" style={{ borderColor: "#EEF1F5" }}>
                {p.punkty.map((t) => (
                  <li key={t} className="flex gap-2 text-[13px]" style={{ color: "#3A4D6B" }}>
                    <span style={{ color: "#0E7C8B" }}>›</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Sekcja>
  );
}

// ── 5. Metoda / 3 idee ───────────────────────────────────────────────────────
const IDEE = [
  { znak: "%", kolorZnak: "#16263F", tloZnak: "#EEF3F8", tytul: "Jawna pewność", opis: "Każdy wynik ma pokazaną pewność — kropki i procent. Brak danej nie blokuje analizy, tylko obniża pewność." },
  { znak: "↳", kolorZnak: "#0E7C8B", tloZnak: "#E0F0F2", tytul: "Prowenancja danych", opis: "Wartość mówi, skąd pochodzi i czy była korygowana ręcznie. Zmiany są odwracalne, ślad audytowy zostaje." },
  { znak: "tbc", kolorZnak: "#8A5C08", tloZnak: "#FBF0DA", tytul: "Uczciwa niepewność", opis: "Parametry przyszłego reżimu oznaczamy flagą „tbc”. Nie udajemy pewności tam, gdzie prawo dopiero powstaje." },
];

function Metoda() {
  return (
    <Sekcja id="metoda">
      <div className="py-16">
        <Naglowek eyebrow="Metoda, której można zaufać" tytul="Trzy zasady w każdym wyniku" wyrownanie="left" />
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {IDEE.map((i) => (
            <div key={i.tytul} className="rounded-[14px] bg-white p-6" style={{ border: "1px solid #E2E6EC" }}>
              <span className="grid place-items-center w-11 h-11 rounded-[10px] mono font-semibold text-[15px]" style={{ background: i.tloZnak, color: i.kolorZnak }}>{i.znak}</span>
              <h3 className="mt-4 text-[18px] font-semibold text-grunt-text">{i.tytul}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "#5C6B82" }}>{i.opis}</p>
            </div>
          ))}
        </div>
      </div>
    </Sekcja>
  );
}

// ── 6. Dane ──────────────────────────────────────────────────────────────────
const ZRODLA = [
  { tag: "ULDK", opis: "Geometria i powierzchnia działki", status: "ok" },
  { tag: "GUS", opis: "Demografia gminy i okolicy (BDL)", status: "ok" },
  { tag: "GDOŚ", opis: "Formy ochrony przyrody", status: "ok" },
  { tag: "OSM", opis: "Dojścia, przystanki i usługi (izochrony)", status: "ok" },
  { tag: "MPZP", opis: "Przeznaczenie i wskaźniki z planu", status: "amber" },
  { tag: "RCiWN", opis: "Rejestr cen i wartości nieruchomości", status: "ok" },
];

function Dane() {
  return (
    <div className="border-y" style={{ background: "#FAFBFC", borderColor: "#EEF1F5" }} id="dane">
      <Sekcja>
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center py-16">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#0E7C8B" }}>Źródła danych</div>
            <h2 className="mt-3 font-semibold text-grunt-ink" style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Rejestry publiczne,<br />zebrane automatycznie
            </h2>
          </div>
          <div className="space-y-3">
            {ZRODLA.map((z) => (
              <div key={z.tag} className="flex items-center gap-4 rounded-[11px] bg-white px-4 py-3" style={{ border: "1px solid #E2E6EC" }}>
                <span className="mono text-[12px] font-semibold px-2 py-1 rounded-[5px] shrink-0" style={{ background: "#F4F6F9", color: "#2A3F5F", minWidth: 56, textAlign: "center" }}>{z.tag}</span>
                <span className="flex-1 text-[13.5px]" style={{ color: "#3A4D6B" }}>{z.opis}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: z.status === "amber" ? "#B5790B" : "#1C8A5A" }} />
              </div>
            ))}
          </div>
        </div>
      </Sekcja>
    </div>
  );
}

// ── 7. Profile ───────────────────────────────────────────────────────────────
const PROFILE = [
  {
    nazwa: "Młodzi", kropka: "#0E7C8B", tlo: "#E0F0F2",
    opis: "Priorytet: dojście do transportu, szkoły i żłobka, dostęp do usług. Mieszkania mniejsze, wyższa intensywność.",
    chipy: ["Przystanek < 800 m", "Szkoła i żłobek", "Wyższa intensywność"],
  },
  {
    nazwa: "Seniorzy", kropka: "#7A4A86", tlo: "#F0E8F2",
    opis: "Priorytet: przychodnia w zasięgu, łagodny teren, cisza i zieleń. Dostępność i bezpieczeństwo dojścia.",
    chipy: ["Przychodnia < 800 m", "Łagodny teren", "Cisza i zieleń"],
  },
];

function Profile() {
  return (
    <Sekcja>
      <div className="py-16">
        <Naglowek
          eyebrow="Dwa profile odbiorców"
          tytul="Ocena osobno dla każdej grupy"
          podtytul="Ta sama działka bywa świetna dla jednych, a warunkowa dla drugich. Izochrony dojścia, usługi i dopasowanie liczymy oddzielnie."
        />
        <div className="mt-10 grid md:grid-cols-2 gap-5">
          {PROFILE.map((p) => (
            <div key={p.nazwa} className="rounded-[14px] overflow-hidden bg-white" style={{ border: "1px solid #E2E6EC" }}>
              <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ background: p.tlo }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.kropka }} />
                <span className="text-[16px] font-semibold text-grunt-text">{p.nazwa}</span>
              </div>
              <div className="px-5 py-4">
                <p className="text-[13.5px] leading-relaxed" style={{ color: "#5C6B82" }}>{p.opis}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.chipy.map((c) => (
                    <span key={c} className="text-[12px] px-2.5 py-1 rounded-[6px]" style={{ background: "#F4F6F9", color: "#3A4D6B" }}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sekcja>
  );
}

// ── 8. Finansowanie ──────────────────────────────────────────────────────────
const MONTAZ = [
  { etyk: "Dotacja / grant", pct: 57, kolor: "#2A6FA8" },
  { etyk: "Kredyt BGK", pct: 25, kolor: "#16263F" },
  { etyk: "Partycypacja", pct: 10, kolor: "#6E8BB0" },
  { etyk: "Wkład JST / grant", pct: 8, kolor: "#9DB1CE" },
];

function Finansowanie() {
  return (
    <Sekcja id="finanse">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center py-16">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#7A4A86" }}>Model finansowy</div>
          <h2 className="mt-3 font-semibold text-grunt-ink" style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em" }}>Czy inwestycja się spina</h2>
          <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed" style={{ color: "#5C6B82" }}>
            Ankieta finansowa dobiera reżim, instrumenty i montaż pod Twój podmiot i typ zasobu. Model liczy
            domknięcie (DSCR), czynsz wynikowy i wymaganą dotację — z porównaniem reżimu obecnego i przyszłego
            w oknie 2027–2028.
          </p>
          <ul className="mt-5 space-y-2.5">
            {["Ankieta dobiera reżim i instrumenty pod podmiot", "Walidacja uprawnień wg macierzy inwestor × zasób", "Grant, kredyt BGK, partycypacja, aport — złożone automatycznie"].map((t) => (
              <li key={t} className="flex gap-2.5 text-[14px]" style={{ color: "#3A4D6B" }}>
                <span style={{ color: "#1C8A5A" }}>✓</span>{t}
              </li>
            ))}
          </ul>
        </div>
        <KartaMontazu />
      </div>
    </Sekcja>
  );
}

function KartaMontazu() {
  return (
    <div className="rounded-[16px] bg-white p-5" style={{ border: "1px solid #E2E6EC", boxShadow: "0 6px 22px rgba(20,38,63,.08)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-grunt-text">Stos montażu finansowego</span>
        <span className="mono text-[13px] text-grunt-text-2">6,8 mln zł</span>
      </div>
      <div className="mt-4 flex h-9 rounded-[7px] overflow-hidden">
        {MONTAZ.map((m) => (
          <div key={m.etyk} style={{ width: `${m.pct}%`, background: m.kolor }} />
        ))}
      </div>
      <div className="mt-4 space-y-0">
        {MONTAZ.map((m, i) => (
          <div key={m.etyk} className={`flex items-center justify-between py-2 text-[13px] ${i < MONTAZ.length - 1 ? "border-b" : ""}`} style={{ borderColor: "#F2F4F7" }}>
            <span className="flex items-center gap-2.5" style={{ color: "#3A4D6B" }}>
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: m.kolor }} />
              {m.etyk}
            </span>
            <span className="mono font-medium text-grunt-text">{m.pct}%</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[10px] px-4 py-3" style={{ background: "#E4F3EB" }}>
        <span className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: "#1C8A5A" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1C8A5A" }} />
          Inwestycja się spina
        </span>
        <span className="mono text-[12.5px]" style={{ color: "#3A4D6B" }}>DSCR 1,63</span>
      </div>
    </div>
  );
}

// ── 9. CTA końcowe ───────────────────────────────────────────────────────────
function CtaKoncowe() {
  return (
    <Sekcja>
      <div className="my-16 relative overflow-hidden rounded-[20px] px-8 py-16 text-center" style={{ background: "#16263F" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(50% 90% at 50% 0%, rgba(111,227,196,.14) 0%, rgba(22,38,63,0) 70%)" }} />
        <div className="relative">
          <h2 className="font-semibold text-white" style={{ fontSize: 34, letterSpacing: "-0.01em" }}>Sprawdź swoją działkę</h2>
          <p className="mt-3 mx-auto max-w-[520px] text-[15px] leading-relaxed" style={{ color: "#A9BBD2" }}>
            Wpisz numer ewidencyjny i przejdź przez pełną kaskadę — od przesiewu po model finansowy.
          </p>
          <Link href={APP_URL} className="mt-7 inline-flex items-center gap-2 rounded-[10px] bg-white text-grunt-ink text-[14.5px] font-semibold px-6" style={{ height: 52 }}>
            Uruchom analizę działki <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </Sekcja>
  );
}

// ── 10. Stopka ───────────────────────────────────────────────────────────────
function Stopka() {
  return (
    <footer style={{ background: "#0F1B2E" }}>
      <div className="mx-auto py-10" style={{ maxWidth: MAXW, paddingInline: PADX }}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Logo ciemne />
          <nav className="flex flex-wrap items-center gap-6 text-[13.5px]" style={{ color: "#A9BBD2" }}>
            <a href="#jak" className="hover:text-white">Jak to działa</a>
            <a href="#metoda" className="hover:text-white">Metoda</a>
            <a href="#dane" className="hover:text-white">Dane</a>
            <Link href={APP_URL} className="font-semibold text-white">Uruchom analizę →</Link>
          </nav>
        </div>
        <div className="mt-8 pt-6 text-[12px]" style={{ borderTop: "1px solid #ffffff14", color: "#6B7A92" }}>
          Prototyp warstwy wizualnej. Dane przykładowe. Parametry przyszłego reżimu finansowania oznaczone „tbc” są wstępne.
        </div>
      </div>
    </footer>
  );
}

// ── Wspólne ──────────────────────────────────────────────────────────────────
function Sekcja({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto" style={{ maxWidth: MAXW, paddingInline: PADX, scrollMarginTop: 80 }}>
      {children}
    </section>
  );
}

function Naglowek({
  eyebrow, tytul, podtytul, wyrownanie = "center",
}: { eyebrow: string; tytul: React.ReactNode; podtytul?: string; wyrownanie?: "center" | "left" }) {
  const srodek = wyrownanie === "center";
  return (
    <div className={srodek ? "text-center" : "text-left"}>
      <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#0E7C8B" }}>{eyebrow}</div>
      <h2 className={`mt-3 font-semibold text-grunt-ink ${srodek ? "mx-auto" : ""}`} style={{ fontSize: 36, lineHeight: 1.12, letterSpacing: "-0.01em" }}>{tytul}</h2>
      {podtytul && <p className={`mt-4 text-[15px] leading-relaxed ${srodek ? "mx-auto max-w-[560px]" : "max-w-[560px]"}`} style={{ color: "#5C6B82" }}>{podtytul}</p>}
    </div>
  );
}
