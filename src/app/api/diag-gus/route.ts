import { NextResponse } from "next/server";
import { KONFIG_KONEKTORY } from "@/lib/data/connectorsConfig";
import { fetchTekst } from "@/lib/data/connectors/net";
import { wybierzJednostke, pierwszaZmienna, wartoscZmiennej, konektorGUS } from "@/lib/data/connectors/gus";
import type { Teren } from "@/lib/data/connectors/types";

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
  const url = (sciezka: string, params: Record<string, string>) => {
    const bazowe: Record<string, string> = { format: "json", ...params };
    if (gus.clientId) bazowe["client-id"] = gus.clientId;
    return `${gus.endpoint}/${sciezka}?${new URLSearchParams(bazowe).toString()}`;
  };

  const diag: Record<string, unknown> = {
    endpoint: gus.endpoint,
    aktywny: gus.aktywny,
    clientIdUstawiony: !!gus.clientId,
    rok: gus.rok,
    gmina,
  };

  // NAJWAŻNIEJSZE: uruchom REALNY konektor GUS dla gminy i pokaż jego wynik (to samo,
  // co dostaje aplikacja). Jeśli `dane` zawiera udzial2039Pct/udzial65PlusPct — działa.
  const terenDiag: Teren = {
    id: "diag", teryt: "", wojewodztwo: "", powiat: "", gmina,
    centroid2180: null, centroid4326: null, wktList: [], powierzchniaM2: 0,
  };
  diag.konektorWynik = await konektorGUS.pobierz(terenDiag);

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
      return wyniki.slice(0, 140).map((r) => ({
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

  // Autorytatywna nawigacja po drzewie tematów BDL (temat → zmienne).
  const zbudujKatalog = async () => {
    const zmienneTematu = async (id: string) =>
      listaZmiennych(await fetchTekst(url("variables", { "subject-id": id }), { ...siec, naglowki }));
    const dzieci = async (id: string) =>
      listaTematow(await fetchTekst(url("subjects", { "parent-id": id }), { ...siec, naglowki }));
    const wynik: { subjectId: string; temat: string; zmienne: { id: string; nazwa: string }[] }[] = [];
    for (const fraza of ["ludność w wieku", "bezrobotni"]) {
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
    return wynik;
  };

  // Wartość zmiennej dla wybranej jednostki (do weryfikacji ID „na żywo").
  const wartoscDla = async (varId: string): Promise<number | null> => {
    if (!jednostka) return null;
    const raw = await fetchTekst(url(`data/by-unit/${encodeURIComponent(jednostka.id)}`, { "var-id": varId, year: String(gus.rok) }), { ...siec, naglowki });
    if (!raw) return null;
    try {
      return wartoscZmiennej(JSON.parse(raw), gus.rok);
    } catch {
      return null;
    }
  };

  // Sonda „rodzeństwa" zmiennej: z ID znanej zmiennej (seed) → jej temat → wszystkie
  // zmienne tematu WRAZ z wartościami dla jednostki. Autorytatywnie odkrywa komplet
  // (np. ekonomiczne grupy wieku: ogółem/przed-/produkcyjny/poprodukcyjny).
  const sondaRodzenstwa = async (seed: string) => {
    const metaRaw = await fetchTekst(url(`variables/${encodeURIComponent(seed)}`, {}), { ...siec, naglowki });
    let subjectId: string | null = null;
    let nazwaSeed = "";
    if (metaRaw) {
      try {
        const m = JSON.parse(metaRaw) as { subjectId?: string; n1?: string; n2?: string; n3?: string };
        subjectId = m.subjectId ?? null;
        nazwaSeed = [m.n1, m.n2, m.n3].filter(Boolean).join(" · ");
      } catch { /* ignore */ }
    }
    if (!subjectId) return { seed, nazwaSeed, subjectId: null, zmienne: [] as unknown[] };
    // page-size=100: BDL domyślnie stronicuje po 10 — bez tego widzimy tylko część pasm wieku.
    const zmienne = listaZmiennych(await fetchTekst(url("variables", { "subject-id": subjectId, "page-size": "100" }), { ...siec, naglowki }));
    // Wartości tylko dla pierwszych 20 (limit czasu funkcji); reszta = same id + nazwa.
    const zWart = [];
    for (let i = 0; i < zmienne.length; i++) {
      zWart.push({ ...zmienne[i], wartosc: i < 20 ? await wartoscDla(zmienne[i].id) : null });
    }
    return { seed, nazwaSeed, subjectId, zmienne: zWart };
  };

  const vars = u.searchParams.get("vars"); // subject-id → lista zmiennych tematu
  const szukaj = u.searchParams.get("szukaj");
  const seed = u.searchParams.get("seed");
  if (vars) {
    diag.vars = { subjectId: vars, zmienne: listaZmiennych(await fetchTekst(url("variables", { "subject-id": vars }), { ...siec, naglowki })) };
  } else if (seed) {
    diag.sonda = await sondaRodzenstwa(seed);
  } else if (szukaj) {
    diag.szukaj = await szukajFraz(szukaj);
  } else {
    // Weryfikacja „na żywo" hipotetycznych ID (kanoniczne zmienne BDL) — pobiera wartość
    // dla jednostki, by potwierdzić poprawność bez zgadywania. Nazwy z metadanych zmiennej.
    const nazwaZmiennej = async (id: string): Promise<string> => {
      const raw = await fetchTekst(url(`variables/${encodeURIComponent(id)}`, {}), { ...siec, naglowki });
      if (!raw) return "";
      try {
        const m = JSON.parse(raw) as { n1?: string; n2?: string; n3?: string };
        return [m.n1, m.n2, m.n3].filter(Boolean).join(" · ");
      } catch {
        return "";
      }
    };
    const KANDYDACI_ID: Record<string, string> = {
      ludnoscOgolem_72305: "72305",
      przedprodukcyjny_72300: "72300",
      produkcyjny_72301: "72301",
      poprodukcyjny_72302: "72302",
      stopaBezrobocia_czerwiec_461685: "461685",
      stopaBezrobocia_grudzien_461691: "461691",
    };
    const weryfikacja: Record<string, { id: string; nazwa: string; wartosc: number | null }> = {};
    for (const [klucz, id] of Object.entries(KANDYDACI_ID)) {
      weryfikacja[klucz] = { id, nazwa: await nazwaZmiennej(id), wartosc: await wartoscDla(id) };
    }
    diag.weryfikacja = weryfikacja;
    // Sonda rodzeństwa z seed 72305 → komplet zmiennych tematu „ludność wg ekonomicznych grup wieku" z wartościami.
    diag.grupyWieku = await sondaRodzenstwa("72305");

    // Probe ZBIORCZY — dokładnie jak w konektorze (jedno data/by-unit z wieloma var-id).
    // Potwierdza kształt odpowiedzi multi-var i że limit BDL nie blokuje jednego zapytania.
    if (jednostka) {
      const ids = ["72305", "72310", "72311", "72312", "72313", "60530", "1365234"];
      const qs = new URLSearchParams({ format: "json", year: String(gus.rok) });
      if (gus.clientId) qs.set("client-id", gus.clientId);
      ids.forEach((id) => qs.append("var-id", id));
      const zbUrl = `${gus.endpoint}/data/by-unit/${encodeURIComponent(jednostka.id)}?${qs.toString()}`;
      const raw = await fetchTekst(zbUrl, { ...siec, naglowki });
      diag.zbiorczy = { url: zbUrl, osiagalny: raw !== null, surowaOdpowiedzSkrot: raw?.slice(0, 900) ?? null };
    }
  }

  // Podsumowanie diagnostyczne — jednoznaczna przyczyna.
  diag.wniosek = !surowaJedn
    ? "HOST NIEOSIĄGALNY lub błąd sieci — Vercel nie łączy się z bdl.stat.gov.pl (sprawdź egress/zaporę)."
    : !jednostka
      ? "HOST OK, ale nie znaleziono jednostki dla podanej nazwy gminy (sprawdź nazwę / poziom)."
      : Object.values(zmienne).every((z) => (z as { wartosc: number | null }).wartosc === null)
        ? "JEDNOSTKA OK, ale brak wartości — najpewniej frazy nie trafiają w ID zmiennych (ustaw zmienneId w konfiguracji)."
        : "OK — GUS zwraca dane; jeśli aplikacja ich nie pokazuje, problem jest dalej (mapowanie/pewność).";

  // Maskujemy klucz API we wszystkich echo-URL/odpowiedziach (diagnostyka bywa wklejana).
  let txt = JSON.stringify(diag);
  if (gus.clientId) txt = txt.split(gus.clientId).join("***");
  return new NextResponse(txt, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}
