/**
 * Słownik TERYT — tryb hybrydowy.
 *
 * Województwo: sztywna lista 16 (zawsze). Powiat / gmina / obręb: podpowiedzi
 * z wbudowanego mini-drzewa (zasilonego m.in. lokalizacjami działek
 * przykładowych) z możliwością wpisania dowolnej wartości (datalist).
 *
 * Docelowo mini-drzewo zastąpi pełny TERYT z API GUGiK/GUS — bez zmiany UI,
 * które operuje na tych samych funkcjach pomocniczych.
 */

export const WOJEWODZTWA: { kod: string; nazwa: string }[] = [
  { kod: "02", nazwa: "dolnośląskie" },
  { kod: "04", nazwa: "kujawsko-pomorskie" },
  { kod: "06", nazwa: "lubelskie" },
  { kod: "08", nazwa: "lubuskie" },
  { kod: "10", nazwa: "łódzkie" },
  { kod: "12", nazwa: "małopolskie" },
  { kod: "14", nazwa: "mazowieckie" },
  { kod: "16", nazwa: "opolskie" },
  { kod: "18", nazwa: "podkarpackie" },
  { kod: "20", nazwa: "podlaskie" },
  { kod: "22", nazwa: "pomorskie" },
  { kod: "24", nazwa: "śląskie" },
  { kod: "26", nazwa: "świętokrzyskie" },
  { kod: "28", nazwa: "warmińsko-mazurskie" },
  { kod: "30", nazwa: "wielkopolskie" },
  { kod: "32", nazwa: "zachodniopomorskie" },
];

export interface GminaTeryt {
  teryt: string; // token TERYT gminy używany w identyfikatorze ULDK
  obreby: string[]; // znane obręby (podpowiedzi)
}

type DrzewoTeryt = Record<string, Record<string, Record<string, GminaTeryt>>>;

/** Mini-drzewo: województwo → powiat → gmina → { teryt, obręby }. Sparse. */
export const DRZEWO_TERYT: DrzewoTeryt = {
  mazowieckie: {
    piaseczyński: {
      Lesznowola: { teryt: "146509_8", obreby: ["0012"] },
      Piaseczno: { teryt: "146511_4", obreby: ["0001", "0002"] },
    },
    "Warszawa": {
      "Warszawa-Białołęka": { teryt: "146503_8", obreby: ["0001"] },
    },
  },
  wielkopolskie: {
    poznański: {
      Kórnik: { teryt: "300108_4", obreby: ["0005"] },
      Swarzędz: { teryt: "300113_4", obreby: ["0001"] },
    },
  },
  lubelskie: {
    bialski: {
      "Janów Podlaski": { teryt: "061702_2", obreby: ["0011"] },
    },
  },
};

export function powiaty(woj: string): string[] {
  return Object.keys(DRZEWO_TERYT[woj] ?? {}).sort((a, b) => a.localeCompare(b, "pl"));
}

export function gminy(woj: string, powiat: string): string[] {
  return Object.keys(DRZEWO_TERYT[woj]?.[powiat] ?? {}).sort((a, b) => a.localeCompare(b, "pl"));
}

export function obreby(woj: string, powiat: string, gmina: string): string[] {
  return DRZEWO_TERYT[woj]?.[powiat]?.[gmina]?.obreby ?? [];
}

export function terytGminy(woj: string, powiat: string, gmina: string): string | null {
  return DRZEWO_TERYT[woj]?.[powiat]?.[gmina]?.teryt ?? null;
}

/** Dane jednej pozycji identyfikacyjnej z formularza. */
export interface PozycjaDzialki {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  obreb: string;
  numer: string;
}

/**
 * Składa identyfikator działki dla ULDK: `${terytGminy}.${obreb}.${numer}`.
 * Gdy gmina nie ma znanego TERYT w mini-słowniku, używa wpisanego tekstu jako
 * pseudo-tokenu (fallback) — pozwala działać offline i ostrzega niżej w resolverze.
 */
export function skomponujId(p: PozycjaDzialki): { id: string; znanyTeryt: boolean } {
  const teryt = terytGminy(p.wojewodztwo, p.powiat, p.gmina);
  const token = teryt ?? `${p.wojewodztwo}/${p.gmina}`;
  const id = `${token}.${p.obreb}.${p.numer}`.trim();
  return { id, znanyTeryt: teryt !== null };
}
