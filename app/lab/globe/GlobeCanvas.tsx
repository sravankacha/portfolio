"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREENS from "three";
import {
  DATASETS,
  type CountryCentroid,
  type DatasetId,
  type GlobePoint,
  fetchEarthquakes,
  fetchISS,
  fetchPopulation,
  fetchVolcanoes,
  m49ToIso3,
} from "./datasets";

const GLOBE_RADIUS = 1;
const THREE_URL = "https://esm.sh/three@0.180.0";
const ORBIT_URL = "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";
const TOPOJSON_URL = "https://esm.sh/topojson-client@3";
const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Webpack/Turbopack can't statically analyze `new Function` import, so the
// CDN modules stay out of the bundle. ~150KB Three + ~10KB OrbitControls +
// ~5KB topojson load only when the user opens /lab/globe.
function importCdn<T = unknown>(url: string): Promise<T> {
  return new Function("u", "return import(u)")(url) as Promise<T>;
}

type Tooltip = { x: number; y: number; label: string; sublabel?: string } | null;

type Props = {
  dataset: DatasetId;
  onCount?: (n: number) => void;
};

export default function GlobeCanvas({ dataset, onCount }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const datasetRef = useRef<DatasetId>(dataset);
  datasetRef.current = dataset;
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  const loadDatasetRef = useRef<((id: DatasetId) => void) | null>(null);

  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>("loading globe…");

  useEffect(() => {
    let cancelled = false;
    const hostEl = hostRef.current;
    if (!hostEl) return;
    const host: HTMLDivElement = hostEl;

    let cleanup = () => {};

    (async () => {
      const THREE = await importCdn<typeof THREENS>(THREE_URL);
      const { OrbitControls } = await importCdn<{
        OrbitControls: new (
          camera: THREENS.PerspectiveCamera,
          dom: HTMLElement,
        ) => OrbitControlsLike;
      }>(ORBIT_URL);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topojson = await importCdn<any>(TOPOJSON_URL);
      const worldRes = await fetch(WORLD_ATLAS_URL);
      const worldTopo = await worldRes.json();
      if (cancelled) return;
      setLoadingMsg(null);

      // ---- scene / camera / renderer ----
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      camera.position.set(0, 0.4, 3.2);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      host.appendChild(renderer.domElement);

      // Subtle ambient + a directional rim to give the spikes some depth.
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(2, 2, 3);
      scene.add(rim);

      // ---- globe sphere (dark, semi-transparent so country lines on the
      // back side dim into the depths) ----
      const sphereGeom = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
      const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x0a0e1a,
        transparent: true,
        opacity: 0.92,
        shininess: 20,
        emissive: 0x05080f,
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      scene.add(sphere);

      // Glow ring (atmosphere-ish back-side sprite via a slightly larger
      // back-side sphere with additive blending).
      const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 48, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x6ea8ff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(haloGeom, haloMat));

      // ---- country borders (LineSegments from topojson) ----
      const countriesFC = topojson.feature(worldTopo, worldTopo.objects.countries);
      const centroids: CountryCentroid[] = [];

      const linePositions: number[] = [];
      for (const feature of countriesFC.features) {
        const m49 = typeof feature.id === "string" ? parseInt(feature.id, 10) : feature.id;
        const iso3 = m49ToIso3(m49);
        const name = feature.properties?.name ?? "Unknown";

        const polygons: number[][][][] =
          feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates as number[][][]]
            : (feature.geometry.coordinates as number[][][][]);

        // Centroid = average of largest ring's vertices.
        let largest: number[][] | null = null;
        for (const poly of polygons) {
          for (const ring of poly) {
            if (!largest || ring.length > largest.length) largest = ring;
            // Edges
            for (let i = 0; i < ring.length - 1; i++) {
              const a = latLonToVec3(THREE, ring[i][1], ring[i][0], GLOBE_RADIUS * 1.001);
              const b = latLonToVec3(THREE, ring[i + 1][1], ring[i + 1][0], GLOBE_RADIUS * 1.001);
              linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
          }
        }
        if (iso3 && largest && largest.length > 0) {
          let sx = 0;
          let sy = 0;
          for (const [lon, lat] of largest) {
            sx += lon;
            sy += lat;
          }
          centroids.push({
            iso3,
            name,
            lat: sy / largest.length,
            lon: sx / largest.length,
          });
        }
      }

      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions, 3),
      );
      const fgColor = themeColor("--foreground", "#e0e0e0");
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(fgColor),
        transparent: true,
        opacity: 0.55,
      });
      const lines = new THREE.LineSegments(lineGeom, lineMat);
      scene.add(lines);

      // ---- spike instanced mesh (shared across datasets) ----
      const MAX_INSTANCES = 6000;
      const spikeGeom = new THREE.CylinderGeometry(0.005, 0.012, 1, 6, 1, false);
      // Cylinder is centered at origin extending +/-0.5 in Y. We want it to
      // grow OUTWARD from the sphere — so translate so the base sits at y=0.
      spikeGeom.translate(0, 0.5, 0);

      const spikeMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        shininess: 10,
      });
      const spikes = new THREE.InstancedMesh(spikeGeom, spikeMat, MAX_INSTANCES);
      spikes.count = 0;
      spikes.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_INSTANCES * 3),
        3,
      );
      scene.add(spikes);

      // Per-instance point data, parallel to spike instances. Index = instanceId.
      let activePoints: GlobePoint[] = [];

      const dummy = new THREE.Object3D();
      const colorObj = new THREE.Color();
      const matrixUp = new THREE.Vector3(0, 1, 0);

      function setSpikes(points: GlobePoint[], baseColor: string, spikeScale: number) {
        activePoints = points;
        const n = Math.min(points.length, MAX_INSTANCES);
        spikes.count = n;
        const base = new THREE.Color(baseColor);
        const baseHsl = { h: 0, s: 0, l: 0 };
        base.getHSL(baseHsl);
        for (let i = 0; i < n; i++) {
          const p = points[i];
          const len = Math.max(0.02, p.value) * spikeScale;
          const dir = latLonToVec3(THREE, p.lat, p.lon, 1).normalize();
          dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS);
          dummy.quaternion.setFromUnitVectors(matrixUp, dir);
          const thick = 1 + p.value * 0.6;
          dummy.scale.set(thick, len, thick);
          dummy.updateMatrix();
          spikes.setMatrixAt(i, dummy.matrix);
          // Same hue + saturation as the dataset color; lightness drives the
          // intensity ramp — small values get a washed-out, light variant,
          // large values get a deep, dark variant.
          const lightness = 0.78 - p.value * 0.5; // ~0.78 (washed) .. 0.28 (deep)
          colorObj.setHSL(baseHsl.h, baseHsl.s, lightness);
          spikes.setColorAt(i, colorObj);
        }
        spikes.instanceMatrix.needsUpdate = true;
        if (spikes.instanceColor) spikes.instanceColor.needsUpdate = true;
        onCountRef.current?.(n);
      }

      // ---- controls ----
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = 1.4;
      controls.maxDistance = 6;
      controls.rotateSpeed = 0.45;
      controls.zoomSpeed = 0.6;
      // Subtle idle auto-rotate when the user isn't interacting.
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      const stopAutoRotate = () => {
        controls.autoRotate = false;
      };
      renderer.domElement.addEventListener("pointerdown", stopAutoRotate, {
        once: true,
      });
      renderer.domElement.addEventListener("wheel", stopAutoRotate, {
        once: true,
      });

      // ---- raycast / tooltip ----
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let lastHover = -1;

      function onPointerMove(e: PointerEvent) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(spikes);
        if (hits.length > 0 && hits[0].instanceId != null) {
          const id = hits[0].instanceId;
          const p = activePoints[id];
          if (p) {
            lastHover = id;
            setTooltip({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              label: p.label,
              sublabel: p.sublabel,
            });
            return;
          }
        }
        if (lastHover !== -1) {
          lastHover = -1;
          setTooltip(null);
        }
      }
      function onPointerLeave() {
        lastHover = -1;
        setTooltip(null);
      }
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerleave", onPointerLeave);

      // ---- resize ----
      function resize() {
        const w = host.clientWidth;
        const h = host.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // ---- render loop ----
      let raf = 0;
      const tick = () => {
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // ---- dataset orchestration ----
      let liveTimer: ReturnType<typeof setInterval> | null = null;

      async function loadDataset(id: DatasetId) {
        if (liveTimer) {
          clearInterval(liveTimer);
          liveTimer = null;
        }
        setLoadingMsg(`loading ${DATASETS[id].label}…`);
        try {
          const points = await fetcherFor(id, centroids);
          if (cancelled || datasetRef.current !== id) return;
          setSpikes(points, DATASETS[id].color, DATASETS[id].spikeScale ?? 0.35);
          setLoadingMsg(null);

          const live = DATASETS[id].livePollMs;
          if (live) {
            liveTimer = setInterval(async () => {
              if (cancelled || datasetRef.current !== id) return;
              try {
                const next = await fetcherFor(id, centroids);
                if (!cancelled && datasetRef.current === id) {
                  setSpikes(next, DATASETS[id].color, DATASETS[id].spikeScale ?? 0.35);
                }
              } catch {
                // swallow — keep last known position
              }
            }, live);
          }
        } catch (err) {
          console.warn("Globe dataset load failed", id, err);
          if (!cancelled) setLoadingMsg(`couldn't load ${DATASETS[id].label}`);
        }
      }

      loadDatasetRef.current = (id: DatasetId) => {
        datasetRef.current = id;
        loadDataset(id);
      };
      loadDataset(datasetRef.current);

      cleanup = () => {
        cancelled = true;
        loadDatasetRef.current = null;
        if (liveTimer) clearInterval(liveTimer);
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
        renderer.domElement.removeEventListener("pointerdown", stopAutoRotate);
        renderer.domElement.removeEventListener("wheel", stopAutoRotate);
        controls.dispose();
        sphereGeom.dispose();
        sphereMat.dispose();
        haloGeom.dispose();
        haloMat.dispose();
        lineGeom.dispose();
        lineMat.dispose();
        spikeGeom.dispose();
        spikeMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
      };
    })().catch((err) => {
      console.error("Globe init failed", err);
      setLoadingMsg("failed to load globe");
    });

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDatasetRef.current?.(dataset);
  }, [dataset]);

  return (
    <div className="relative w-full h-full">
      <div ref={hostRef} className="absolute inset-0" />
      {loadingMsg && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none text-muted text-sm font-mono">
          {loadingMsg}
        </div>
      )}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-surface border border-border rounded-md px-3 py-2 text-xs font-mono shadow-lg z-10 max-w-[260px]"
          style={{
            left: Math.min(tooltip.x + 14, (hostRef.current?.clientWidth ?? 600) - 200),
            top: Math.min(tooltip.y + 14, (hostRef.current?.clientHeight ?? 600) - 60),
          }}
        >
          <div className="text-foreground">{tooltip.label}</div>
          {tooltip.sublabel && (
            <div className="text-muted mt-0.5">{tooltip.sublabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

type OrbitControlsLike = {
  enableDamping: boolean;
  dampingFactor: number;
  enablePan: boolean;
  minDistance: number;
  maxDistance: number;
  rotateSpeed: number;
  zoomSpeed: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  update: () => void;
  dispose: () => void;
};

function latLonToVec3(
  THREE: typeof THREENS,
  lat: number,
  lon: number,
  r: number,
): THREENS.Vector3 {
  // Standard sphere mapping: lat 0 = equator, lat 90 = north pole.
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function themeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

function fetcherFor(
  id: DatasetId,
  centroids: CountryCentroid[],
): Promise<GlobePoint[]> {
  switch (id) {
    case "earthquakes":
      return fetchEarthquakes();
    case "volcanoes":
      return fetchVolcanoes();
    case "iss":
      return fetchISS();
    case "population":
      return fetchPopulation(centroids);
  }
}
