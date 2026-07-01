/** Etykiety PL dla słowników finansowych (wspólne dla ankiety i widoku analizy). */

import type {
  DostepZasobu,
  RezimFinansowy,
  SposobWniesieniaDzialki,
  TypInwestora,
  TypZasobu,
  WspolpracaGmina,
} from "./typy";

export const ETYK_INWESTORA: Record<TypInwestora, string> = {
  SIM_GMINNY: "SIM gminny",
  SIM_MIESZANY: "SIM mieszany (prywatno-gminny)",
  SIM_PRYWATNY: "SIM prywatny",
  TBS: "TBS",
  SPOLDZIELNIA: "Spółdzielnia mieszkaniowa",
  SPOLKA_GMINNA: "Spółka gminna",
  GMINA: "Gmina bezpośrednio",
};

export const ETYK_ZASOBU: Record<TypZasobu, string> = {
  SOCJALNY: "Zasób socjalny",
  KOMUNALNY: "Zasób komunalny",
  SPOLECZNY_CZYNSZOWY: "Zasób społeczny czynszowy",
  SPOLDZIELCZY_LOKATORSKI: "Zasób spółdzielczy lokatorski",
};

export const ETYK_REZIMU: Record<RezimFinansowy, string> = {
  current: "Reżim obecny",
  future: "Reżim nowy (2027+)",
};

export const ETYK_DOSTEPU: Record<DostepZasobu, string> = {
  brak: "brak",
  ograniczony: "ograniczony",
  pełen: "pełen",
};

export const ETYK_GRUNTU: Record<SposobWniesieniaDzialki, string> = {
  APORT_GMINNY: "Aport gminny (wkład niepieniężny)",
  ZAKUP_KREDYT: "Zakup finansowany kredytem",
  ZAKUP_KAPITAL_WLASNY: "Zakup ze środków własnych",
  JUZ_POSIADANA: "Działka już w posiadaniu",
  LOKAL_ZA_GRUNT: "Lokal za Grunt",
};

export const ETYK_WSPOLPRACY: Record<WspolpracaGmina, string> = {
  UMOWA_PARTNERSKA: "Umowa partnerska",
  APORT: "Aport gruntu",
  UDZIAL_KAPITALOWY: "Udział kapitałowy",
  LOKAL_ZA_GRUNT: "Lokal za Grunt",
  ZPI: "Zintegrowany Plan Inwestycyjny (ZPI)",
  BRAK: "Brak współpracy",
};
