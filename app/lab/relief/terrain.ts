import type { BBox } from "./regions";

/* Elevation from the public Terrain Tiles on AWS Open Data (Terrarium encoding):
   height_m = R * 256 + G + B / 256 - 32768. Tiles are Web Mercator, 256px. */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const TOPOJSON_URL = "https://esm.sh/topojson-client@3";
const COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

const TILE = 256;
const TARGET_PX = 1600; // stitched width to aim for before downsampling

export type Terrain = {
  w: number; // grid columns
  h: number; // grid rows (row 0 = north)
  heights: Float32Array; // meters; -1 where the cell is not raised
  metersPerCell: number; // ground size of one cell at the center latitude
  maxHeight: number;
  /** lon/lat to fractional grid coords (x right, y down) */
  project: (lon: number, lat: number) => [number, number];
};

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

export function zoomFor(bbox: BBox): number {
  const span = bbox[2] - bbox[0];
  const z = Math.round(Math.log2((TARGET_PX * 360) / (TILE * span)));
  return Math.max(2, Math.min(11, z));
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

export async function loadTerrain(
  bbox: BBox,
  opts: { maxGrid: number; country?: string; onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean } }
): Promise<Terrain | null> {
  const [west, south, east, north] = bbox;
  const z = zoomFor(bbox);
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

  const px = ctx.getImageData(0, 0, W, H).data;

  // Downsample to the render grid (box average)
  const f = Math.max(W, H) / opts.maxGrid;
  const scale = Math.max(1, f);
  const w = Math.max(2, Math.round(W / scale));
  const h = Math.max(2, Math.round(H / scale));
  const heights = new Float32Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    const y0 = Math.floor(gy * scale), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * scale));
    for (let gx = 0; gx < w; gx++) {
      const x0 = Math.floor(gx * scale), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * scale));
      let sum = 0, cnt = 0;
      for (let y = y0; y < y1 && y < H; y++)
        for (let x = x0; x < x1 && x < W; x++) {
          const i = (y * W + x) * 4;
          sum += px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768;
          cnt++;
        }
      heights[gy * w + gx] = cnt ? sum / cnt : -1;
    }
  }

  // Country mask: rasterize its polygons onto the grid and flatten everything else
  if (countryP) {
    const countries = await countryP;
    if (opts.signal?.cancelled) return null;
    const c = countries.find((k) => k.name === opts.country);
    if (c) {
      const m = document.createElement("canvas");
      m.width = w;
      m.height = h;
      const mc = m.getContext("2d", { willReadFrequently: true })!;
      const polys = c.geometry.type === "Polygon" ? [c.geometry.coordinates] : c.geometry.coordinates;
      mc.fillStyle = "#fff";
      mc.beginPath();
      for (const poly of polys)
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const x = (lonToX(lon, z) - px0) / scale;
            const y = (latToY(lat, z) - py0) / scale;
            if (i === 0) mc.moveTo(x, y);
            else mc.lineTo(x, y);
          });
          mc.closePath();
        }
      mc.fill("evenodd");
      const mask = mc.getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) if (mask[i * 4 + 3] < 128) heights[i] = -1;
    }
  }

  let maxHeight = 0;
  for (let i = 0; i < heights.length; i++) if (heights[i] > maxHeight) maxHeight = heights[i];

  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const metersPerPixel = (40075016.686 * Math.cos(midLat)) / (TILE * 2 ** z);
  return {
    w,
    h,
    heights,
    metersPerCell: metersPerPixel * scale,
    maxHeight,
    project: (lon, lat) => [(lonToX(lon, z) - px0) / scale, (latToY(lat, z) - py0) / scale],
  };
}
