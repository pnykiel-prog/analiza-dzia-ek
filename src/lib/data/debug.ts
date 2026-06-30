/**
 * Wspólny log diagnostyczny warstwy danych. Włączany zmienną środowiskową
 * `KONEKTORY_DEBUG=1` (czytaną przy każdym wywołaniu, by działała też na
 * serverless po ustawieniu w panelu hostingu). Loguje m.in. surowe odpowiedzi
 * przed parsowaniem — do diagnozy pustych pól.
 */
export function logDebug(msg: string): void {
  if (process.env.KONEKTORY_DEBUG === "1") {
    console.log(`[konektor] ${msg}`);
  }
}

/** Skraca długi tekst do logu. */
export function skrot(tekst: string, max = 600): string {
  const jedna = tekst.replace(/\s+/g, " ").trim();
  return jedna.length > max ? `${jedna.slice(0, max)}… (${jedna.length} B)` : jedna;
}
