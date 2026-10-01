/* Warm an experiment's heavy dependencies before it opens, so the page can
   draw immediately: CDN modules go into the browser's module map (a later
   import() of the same URL resolves instantly) and data goes into the HTTP
   cache. URLs must match what each experiment requests, character for
   character. Safe to call repeatedly; each asset is fetched once. */

import { REGIONS, DEFAULT_REGION } from "../relief/regions";
import { tileUrls } from "../relief/terrain";

const THREE = "https://esm.sh/three@0.180.0";
const ORBIT = "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";
const TOPOJSON = "https://esm.sh/topojson-client@3";
const ATLAS_110 = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const QUAKES = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson";

const started = new Set<string>();

function importCdn(url: string) {
  if (started.has(url)) return;
  started.add(url);
  (new Function("u", "return import(u)")(url) as Promise<unknown>).catch(() => started.delete(url));
}

function fetchLow(urls: string[], concurrency = 6) {
  const todo = urls.filter((u) => !started.has(u));
  todo.forEach((u) => started.add(u));
  const run = async () => {
    while (todo.length) {
      const u = todo.shift()!;
      try {
        // same mode as the experiment's own fetch so the cached entry is reused
        await fetch(u, { priority: "low" } as RequestInit);
      } catch {
        started.delete(u);
      }
    }
  };
  for (let i = 0; i < concurrency; i++) void run();
}

export function prewarm(slug: string) {
  if (typeof window === "undefined") return;
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  switch (slug) {
    case "relief": {
      importCdn(THREE);
      importCdn(ORBIT);
      const region = REGIONS.find((r) => r.id === DEFAULT_REGION)!;
      fetchLow(tileUrls(region.bbox, mobile ? 1400 : 2800));
      break;
    }
    case "globe":
      importCdn(THREE);
      importCdn(ORBIT);
      importCdn(TOPOJSON);
      fetchLow([ATLAS_110, QUAKES]);
      break;
    case "pipe":
    case "waves":
      importCdn(THREE);
      break;
  }
}
