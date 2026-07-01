import { NextResponse } from "next/server";
import { KONFIG_KONEKTORY } from "@/lib/data/connectorsConfig";
import { fetchTekst } from "@/lib/data/connectors/net";
import { wybierzJednostke, pierwszaZmienna, wartoscZmiennej } from "@/lib/data/connectors/gus";

/**
 * Diagnostyka konektora GUS BDL — uruchamiana po stronie serwera (Vercel), gdzie
 * bdl.stat.gov.pl powinien być osiągalny. Zwraca SUROWE odpowiedzi i wynik
 * parsowania na każdym etapie, aby jednoznacznie wskazać przyczynę „brak danych":
 *  1) osiągalność hosta, 2) wyszukanie jednostki (gminy), 3) wykrycie ID zmiennych
 *  (po frazie), 4) pobranie wartości.
 *
 * Użycie:  GET /api/diag-gus?gmina=Rzeszów   (opcjonalnie &level=6 lub &level=)
 * Bezpieczne: tylko odczyt publicznego API, jedna próba na wywołanie (spec §3.1).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const gmina = u.searchParams.get("gmina") ?? "Rzeszów";
  const levelParam = u.searchParams.get("level"); // "" = bez filtra poziomu
  const gus = KONFIG_KONEKTORY.gus;
  const siec = { timeoutMs: 8000, proby: 1 as const };

  const naglowki: Record<string, string> = gus.clientId ? { "X-ClientId": gus.clientId } : {};
  const url = (sciezka: string, params: Record<string, string>) =>
    `${gus.endpoint}/${sciezka}?${new URLSearchParams({ format: "json", ...params }).toString()}`;

  const diag: Record<string, unknown> = {
    endpoint: gus.endpoint,
    aktywny: gus.aktywny,
    clientIdUstawiony: !!gus.clientId,
    rok: gus.rok,
    gmina,
  };

  // 1) Wyszukanie jednostki (z filtrem poziomu i bez — miasta na prawach powiatu
  //    bywają na innym poziomie niż gmina, dlatego próbujemy obu wariantów).
  const paramsJedn: Record<string, string> = { name: gmina };
  if (levelParam === null) paramsJedn.level = String(gus.poziomGmina);
  else if (levelParam !== "") paramsJedn.level = levelParam;
  const urlJedn = url("units/search", paramsJedn);
  const surowaJedn = await fetchTekst(urlJedn, { ...siec, naglowki });
  diag.krok1_units = {
    url: urlJedn,
    osiagalny: surowaJedn !== null,
    surowaOdpowiedzSkrot: surowaJedn?.slice(0, 600) ?? null,
  };

  let jednostka: { id: string; name: string } | null = null;
  if (surowaJedn) {
    try {
      jednostka = wybierzJednostke(JSON.parse(surowaJedn), gmina);
    } catch {
      diag.krok1_units_blad = "Odpowiedź nie jest poprawnym JSON.";
    }
  }
  // Fallback: ponów bez filtra poziomu, jeśli nie znaleziono jednostki.
  if (!jednostka && paramsJedn.level) {
    const urlJedn2 = url("units/search", { name: gmina });
    const surowa2 = await fetchTekst(urlJedn2, { ...siec, naglowki });
    diag.krok1b_units_bez_level = {
      url: urlJedn2,
      surowaOdpowiedzSkrot: surowa2?.slice(0, 600) ?? null,
    };
    if (surowa2) {
      try {
        jednostka = wybierzJednostke(JSON.parse(surowa2), gmina);
      } catch { /* ignore */ }
    }
  }
  diag.jednostkaWybrana = jednostka;

  // 2) Wykrycie ID zmiennych po frazach (variables/search) + próbne pobranie wartości.
  const zmienne: Record<string, unknown> = {};
  for (const [klucz, fraza] of Object.entries(gus.zapytania)) {
    const override = gus.zmienneId[klucz as keyof typeof gus.zmienneId];
    const urlVar = url("variables/search", { name: fraza });
    let varId: string | null = override ?? null;
    let surowaVar: string | null = null;
    if (!override) {
      surowaVar = await fetchTekst(urlVar, { ...siec, naglowki });
      if (surowaVar) {
        try {
          varId = pierwszaZmienna(JSON.parse(surowaVar));
        } catch { /* ignore */ }
      }
    }
    let wartosc: number | null = null;
    let urlData: string | null = null;
    if (varId && jednostka) {
      urlData = url(`data/by-unit/${encodeURIComponent(jednostka.id)}`, { "var-id": varId, year: String(gus.rok) });
      const surowaData = await fetchTekst(urlData, { ...siec, naglowki });
      if (surowaData) {
        try {
          wartosc = wartoscZmiennej(JSON.parse(surowaData), gus.rok);
        } catch { /* ignore */ }
      }
    }
    zmienne[klucz] = {
      fraza,
      override: override ?? null,
      wykryteVarId: varId,
      variablesSearchSkrot: surowaVar?.slice(0, 300) ?? null,
      urlData,
      wartosc,
    };
  }
  diag.krok2_zmienne = zmienne;

  // Podsumowanie diagnostyczne — jednoznaczna przyczyna.
  diag.wniosek = !surowaJedn
    ? "HOST NIEOSIĄGALNY lub błąd sieci — Vercel nie łączy się z bdl.stat.gov.pl (sprawdź egress/zaporę)."
    : !jednostka
      ? "HOST OK, ale nie znaleziono jednostki dla podanej nazwy gminy (sprawdź nazwę / poziom)."
      : Object.values(zmienne).every((z) => (z as { wartosc: number | null }).wartosc === null)
        ? "JEDNOSTKA OK, ale brak wartości — najpewniej frazy nie trafiają w ID zmiennych (ustaw zmienneId w konfiguracji)."
        : "OK — GUS zwraca dane; jeśli aplikacja ich nie pokazuje, problem jest dalej (mapowanie/pewność).";

  return NextResponse.json(diag, { status: 200 });
}
