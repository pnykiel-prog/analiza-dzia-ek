/** Warstwa finansowa — ankieta (brama P3), montaż i porównanie reżimów. */

export * from "./typy";
export {
  PARAMETRY_FINANSOWANIA,
  inwestorzy,
  zasoby,
  zasob,
  inwestor,
  macierz,
} from "./parametry";
export {
  dostepneZasoby,
  sugerujRezim,
  walidujUprawnienia,
  zlozMontaz,
  porownajRezimy,
  type OpcjaZasobu,
  type SugestiaRezimu,
  type WynikWalidacji,
} from "./ankieta";
