/**
 * Konfiguracja konektorów danych — endpointy, klucze, mapowanie zmiennych,
 * flagi aktywności i parametry sieciowe. Zgodnie z wytycznymi: „konfiguracja, nie
 * kod" — adresy i identyfikatory zmiennych trzymane tutaj, nie zaszyte w logice.
 *
 * Adresy WMS niektórych źródeł (GDOŚ, Wody Polskie, PIG, NID) docelowo ustalać
 * przez GetCapabilities/katalog `integracja.gugik.gov.pl`; poniżej wartości
 * startowe z briefu wdrożeniowego.
 */

export interface KonfiguracjaKonektorow {
  siec: { timeoutMs: number; proby: number; backoffMs: number };
  gus: {
    aktywny: boolean;
    endpoint: string;
    clientId: string; // X-ClientId podnosi limity (opcjonalny)
    rok: number;
    poziomGmina: number; // poziom jednostki w BDL (6 = gmina)
    /**
     * Auto-dobór zmiennych z katalogu BDL po nazwie (`variables/search`).
     * Frazy są stabilniejsze niż numeryczne ID — konektor sam znajduje ID na BDL.
     */
    zapytania: {
      ludnoscOgolem: string;
      ludnosc65: string;
      ludnosc2039: string;
      bezrobocie: string;
      podmiotyNa10k: string;
      saldoMigracji: string;
    };
    /** Opcjonalne nadpisanie ID (pomija auto-dobór, gdy ustawione). */
    zmienneId: Partial<Record<keyof KonfiguracjaKonektorow["gus"]["zapytania"], string>>;
    /** Krajowa mediana odniesienia udziału 20–39 lat [%] — fallback, gdy brak danych wojewódzkich. */
    medianaWiek2039Pct: number;
    /** Rok bazowy do liczenia trendów (65+, ludność) — porównanie z rokiem bieżącym. */
    rokBazowyTrend: number;
    /** ID zmiennych „stopa bezrobocia rejestrowanego" (miesięczne, poziom powiatu) — próba po kolei. */
    stopaBezrobociaIds: string[];
  };
  kimpzp: { aktywny: boolean; endpoint: string; warstwy: string; infoFormat: string };
  /** Generyczne konektory „obecność obiektu w punkcie" (WMS GetFeatureInfo) → bramki. */
  wmsObecnosc: {
    klucz: string;
    zrodlo: string;
    endpoint: string;
    warstwy: string;
    /** Słowo kluczowe do auto-odkrycia warstwy przez GetCapabilities (gdy nazwa się nie zgadza). */
    slowoKluczowe: string;
    pole: "natura2000" | "ochronaWykluczajaca" | "ryzykoPowodzioweSzczegolne" | "osuwisko" | "terenGorniczy" | "strefaKonserwatorska";
    wersjaWms: string;
    infoFormat: string;
    aktywny: boolean;
  }[];
  overpass: { aktywny: boolean; endpointy: string[]; promienM: number };
  /** Katalog pozostałych źródeł (mapa architektury; włączane w M2/M3). */
  katalog: { klucz: string; zrodlo: string; endpoint: string; poziom: "P1" | "P2"; etap: "M1" | "M2" | "M3"; aktywny: boolean }[];
}

export const KONFIG_KONEKTORY: KonfiguracjaKonektorow = {
  // Spec §3.1: jedna próba + timeout (bez ponawiania). Backoff nieużywany przy proby=1.
  siec: { timeoutMs: 8000, proby: 1, backoffMs: 500 },
  gus: {
    aktywny: true,
    endpoint: "https://bdl.stat.gov.pl/api/v1",
    // Klucz API BDL (X-ClientId) — DARMOWY, podnosi limity zapytań (bez niego BDL
    // dławi serie zapytań z jednego IP, zwłaszcza z chmury). Ustaw w env: GUS_BDL_CLIENT_ID.
    clientId: process.env.GUS_BDL_CLIENT_ID ?? "",
    rok: 2023,
    poziomGmina: 6,
    zapytania: {
      ludnoscOgolem: "ludność ogółem",
      ludnosc65: "ludność w wieku 65 lat i więcej",
      ludnosc2039: "ludność w wieku 20-39",
      bezrobocie: "udział bezrobotnych zarejestrowanych w liczbie ludności w wieku produkcyjnym",
      podmiotyNa10k: "podmioty wpisane do rejestru REGON na 10 tys. ludności",
      saldoMigracji: "saldo migracji",
    },
    // Potwierdzone ID zmiennych BDL (diagnostyka /api/diag-gus, gmina Rzeszów):
    // podmioty na 10 tys. = 60530 (wart. 1804), saldo migracji = 1365234 (wart. 622).
    // Pozostałe (ludność ogółem/wiek/bezrobocie) do przypięcia po eksploracji katalogu.
    zmienneId: { podmiotyNa10k: "60530", saldoMigracji: "1365234" },
    medianaWiek2039Pct: 25,
    rokBazowyTrend: 2015,
    // „grudzień" i „czerwiec" stopy bezrobocia rejestrowanego (poziom powiatu).
    stopaBezrobociaIds: ["461691", "461685"],
  },
  kimpzp: {
    aktywny: true,
    endpoint:
      "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego",
    warstwy: "plany",
    infoFormat: "application/json",
  },
  wmsObecnosc: [
    // Adresy/warstwy startowe — DO POTWIERDZENIA przez GetCapabilities źródeł.
    // „Obecność obiektu w punkcie" → ustawia pole logiczne (bramka). Wyjątek WMS → „brak".
    {
      klucz: "GDOS_NATURA2000",
      zrodlo: "GDOŚ Natura 2000",
      endpoint: "https://sdi.gdos.gov.pl/ows",
      warstwy: "GDOS:ObszarySpecjalnejOchrony,GDOS:SpecjalneObszaryOchrony",
      slowoKluczowe: "natura 2000",
      pole: "natura2000",
      wersjaWms: "1.1.1",
      infoFormat: "application/json",
      aktywny: false,
    },
    {
      klucz: "GDOS_OCHRONA",
      zrodlo: "GDOŚ formy ochrony (parki narodowe/rezerwaty)",
      endpoint: "https://sdi.gdos.gov.pl/ows",
      warstwy: "GDOS:ParkiNarodowe,GDOS:Rezerwaty",
      slowoKluczowe: "park narodowy",
      pole: "ochronaWykluczajaca",
      wersjaWms: "1.1.1",
      infoFormat: "application/json",
      aktywny: false,
    },
    {
      klucz: "ISOK_POWODZ",
      zrodlo: "ISOK / Wody Polskie — zagrożenie powodziowe",
      endpoint: "https://wody.isok.gov.pl/wms/zmgp",
      warstwy: "obszary_szczegolnego_zagrozenia_powodzia",
      slowoKluczowe: "szczególnego zagrożenia",
      pole: "ryzykoPowodzioweSzczegolne",
      wersjaWms: "1.1.1",
      infoFormat: "application/json",
      aktywny: false,
    },
    {
      klucz: "PIG_SOPO",
      zrodlo: "PIG-PIB SOPO — osuwiska",
      endpoint: "https://geozagrozenia.pgi.gov.pl/arcgis/services/sopo/MapServer/WMSServer",
      warstwy: "osuwiska",
      slowoKluczowe: "osuwisk",
      pole: "osuwisko",
      wersjaWms: "1.1.1",
      infoFormat: "application/json",
      aktywny: false,
    },
    {
      klucz: "NID_ZABYTKI",
      zrodlo: "NID — strefy ochrony konserwatorskiej",
      endpoint: "https://mapy.zabytek.gov.pl/nid/services/WMS/MapServer/WMSServer",
      warstwy: "strefy_ochrony_konserwatorskiej",
      slowoKluczowe: "ochrony konserwatorskiej",
      pole: "strefaKonserwatorska",
      wersjaWms: "1.1.1",
      infoFormat: "application/json",
      aktywny: false,
    },
  ],
  overpass: {
    aktywny: false,
    // Kilka instancji — publiczny overpass-api.de bywa blokowany dla IP centrów
    // danych (np. Vercel); przy niepowodzeniu próbujemy kolejnej (mirror).
    endpointy: [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ],
    promienM: 1500,
  },
  katalog: [
    { klucz: "ULDK", zrodlo: "ULDK (GUGiK)", endpoint: "https://uldk.gugik.gov.pl/", poziom: "P1", etap: "M1", aktywny: true },
    { klucz: "GUS_BDL", zrodlo: "GUS BDL", endpoint: "https://bdl.stat.gov.pl/api/v1", poziom: "P1", etap: "M1", aktywny: true },
    { klucz: "KIMPZP", zrodlo: "KIMPZP (GUGiK)", endpoint: "https://mapy.geoportal.gov.pl/wss/ext/...", poziom: "P1", etap: "M1", aktywny: true },
    { klucz: "NMT", zrodlo: "NMT (GUGiK)", endpoint: "https://integracja.gugik.gov.pl/", poziom: "P1", etap: "M1", aktywny: false },
    { klucz: "POG", zrodlo: "Plany Ogólne Gmin (GUGiK)", endpoint: "https://integracja.gugik.gov.pl/", poziom: "P2", etap: "M1", aktywny: false },
    { klucz: "KIEG", zrodlo: "EGiB (GUGiK)", endpoint: "https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "KIUT", zrodlo: "GESUT (GUGiK)", endpoint: "https://integracja.gugik.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "BDOT10k", zrodlo: "BDOT10k (GUGiK)", endpoint: "https://mapy.geoportal.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "GDOS", zrodlo: "GDOŚ Geoserwis", endpoint: "https://www.geoserwis.gdos.gov.pl/", poziom: "P1", etap: "M2", aktywny: false },
    { klucz: "ISOK", zrodlo: "Wody Polskie / ISOK", endpoint: "https://wody.isok.gov.pl/", poziom: "P1", etap: "M2", aktywny: false },
    { klucz: "PIG", zrodlo: "PIG-PIB (SOPO/MIDAS)", endpoint: "https://geozagrozenia.pgi.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "GIOS", zrodlo: "GIOŚ (powietrze)", endpoint: "https://api.gios.gov.pl/pjp-api/rest/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "NID", zrodlo: "NID (zabytki)", endpoint: "https://mapy.zabytek.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "OSM", zrodlo: "OSM / Overpass", endpoint: "https://overpass-api.de/api/interpreter", poziom: "P1", etap: "M2", aktywny: false },
    { klucz: "ROUTING", zrodlo: "OpenRouteService / OSRM", endpoint: "https://api.openrouteservice.org/v2/isochrones", poziom: "P1", etap: "M2", aktywny: false },
    { klucz: "RSPO", zrodlo: "RSPO (szkoły)", endpoint: "https://rspo.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
    { klucz: "RPWDL", zrodlo: "RPWDL (podmioty lecznicze)", endpoint: "https://rpwdl.ezdrowie.gov.pl/", poziom: "P2", etap: "M2", aktywny: false },
  ],
};
