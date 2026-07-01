/**
 * Orkiestrator pipeline'u: Działka → P1 → P2 → P3.
 * Każdy poziom zasila następny (zasada przekrojowa #7 — żaden poziom nie zaczyna od zera).
 */

import type { DaneDzialki, WariantZabudowy, WynikAnalizy } from "../types";
import type { ProfilFinansowy } from "../finanse/typy";
import type { Konfiguracja } from "../config";
import { KONFIG_FINANSE, KONFIG_SCORING, KONFIG_ZABUDOWA } from "../config";
import { uruchomPoziom1 } from "./poziom1";
import { uruchomPoziom2 } from "./poziom2";
import { uruchomPoziom3 } from "./poziom3";

/** Wybiera wariant zabudowy wiodący do modelu finansowego P3. */
function wybierzWariantDoP3(warianty: WariantZabudowy[], profil: string): WariantZabudowy {
  const preferowany =
    profil === "seniorzy"
      ? warianty.find((w) => w.profil === "seniorzy")
      : warianty.find((w) => w.profil === "mlodzi");
  return preferowany ?? warianty[0];
}

export function uruchomAnalize(
  dane: DaneDzialki,
  konfig?: Partial<Konfiguracja>,
  profilFinansowy?: ProfilFinansowy
): WynikAnalizy {
  const cfgScoring = konfig?.scoring ?? KONFIG_SCORING;
  const cfgZabudowa = konfig?.zabudowa ?? KONFIG_ZABUDOWA;
  const cfgFinanse = konfig?.finanse ?? KONFIG_FINANSE;

  const poziom1 = uruchomPoziom1(dane, cfgScoring);
  const poziom2 = uruchomPoziom2(dane, poziom1, cfgZabudowa);
  const wariant = wybierzWariantDoP3(poziom2.warianty, poziom1.profilRekomendowany);
  const poziom3 = uruchomPoziom3(dane, wariant, cfgFinanse, profilFinansowy);

  return { dane, poziom1, poziom2, poziom3 };
}

export { uruchomPoziom1, uruchomPoziom2, uruchomPoziom3 };
