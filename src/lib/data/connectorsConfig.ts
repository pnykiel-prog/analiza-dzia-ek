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
     * Mapowanie pól → ID zmiennych BDL. UWAGA: identyfikatory zależą od katalogu
     * BDL i wymagają potwierdzenia w `variables/search`. Puste = pole pomijane
     * (biała plama), nie błąd.
     */
    zmienne: {
      udzial65Plus: string;
      udzial2039: string;
      bezrobocie: string;
      podmiotyNa10k: string;
      saldoMigracji: string;
      ludnoscOgolem: string;
      pustostany: string;
    };
  };
  kimpzp: { aktywny: boolean; endpoint: string; warstwy: string; infoFormat: string };
  /** Katalog pozostałych źródeł (mapa architektury; włączane w M2/M3). */
  katalog: { klucz: string; zrodlo: string; endpoint: string; poziom: "P1" | "P2"; etap: "M1" | "M2" | "M3"; aktywny: boolean }[];
}

export const KONFIG_KONEKTORY: KonfiguracjaKonektorow = {
  siec: { timeoutMs: 8000, proby: 2, backoffMs: 500 },
  gus: {
    aktywny: true,
    endpoint: "https://bdl.stat.gov.pl/api/v1",
    clientId: "",
    rok: 2023,
    poziomGmina: 6,
    zmienne: {
      // Wartości startowe — DO POTWIERDZENIA w katalogu BDL (variables/search).
      udzial65Plus: "",
      udzial2039: "",
      bezrobocie: "",
      podmiotyNa10k: "",
      saldoMigracji: "",
      ludnoscOgolem: "",
      pustostany: "",
    },
  },
  kimpzp: {
    aktywny: true,
    endpoint:
      "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego",
    warstwy: "plany",
    infoFormat: "application/json",
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
