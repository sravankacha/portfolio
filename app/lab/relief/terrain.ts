import type { BBox } from "./regions";

/* Elevation from the public Terrain Tiles on AWS Open Data (Terrarium encoding):
   height_m = R * 256 + G + B / 256 - 32768. Tiles are Web Mercator, 256px. */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const TOPOJSON_URL = "https://esm.sh/topojson-client@3";
const COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

const TILE = 256;

export type Terrain = {
  w: number; // grid columns
  h: number; // grid rows (row 0 = north)
  heights: Float32Array; // meters; -1 where the cell is not raised
  metersPerCell: number; // ground size of one cell at the center latitude
  maxHeight: number;
  /** full-resolution field for per-pixel lighting and color */
  fine: { w: number; h: number; heights: Float32Array; metersPerPixel: number };
  /** lon/lat to fractional grid coords (x right, y down) */
  project: (lon: number, lat: number) => [number, number];
};

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

export function zoomFor(bbox: BBox, targetPx: number): number {
  const span = bbox[2] - bbox[0];
  const z = Math.round(Math.log2((targetPx * 360) / (TILE * span)));
  return Math.max(2, Math.min(12, z));
}

/** Tile URLs loadTerrain will request for a region (used to warm the HTTP cache). */
export function tileUrls(bbox: BBox, targetPx: number): string[] {
  const [west, south, east, north] = bbox;
  const z = zoomFor(bbox, targetPx);
  const n = 2 ** z;
  const tx0 = Math.floor(Math.floor(lonToX(west, z)) / TILE), tx1 = Math.floor((Math.ceil(lonToX(east, z)) - 1) / TILE);
  const ty0 = Math.floor(Math.floor(latToY(north, z)) / TILE), ty1 = Math.floor((Math.ceil(latToY(south, z)) - 1) / TILE);
  const out: string[] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) out.push(TILE_URL(z, ((tx % n) + n) % n, ty));
  return out;
}

async function loadTile(z: number, x: number, y: number): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(TILE_URL(z, x, y));
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

// Runtime CDN import that bundlers leave alone
function importCdn<T>(url: string): Promise<T> {
  return new Function("u", "return import(u)")(url) as Promise<T>;
}

type Ring = [number, number][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

let countriesCache: Promise<{ name: string; geometry: Geometry }[]> | null = null;
function loadCountries() {
  countriesCache ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topojson = await importCdn<any>(TOPOJSON_URL);
    const topo = await (await fetch(COUNTRIES_URL)).json();
    const fc = topojson.feature(topo, topo.objects.countries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fc.features.map((f: any) => ({ name: f.properties.name as string, geometry: f.geometry as Geometry }));
  })();
  return countriesCache;
}

/** Box-average a W×H field down by `scale` (≥1). Cells with no land stay -1. */
function downsample(src: Float32Array, W: number, H: number, scale: number) {
  const w = Math.max(2, Math.round(W / scale));
  const h = Math.max(2, Math.round(H / scale));
  const out = new Float32Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    const y0 = Math.floor(gy * scale), y1 = Math.min(H, Math.max(y0 + 1, Math.floor((gy + 1) * scale)));
    for (let gx = 0; gx < w; gx++) {
      const x0 = Math.floor(gx * scale), x1 = Math.min(W, Math.max(x0 + 1, Math.floor((gx + 1) * scale)));
      let sum = 0, cnt = 0, land = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const v = src[y * W + x];
          sum += v;
          cnt++;
          if (v > 0) land++;
        }
      // a cell is land when most of it is land, so coastlines don't bloat or erode
      out[gy * w + gx] = cnt && land * 2 >= cnt ? Math.max(1, sum / cnt) : -1;
    }
  }
  return { w, h, data: out };
}

export async function loadTerrain(
  bbox: BBox,
  opts: {
    maxGrid: number; // mesh resolution (long side)
    targetPx: number; // elevation resolution to fetch (long side, before the 4096 cap)
    country?: string;
    onProgress?: (done: number, total: number) => void;
    signal?: { cancelled: boolean };
  }
): Promise<Terrain | null> {
  const [west, south, east, north] = bbox;
  const z = zoomFor(bbox, opts.targetPx);
  const px0 = Math.floor(lonToX(west, z));
  const px1 = Math.ceil(lonToX(east, z));
  const py0 = Math.floor(latToY(north, z));
  const py1 = Math.ceil(latToY(south, z));
  const W = px1 - px0;
  const H = py1 - py0;
  const tx0 = Math.floor(px0 / TILE), tx1 = Math.floor((px1 - 1) / TILE);
  const ty0 = Math.floor(py0 / TILE), ty1 = Math.floor((py1 - 1) / TILE);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const jobs: [number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
  let done = 0;
  const total = jobs.length;
  opts.onProgress?.(0, total);
  const n = 2 ** z;
  const worker = async () => {
    while (jobs.length) {
      const [tx, ty] = jobs.shift()!;
      const bmp = await loadTile(z, ((tx % n) + n) % n, ty);
      if (opts.signal?.cancelled) return;
      if (bmp) ctx.drawImage(bmp, tx * TILE - px0, ty * TILE - py0);
      opts.onProgress?.(++done, total);
    }
  };
  const countryP = opts.country ? loadCountries() : null;
  await Promise.all(Array.from({ length: 8 }, worker));
  if (opts.signal?.cancelled) return null;

  // Decode the stitched tiles to meters
  const px = ctx.getImageData(0, 0, W, H).data;
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const v = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
    raw[i] = v > 0 ? v : -1;
  }

  // Country mask at full resolution: everything outside the borders stays paper
  if (countryP) {
    const countries = await countryP;
    if (opts.signal?.cancelled) return null;
    const c = countries.find((k) => k.name === opts.country);
    if (c) {
      const mctx = (() => {
        const m = document.createElement("canvas");
        m.width = W;
        m.height = H;
        return m.getContext("2d", { willReadFrequently: true })!;
      })();
      const polys = c.geometry.type === "Polygon" ? [c.geometry.coordinates] : c.geometry.coordinates;
      mctx.fillStyle = "#fff";
      mctx.beginPath();
      for (const poly of polys)
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const x = lonToX(lon, z) - px0;
            const y = latToY(lat, z) - py0;
            if (i === 0) mctx.moveTo(x, y);
            else mctx.lineTo(x, y);
          });
          mctx.closePath();
        }
      mctx.fill("evenodd");
      const mask = mctx.getImageData(0, 0, W, H).data;
      for (let i = 0; i < W * H; i++) if (mask[i * 4 + 3] < 128) raw[i] = -1;
    }
  }

  // Detail field for lighting (capped to a safe texture size) and the coarser mesh grid
  const fineScale = Math.max(1, Math.max(W, H) / 4096);
  const fine = fineScale > 1 ? downsample(raw, W, H, fineScale) : { w: W, h: H, data: raw };
  const scale = Math.max(1, Math.max(W, H) / opts.maxGrid);
  const grid = downsample(raw, W, H, scale);

  let maxHeight = 0;
  for (let i = 0; i < fine.data.length; i++) if (fine.data[i] > maxHeight) maxHeight = fine.data[i];

  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const metersPerPixel = (40075016.686 * Math.cos(midLat)) / (TILE * 2 ** z);
  return {
    w: grid.w,
    h: grid.h,
    heights: grid.data,
    metersPerCell: metersPerPixel * scale,
    maxHeight,
    fine: { w: fine.w, h: fine.h, heights: fine.data, metersPerPixel: metersPerPixel * fineScale },
    project: (lon, lat) => [(lonToX(lon, z) - px0) / scale, (latToY(lat, z) - py0) / scale],
  };
}
