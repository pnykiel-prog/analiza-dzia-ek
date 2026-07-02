"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

export type TrybMapy = "ok" | "notfound" | "nonadjacent";
export type WidokMapy = "start" | "level2";

export interface WarstwyMapy {
  parcel?: boolean;
  env?: boolean;
  iso_m?: boolean;
  iso_s?: boolean;
  plan?: boolean;
}

/**
 * Osadzenie schematycznej mapy GIS `<grunt-map>` (web-component z grunt-map.js).
 * Renderujemy tag imperatywnie (dangerouslySetInnerHTML) — po zdefiniowaniu
 * custom elementu (przez /grunt-map.js) węzeł jest automatycznie „upgrade'owany",
 * a zmiana atrybutów wymusza ponowny render mapy.
 */
export function GruntMap({
  mode = "ok",
  view = "start",
  layers = {},
  height = 420,
  shape = "",
}: {
  mode?: TrybMapy;
  view?: WidokMapy;
  layers?: WarstwyMapy;
  height?: number;
  /** Realny kontur działki (punkty SVG „x,y …" z geometrii ULDK). Pusty → schemat. */
  shape?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layersJson = JSON.stringify(layers);

  useEffect(() => {
    // Ustawiamy atrybuty na istniejącym elemencie (jeśli już zdefiniowany) —
    // observedAttributes w grunt-map wywoła re-render bez odtwarzania węzła.
    const el = ref.current?.querySelector("grunt-map");
    if (el) {
      el.setAttribute("mode", mode);
      el.setAttribute("view", view);
      el.setAttribute("layers", layersJson);
      el.setAttribute("shape", shape);
    }
  }, [mode, view, layersJson, shape]);

  return (
    <>
      <Script src="/grunt-map.js" strategy="afterInteractive" />
      <div
        ref={ref}
        style={{ width: "100%", height }}
        dangerouslySetInnerHTML={{
          __html: `<grunt-map mode="${mode}" view="${view}" layers='${layersJson}' shape="${shape}" style="display:block;width:100%;height:${height}px"></grunt-map>`,
        }}
      />
    </>
  );
}

/** Karta „Podgląd terenu" z nagłówkiem, statusem i mapą (jak w prototypie). */
export function PodgladTerenu({
  mode,
  view = "start",
  layers,
  height,
  shape = "",
}: {
  mode: TrybMapy;
  view?: WidokMapy;
  layers?: WarstwyMapy;
  height?: number;
  shape?: string;
}) {
  const badge =
    mode === "ok"
      ? { txt: "scalony teren", klasa: "bg-grunt-green-bg text-grunt-green" }
      : mode === "nonadjacent"
        ? { txt: "działki nieprzylegające", klasa: "bg-grunt-red-bg text-grunt-red" }
        : { txt: "brak geometrii", klasa: "bg-grunt-neutral-bg text-grunt-text-muted" };
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-grunt-divider">
        <div className="text-[13px] font-semibold text-grunt-text">Podgląd terenu</div>
        <span className={`badge ${badge.klasa}`}>{badge.txt}</span>
      </div>
      <div className="bg-grunt-map-bg">
        <GruntMap mode={mode} view={view} layers={layers} height={height} shape={shape} />
      </div>
    </section>
  );
}
