/**
 * Warstwa sieciowa konektorów: timeout, retry z backoffem, log surowych
 * odpowiedzi (tryb debug). Wszystkie wywołania usług rządowych idą przez backend
 * (te funkcje działają po stronie serwera) — nigdy z przeglądarki (CORS).
 */

import { logDebug as log } from "../debug";

/** Przeglądarkowy User-Agent — część usług (WMS/WAF) odrzuca zapytania bez niego. */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

export interface OpcjeFetch {
  timeoutMs?: number;
  proby?: number; // łączna liczba prób (1 = bez retry)
  backoffMs?: number; // bazowy backoff (rośnie wykładniczo)
  naglowki?: Record<string, string>;
}

async function spij(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Fetch tekstu z timeoutem i retry/backoff. Zwraca null przy wyczerpaniu prób. */
export async function fetchTekst(url: string, opcje: OpcjeFetch = {}): Promise<string | null> {
  const { timeoutMs = 8000, proby = 2, backoffMs = 500, naglowki } = opcje;
  for (let i = 0; i < proby; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, ...naglowki } });
      if (!r.ok) {
        log(`HTTP ${r.status} ${url}`);
        // 4xx (poza 429) nie ma sensu ponawiać.
        if (r.status >= 400 && r.status < 500 && r.status !== 429) return null;
        throw new Error(`HTTP ${r.status}`);
      }
      const txt = await r.text();
      log(`OK ${url} (${txt.length} B)`);
      return txt;
    } catch (e) {
      log(`próba ${i + 1}/${proby} nieudana: ${String(e)} ${url}`);
      if (i < proby - 1) await spij(backoffMs * 2 ** i);
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

/** Fetch JSON z timeoutem i retry. Zwraca null przy błędzie/niepoprawnym JSON. */
export async function fetchJson<T = unknown>(url: string, opcje: OpcjeFetch = {}): Promise<T | null> {
  const txt = await fetchTekst(url, { ...opcje, naglowki: { Accept: "application/json", ...(opcje.naglowki ?? {}) } });
  if (txt === null) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    log(`Niepoprawny JSON z ${url}`);
    return null;
  }
}
