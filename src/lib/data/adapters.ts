/**
 * Warstwa adapterów źródeł danych.
 *
 * Architektura (sekcja 6 dokumentu nadrzędnego): rdzeń automatyczny (🟢),
 * pół-automatyczny (🟡) i ręczny (🔴). Każde źródło opisane jest jako adapter
 * z jednolitym interfejsem — dzięki temu realne API (ULDK, GUS BDL, OSM…) można
 * podpiąć później bez zmiany silników scoringu/finansów.
 *
 * Trend reformy planistycznej: dane planistyczne migrują z 🔴/🟡 do 🟢 wraz z
 * Rejestrem Urbanistycznym (01.07.2026). Dlatego adaptery projektowane są z
 * fallbackiem i jawną obsługą "białych plam".
 */

import type { DaneDzialki } from "../types";

export type Pozyskanie = "auto" | "pol_auto" | "reczne";

export interface OpisZrodla {
  klucz: string;
  nazwa: string;
  pozyskanie: Pozyskanie;
  zasila: string; // których pól dotyczy
  endpoint?: string; // realny endpoint (do przyszłej integracji)
}

/**
 * Adapter źródła danych. `pobierz` uzupełnia fragment `DaneDzialki`.
 * Implementacja przykładowa zwraca dane z datasetu; realna uderzałaby do API.
 */
export interface AdapterZrodla {
  opis: OpisZrodla;
  /** Zwraca częściowe dane lub `null`, gdy źródło niedostępne (biała plama). */
  pobierz(id: string): Promise<Partial<DaneDzialki> | null>;
}

/**
 * Katalog źródeł zgodny z `dane_wejsciowe_analiza_dzialek.md`.
 * Adaptery realne implementują `pobierz` przeciw poniższym endpointom.
 */
export const KATALOG_ZRODEL: OpisZrodla[] = [
  {
    klucz: "ULDK",
    nazwa: "ULDK — Usługa Lokalizacji Działek Katastralnych (GUGiK)",
    pozyskanie: "auto",
    zasila: "geometria, powierzchnia, TERYT, gmina/powiat/województwo",
    endpoint: "https://uldk.gugik.gov.pl/?request=GetParcelById&id=",
  },
  {
    klucz: "EGiB",
    nazwa: "EGiB — Ewidencja Gruntów i Budynków (Krajowa Integracja EGiB)",
    pozyskanie: "pol_auto",
    zasila: "klasa użytku, klasa bonitacyjna, budynki istniejące",
    endpoint: "https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow",
  },
  {
    klucz: "KIMPZP_RU",
    nazwa: "KIMPZP / Rejestr Urbanistyczny (od 01.07.2026)",
    pozyskanie: "pol_auto",
    zasila: "status planistyczny, wskaźniki MPZP / planu ogólnego, OUZ",
    endpoint: "https://integracja.gugik.gov.pl/KIMPZP/",
  },
  {
    klucz: "NMT",
    nazwa: "NMT — Numeryczny Model Terenu (GUGiK)",
    pozyskanie: "auto",
    zasila: "średni spadek, ekspozycja",
    endpoint: "https://services.gugik.gov.pl/nmt/",
  },
  {
    klucz: "ISOK",
    nazwa: "ISOK / Hydroportal (Wody Polskie)",
    pozyskanie: "auto",
    zasila: "ryzyko powodziowe",
    endpoint: "https://wody.isok.gov.pl/",
  },
  {
    klucz: "SOPO_MIDAS",
    nazwa: "SOPO / MIDAS (PIG-PIB)",
    pozyskanie: "auto",
    zasila: "osuwiska, tereny górnicze",
  },
  {
    klucz: "GUS_BDL",
    nazwa: "GUS — Bank Danych Lokalnych (API)",
    pozyskanie: "auto",
    zasila: "demografia, migracje, rynek pracy, pustostany, dochody",
    endpoint: "https://bdl.stat.gov.pl/api/v1/",
  },
  {
    klucz: "OSM",
    nazwa: "OSM + routing (Overpass / OSRM)",
    pozyskanie: "auto",
    zasila: "dojazd do aglomeracji, usługi, drogi, przystanki",
    endpoint: "https://overpass-api.de/api/interpreter",
  },
  {
    klucz: "GTFS",
    nazwa: "GTFS organizatorów transportu",
    pozyskanie: "pol_auto",
    zasila: "przystanek z częstotliwością",
  },
  {
    klucz: "GDOS",
    nazwa: "GDOŚ — Geoserwis",
    pozyskanie: "auto",
    zasila: "Natura 2000, formy ochrony przyrody",
    endpoint: "https://www.geoserwis.gdos.gov.pl/mapy/",
  },
  {
    klucz: "RSPO_RPWDL",
    nazwa: "RSPO (szkoły) / RPWDL (podmioty lecznicze)",
    pozyskanie: "pol_auto",
    zasila: "szkoły/żłobki, POZ, szpitale (profile)",
  },
  {
    klucz: "RCiWN",
    nazwa: "RCiWN — Rejestr Cen i Wartości Nieruchomości (starosta)",
    pozyskanie: "reczne",
    zasila: "ceny transakcyjne, cena gruntu",
  },
  {
    klucz: "BGK_KZN",
    nazwa: "BGK / KZN / wojewoda",
    pozyskanie: "reczne",
    zasila: "wartość odtworzeniowa, parametry programów, grunty SP",
  },
];
