"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";
import { REGIONS } from "./regions";
import { loadTerrain, type Terrain } from "./terrain";

const THREE_URL = "https://esm.sh/three@0.180.0";
const ORBIT_URL = "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";

// Runtime CDN import — keeps Three out of the bundle.
function importCdn<T>(url: string): Promise<T> {
  return new Function("u", "return import(u)")(url) as Promise<T>;
}

export type ReliefStyle = "modern" | "vintage" | "plaster";

export type ReliefProps = {
  regionId: string;
  exaggeration: number | null; // null = pick automatically for the region
  sunAzimuth: number; // degrees, 0 = north, clockwise
  sunAltitude: number; // degrees above the horizon
  style: ReliefStyle;
  onLoaded?: (info: { maxHeight: number; autoExaggeration: number }) => void;
  onProgress?: (text: string | null) => void;
};

/* =========================================================
   Raised-relief map.

   Land rises out of a flat paper sheet on a thin plinth, so
   coastlines stand up as cut edges; the sea stays paper. A low
   sun throws long shadows across the sheet. Heights are true
   meters scaled by the vertical exaggeration, applied on the
   CPU into the same grid so the slider is live.
   ========================================================= */

const MAP_W = 10; // world units across the map
const PLINTH = 0.018; // land sits this far above the paper
const SEA = -0.08; // non-land cells drop under the paper
const TARGET_RELIEF = 0.45; // auto exaggeration aims for peaks this tall

type Stop = [number, number]; // [meters, hex]
const RAMPS: Record<ReliefStyle, { paper: number; stops: Stop[]; grid: number }> = {
  // teal lowlands to umber mountains to snow, after modern shaded-relief prints
  modern: {
    paper: 0xecebe6,
    grid: 0,
    stops: [
      [0, 0x6aa3a3], [150, 0x94bdb2], [450, 0xc3c0a0], [900, 0xb48e66],
      [1700, 0x8c5d3f], [2800, 0x6f4b38], [4000, 0x7d6353], [5200, 0xc9c0b8], [6400, 0xffffff],
    ],
  },
  // warm inks on cream, after vintage geologic maps
  vintage: {
    paper: 0xe8dbc2,
    grid: 0xb59f7c,
    stops: [
      [0, 0xcdb67c], [200, 0xa9ae6c], [600, 0xd8a65c], [1200, 0xc86a40],
      [2200, 0x9c3a2e], [3400, 0x6a4a3a], [4800, 0x9a8676], [6200, 0xefe6d4],
    ],
  },
  // unpainted white relief — just light and shadow
  plaster: { paper: 0xe4e1da, grid: 0, stops: [[0, 0xf4f1ea], [9000, 0xf4f1ea]] },
};

function lerpHex(a: number, b: number, t: number): [number, number, number] {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return [(ar + (br - ar) * t) / 255, (ag + (bg - ag) * t) / 255, (ab + (bb - ab) * t) / 255];
}

function rampColor(stops: Stop[], m: number): [number, number, number] {
  if (m <= stops[0][0]) return lerpHex(stops[0][1], stops[0][1], 0);
  for (let i = 1; i < stops.length; i++) {
    if (m <= stops[i][0]) {
      const t = (m - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return lerpHex(stops[i - 1][1], stops[i][1], t);
    }
  }
  const last = stops[stops.length - 1][1];
  return lerpHex(last, last, 0);
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

type Api = {
  setRegion: (id: string) => void;
  setExaggeration: (ex: number | null) => void;
  setSun: (az: number, alt: number) => void;
  setStyle: (s: ReliefStyle) => void;
};

export default function ReliefCanvas(props: ReliefProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => apiRef.current?.setRegion(props.regionId), [props.regionId]);
  useEffect(() => apiRef.current?.setExaggeration(props.exaggeration), [props.exaggeration]);
  useEffect(() => apiRef.current?.setSun(props.sunAzimuth, props.sunAltitude), [props.sunAzimuth, props.sunAltitude]);
  useEffect(() => apiRef.current?.setStyle(props.style), [props.style]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    Promise.all([
      importCdn<typeof THREENS>(THREE_URL),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      importCdn<any>(ORBIT_URL),
    ])
      .then(([THREE, { OrbitControls }]) => {
        if (disposed || !host.isConnected) return;
        const V = THREE.Vector3;
        const mobile = window.matchMedia("(max-width: 640px)").matches;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.maxPolarAngle = 1.3;
        controls.minDistance = 1.2;
        controls.maxDistance = 40;
        controls.screenSpacePanning = true;

        const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d3c4, 1.25);
        scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
        const sc = sun.shadow.camera;
        sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 0.5; sc.far = 60;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        scene.add(sun, sun.target);

        const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), paperMat);
        paper.rotation.x = -Math.PI / 2;
        paper.receiveShadow = true;
        scene.add(paper);

        const landMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.92,
          metalness: 0,
        });
        let land: THREENS.Mesh | null = null;
        let grid: THREENS.LineSegments | null = null;

        // current state
        let terrain: Terrain | null = null;
        let gw = 0, gh = 0, cell = 0, unitsPerMeter = 0;
        let exaggeration = 1;
        let autoEx = 1;
        let style: ReliefStyle = propsRef.current.style;
        let bbox = REGIONS[0].bbox;
        let loadToken = { cancelled: false };

        let pending = false;
        const render = () => {
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => {
            pending = false;
            if (!disposed) renderer.render(scene, camera);
          });
        };
        controls.addEventListener("change", render);

        const heightAt = (gx: number, gy: number) => {
          // padded grid: a ring of sea around the map so edges get walls
          if (!terrain || gx < 1 || gy < 1 || gx > terrain.w || gy > terrain.h) return -1;
          return terrain.heights[(gy - 1) * terrain.w + (gx - 1)];
        };

        // Slider drags stretch the mesh vertically (instant — heights are linear in the
        // exaggeration); the exact rebuild, with a constant plinth, runs once it rests.
        let builtEx = 1;
        let rebuildTimer = 0;
        const previewHeights = () => {
          if (!land) return;
          land.scale.y = exaggeration / builtEx;
          render();
          clearTimeout(rebuildTimer);
          rebuildTimer = window.setTimeout(() => {
            if (!disposed) applyHeights();
          }, 220);
        };

        const applyHeights = () => {
          if (!land) return;
          const pos = land.geometry.getAttribute("position") as THREENS.BufferAttribute;
          const k = unitsPerMeter * exaggeration;
          builtEx = exaggeration;
          land.scale.y = 1;
          for (let gy = 0; gy < gh; gy++)
            for (let gx = 0; gx < gw; gx++) {
              const m = heightAt(gx, gy);
              pos.setY(gy * gw + gx, m > 0 ? PLINTH + m * k : SEA);
            }
          pos.needsUpdate = true;
          land.geometry.computeVertexNormals();
          render();
        };

        const applyStyle = () => {
          const ramp = RAMPS[style];
          const c = new THREE.Color(ramp.paper);
          paperMat.color.copy(c);
          // a low sun barely lights a flat sheet; let the paper glow a little so it reads as white stock
          paperMat.emissive.copy(c).multiplyScalar(0.42);
          renderer.setClearColor(c, 1);
          if (land) {
            const col = land.geometry.getAttribute("color") as THREENS.BufferAttribute;
            for (let gy = 0; gy < gh; gy++)
              for (let gx = 0; gx < gw; gx++) {
                const [r, g, b] = rampColor(ramp.stops, Math.max(0, heightAt(gx, gy)));
                col.setXYZ(gy * gw + gx, srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
              }
            col.needsUpdate = true;
          }
          if (grid) {
            grid.visible = ramp.grid !== 0;
            (grid.material as THREENS.LineBasicMaterial).color.setHex(ramp.grid || 0);
          }
          render();
        };

        const setSun = (az: number, alt: number) => {
          const a = (az * Math.PI) / 180;
          const e = (alt * Math.PI) / 180;
          // azimuth 0 = north (-z), clockwise toward east (+x)
          const dir = new V(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
          sun.position.copy(dir.multiplyScalar(25));
          sun.target.position.set(0, 0, 0);
          render();
        };

        const buildGraticule = (t: Terrain) => {
          if (grid) {
            scene.remove(grid);
            grid.geometry.dispose();
          }
          const [w, s, e, n] = bbox;
          const span = Math.max(e - w, n - s);
          const step = span > 60 ? 10 : span > 20 ? 5 : span > 6 ? 2 : 1;
          const toWorld = (lon: number, lat: number) => {
            const [x, y] = t.project(lon, lat);
            // grid cell i spans [i, i+1) in projected coords; its vertex sits at padded index i + 1
            return [(x + 0.5) * cell - MAP_W / 2, (y + 0.5) * cell - ((gh - 1) * cell) / 2] as const;
          };
          const pts: number[] = [];
          for (let lon = Math.ceil(w / step) * step; lon <= e; lon += step)
            for (let lat = s; lat < n; lat += 0.5) {
              const [x0, z0] = toWorld(lon, lat);
              const [x1, z1] = toWorld(lon, Math.min(lat + 0.5, n));
              pts.push(x0, 0.002, z0, x1, 0.002, z1);
            }
          for (let lat = Math.ceil(s / step) * step; lat <= n; lat += step) {
            const [x0, z0] = toWorld(w, lat);
            const [x1, z1] = toWorld(e, lat);
            pts.push(x0, 0.002, z0, x1, 0.002, z1);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
          grid = new THREE.LineSegments(
            g,
            new THREE.LineBasicMaterial({ color: 0, transparent: true, opacity: 0.45 })
          );
          scene.add(grid);
        };

        const fitCamera = () => {
          const depth = (gh - 1) * cell;
          const aspect = camera.aspect || 1;
          const fov = (camera.fov * Math.PI) / 180;
          const fitH = depth / 2 / Math.tan(fov / 2);
          const fitW = MAP_W / 2 / (Math.tan(fov / 2) * aspect);
          const d = Math.max(fitH, fitW) * 1.08;
          // from the south, tilted so the relief reads
          camera.position.set(0, d * 0.86, d * 0.52);
          controls.target.set(0, 0, depth * 0.03);
          controls.update();
          render();
        };

        const setRegion = async (id: string) => {
          const region = REGIONS.find((r) => r.id === id) ?? REGIONS[0];
          loadToken.cancelled = true;
          const token = { cancelled: false };
          loadToken = token;
          bbox = region.bbox;
          const onProgress = propsRef.current.onProgress;
          onProgress?.("loading elevation…");
          const t = await loadTerrain(region.bbox, {
            maxGrid: mobile ? 380 : 640,
            country: region.country,
            signal: token,
            onProgress: (d, n) => onProgress?.(`loading elevation · ${d}/${n} tiles`),
          });
          if (!t || token.cancelled || disposed) return;
          terrain = t;
          gw = t.w + 2;
          gh = t.h + 2;
          cell = MAP_W / (gw - 1);
          unitsPerMeter = cell / t.metersPerCell;

          if (land) {
            scene.remove(land);
            land.geometry.dispose();
          }
          const geo = new THREE.BufferGeometry();
          const positions = new Float32Array(gw * gh * 3);
          const depth = (gh - 1) * cell;
          for (let gy = 0; gy < gh; gy++)
            for (let gx = 0; gx < gw; gx++) {
              const i = (gy * gw + gx) * 3;
              positions[i] = gx * cell - MAP_W / 2;
              positions[i + 2] = gy * cell - depth / 2;
            }
          const index = new Uint32Array((gw - 1) * (gh - 1) * 6);
          let k = 0;
          for (let gy = 0; gy < gh - 1; gy++)
            for (let gx = 0; gx < gw - 1; gx++) {
              const a = gy * gw + gx, b = a + 1, c = a + gw, d = c + 1;
              index[k++] = a; index[k++] = c; index[k++] = b;
              index[k++] = b; index[k++] = c; index[k++] = d;
            }
          geo.setIndex(new THREE.BufferAttribute(index, 1));
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gw * gh * 3), 3));
          land = new THREE.Mesh(geo, landMat);
          land.castShadow = true;
          land.receiveShadow = true;
          land.frustumCulled = false;
          scene.add(land);

          autoEx = Math.min(300, Math.max(1, TARGET_RELIEF / Math.max(1e-6, t.maxHeight * unitsPerMeter)));
          const requested = propsRef.current.exaggeration;
          exaggeration = requested ?? autoEx;
          buildGraticule(t);
          applyStyle();
          applyHeights();
          fitCamera();
          onProgress?.(null);
          propsRef.current.onLoaded?.({ maxHeight: t.maxHeight, autoExaggeration: autoEx });
        };

        apiRef.current = {
          setRegion: (id) => void setRegion(id),
          setExaggeration: (ex) => {
            exaggeration = ex ?? autoEx;
            previewHeights();
          },
          setSun,
          setStyle: (s) => {
            style = s;
            applyStyle();
          },
        };

        const resize = () => {
          const rect = host.getBoundingClientRect();
          const w = Math.min(Math.max(1, rect.width), 4096);
          const h = Math.min(Math.max(1, rect.height), 4096);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          render();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        const p = propsRef.current;
        setSun(p.sunAzimuth, p.sunAltitude);
        void setRegion(p.regionId);

        cleanup = () => {
          clearTimeout(rebuildTimer);
          loadToken.cancelled = true;
          ro.disconnect();
          controls.dispose();
          land?.geometry.dispose();
          grid?.geometry.dispose();
          landMat.dispose();
          paperMat.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          apiRef.current = null;
        };
      })
      .catch(() => {
        propsRef.current.onProgress?.("couldn't start WebGL here");
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="A 3D raised-relief map. Drag to orbit, scroll to zoom."
      className="absolute inset-0"
    />
  );
}
