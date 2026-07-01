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

  // 3) Eksplorator katalogu: dla każdej frazy zwróć kandydatów (id + nazwa + jednostka),
  //    by przypiąć poprawne ID zmiennych BDL bez zgadywania. Param `szukaj` → tylko ta fraza.
  const listaZmiennych = (surowa: string | null): { id: string; nazwa: string; jednostka?: string }[] => {
    if (!surowa) return [];
    try {
      const wyniki = (JSON.parse(surowa) as { results?: Record<string, unknown>[] })?.results ?? [];
      return wyniki.slice(0, 12).map((r) => ({
        id: String(r.id),
        nazwa: [r.n1, r.n2, r.n3].filter(Boolean).join(" · "),
        jednostka: (r.measureUnitName as string) ?? undefined,
      }));
    } catch {
      return [];
    }
  };
  const szukajFraz = async (fraza: string) =>
    ({ fraza, wyniki: listaZmiennych(await fetchTekst(url("variables/search", { name: fraza }), { ...siec, naglowki })) });

  // Eksplorator DRZEWA TEMATÓW (autorytatywny): temat → zmienne (id + nazwa).
  // BDL variables/search słabo dopasowuje frazy; nawigacja po tematach jest pewna.
  const listaTematow = (surowa: string | null): { id: string; name: string }[] => {
    if (!surowa) return [];
    try {
      const wyniki = (JSON.parse(surowa) as { results?: { id?: string | number; name?: string }[] })?.results ?? [];
      return wyniki.slice(0, 8).map((s) => ({ id: String(s.id), name: String(s.name ?? "") }));
    } catch {
      return [];
    }
  };

  const katalog = u.searchParams.get("katalog");
  const vars = u.searchParams.get("vars"); // subject-id → lista zmiennych tematu
  const szukaj = u.searchParams.get("szukaj");
  if (vars) {
    diag.vars = { subjectId: vars, zmienne: listaZmiennych(await fetchTekst(url("variables", { "subject-id": vars }), { ...siec, naglowki })) };
  } else if (katalog) {
    const zmienneTematu = async (id: string) =>
      listaZmiennych(await fetchTekst(url("variables", { "subject-id": id }), { ...siec, naglowki }));
    const dzieci = async (id: string) =>
      listaTematow(await fetchTekst(url("subjects", { "parent-id": id }), { ...siec, naglowki }));
    const wynik: { subjectId: string; temat: string; zmienne: { id: string; nazwa: string }[] }[] = [];
    for (const fraza of ["ludność", "bezrob"]) {
      const tematy = listaTematow(await fetchTekst(url("subjects/search", { name: fraza }), { ...siec, naglowki }));
      for (const t of tematy) {
        const zmienne = await zmienneTematu(t.id);
        if (zmienne.length > 0) {
          wynik.push({ subjectId: t.id, temat: t.name, zmienne });
        } else {
          // Temat nadrzędny bez zmiennych → wejdź jeden poziom w dół (zmienne są w liściach).
          for (const c of (await dzieci(t.id)).slice(0, 6)) {
            const zc = await zmienneTematu(c.id);
            if (zc.length > 0) wynik.push({ subjectId: c.id, temat: `${t.name} › ${c.name}`, zmienne: zc });
          }
        }
      }
    }
    diag.katalog = wynik;
  } else if (szukaj) {
    diag.szukaj = await szukajFraz(szukaj);
  } else {
    // Zestaw fraz eksploracyjnych dla brakujących pojęć (ludność, wiek, bezrobocie).
    diag.kandydaci = await Promise.all(
      [
        "ludność ogółem",
        "ludność w wieku 65 lat i więcej",
        "ludność w wieku poprodukcyjnym",
        "udział ludności w wieku 65 lat i więcej",
        "ludność w wieku 20-39",
        "ludność w wieku 25-39",
        "ludność w wieku produkcyjnym",
        "bezrobotni zarejestrowani ogółem",
        "udział bezrobotnych zarejestrowanych",
      ].map(szukajFraz)
    );
  }

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
