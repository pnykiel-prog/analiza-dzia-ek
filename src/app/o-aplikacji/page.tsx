import { Karta } from "@/components/ui";

export default function OAplikacji() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5">
        <h1 className="text-xl font-bold text-slate-800">O aplikacji</h1>
        <p className="text-slate-600 mt-2 text-sm">
          Aplikacja realizuje architekturę z dokumentu nadrzędnego <code>architektura_aplikacji.md</code> (źródło prawdy).
          Ocenia, czy działka nadaje się pod budownictwo społeczne — w dwóch profilach (dla młodych / senioralne) — a
          jeśli tak, czy inwestycja w formule SIM domyka się finansowo.
        </p>
      </div>

      <Karta tytul="Trzy poziomy analizy">
        <ol className="space-y-3 text-sm text-slate-600">
          <li>
            <strong className="text-slate-800">Poziom 1 — podstawowy (szybki przesiew).</strong> Wyłącznie dane
            automatyczne. Bramki (twarde wykluczenia) przed punktacją, następnie 5 wymiarów (W1 planistyka, W2 demografia,
            W3 dostępność, W4 teren/koszty, W5 luka cenowa) liczonych osobno dla dwóch profili. Wynik: werdykt
            zielony/żółty/czerwony + rekomendowany profil + wskaźnik pewności.
          </li>
          <li>
            <strong className="text-slate-800">Poziom 2 — profesjonalny (ocena działki).</strong> Obwiednia zabudowy z
            parametrów planistycznych (lub fallback z sąsiedztwa przy braku MPZP), dobór typologii i program pod profil.
            Spięcie ekonomiczne nie liczy się tutaj — to przejście do Poziomu 3.
          </li>
          <li>
            <strong className="text-slate-800">Poziom 3 — model finansowy SIM.</strong> Koszt przedsięwzięcia, montaż
            finansowy, oś czasu realizacji, reżim „as-of" (domyślnie program 2027+), indeksacja kosztów i wartości,
            domknięcie (czynsz ≤ pułap, DSCR ≥ 1), wymagana dotacja jako przedział scenariuszowy oraz analiza wrażliwości.
          </li>
        </ol>
      </Karta>

      <Karta tytul="Zasady przekrojowe (obowiązują wszystkie poziomy)">
        <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
          <li>Dwa profile oceniane niezależnie (te same wymiary, inne wagi).</li>
          <li>Bramki przed punktacją.</li>
          <li>Brak danych ≠ „nie" — braki obniżają pewność, nie werdykt. Biała plama = „do weryfikacji".</li>
          <li>Rozdział „da się zbudować" (P2) od „opłaca się / ile dotacji" (P3).</li>
          <li>Liczenie na momencie realizacji, nie analizy (zwłaszcza P3).</li>
          <li>Parametry w konfiguracji, nie w kodzie.</li>
          <li>Wynik poziomu = wejście następnego; pętla zwrotna P3 → P2.</li>
        </ul>
      </Karta>

      <Karta tytul="Kontekst regulacyjny i horyzont realizacji">
        <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
          <li>Plany ogólne wiążące po 31.08.2026; Rejestr Urbanistyczny od 01.07.2026 (dane planistyczne migrują do 🟢).</li>
          <li>Program SBC kończy się edycją jesienną 2026; od 2027 nowy program (kredyt ~2% do 50 lat, grant ~15%).</li>
          <li>Domyślny reżim Poziomu 3 dla nowych analiz to program 2027+, z jawną flagą niepewności.</li>
        </ul>
      </Karta>

      <Karta tytul="Architektura techniczna">
        <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
          <li>Next.js (App Router) + TypeScript; silniki scoringu/zabudowy/finansów jako czyste funkcje (testowalne).</li>
          <li>Warstwa danych: adaptery źródeł (ULDK/EGiB/GUS BDL/OSM…) + dane przykładowe i obsługa „białych plam".</li>
          <li>Warstwa konfiguracji: progi, wagi i parametry reżimów edytowalne poza kodem.</li>
          <li>API: <code>/api/dzialki</code>, <code>/api/analiza/[id]</code> (GET/POST z konfiguracją), <code>/api/konfiguracja</code>.</li>
        </ul>
      </Karta>
    </div>
  );
}
